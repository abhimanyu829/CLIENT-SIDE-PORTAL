/**
 * lib/agent-gateway/audit-ledger/recorder.ts
 *
 * Phase 11 — how the rest of the platform writes evidence.
 *
 * Failure policy (docs/agent-gateway/phase-11/01-audit-ledger.md):
 *   - recordAuditStrict(): the operation depends on the evidence. Used for
 *     the pre-execution "execution.started" intent of every mutation: if
 *     the ledger cannot record it, the mutation does not run.
 *   - recordAudit(): best effort. Used after the fact (outcomes, decisions,
 *     task lifecycle, admin changes). A failure is logged (rate limited)
 *     and counted, never thrown, and never changes business state.
 *   - recordAuditThrottled(): best effort with per-key throttling, for
 *     events an unauthenticated caller can provoke at will (failed
 *     authentication, rejected webhooks). At most one event per key per
 *     window; the suppressed count rides on the next recorded event. The
 *     ledger cannot be flooded through the public endpoints.
 *
 * Correlation fields (traceId, requestId, taskRef, triggerRef) are filled
 * from the current trace context when the caller did not set them.
 */
import { gatewayLogger } from "../observability/request-log"
import { countMetric, observeMetric } from "../observability/agent-metrics"
import { currentTraceContext } from "../observability/trace-context"
import { appendAuditEvent } from "./ledger"
import { AuditLedgerUnavailableError, categoryOf, type AuditEventInput, type AuditEventRow } from "./types"

const pending = new Set<Promise<unknown>>()
let lastFailureLogAt = 0
const FAILURE_LOG_INTERVAL_MS = 60_000

function enrich(input: AuditEventInput): AuditEventInput {
  const ctx = currentTraceContext()
  if (!ctx) return input
  return {
    ...input,
    traceId: input.traceId ?? ctx.traceId,
    requestId: input.requestId ?? ctx.requestId ?? null,
    taskRef: input.taskRef ?? ctx.taskRef ?? null,
    triggerRef: input.triggerRef ?? ctx.triggerRef ?? null,
  }
}

function reportFailure(input: AuditEventInput, err: unknown): void {
  countMetric("agent_audit_append_total", { category: categoryOf(input.action), outcome: "FAILED" })
  const now = Date.now()
  if (now - lastFailureLogAt < FAILURE_LOG_INTERVAL_MS) return
  lastFailureLogAt = now
  gatewayLogger.error(
    { action: input.action, errorCode: err instanceof AuditLedgerUnavailableError ? err.code : "AUDIT_APPEND_FAILED" },
    "agent_gateway_audit_append_failed"
  )
}

async function timedAppend(input: AuditEventInput): Promise<AuditEventRow> {
  const startedAt = performance.now()
  try {
    const row = await appendAuditEvent(input)
    countMetric("agent_audit_append_total", { category: categoryOf(input.action), outcome: "SUCCESS" })
    observeMetric("agent_audit_append_duration_ms", performance.now() - startedAt, { outcome: "SUCCESS" })
    return row
  } catch (err) {
    observeMetric("agent_audit_append_duration_ms", performance.now() - startedAt, { outcome: "FAILED" })
    throw err instanceof AuditLedgerUnavailableError ? err : new AuditLedgerUnavailableError()
  }
}

/** Best effort: never throws, never awaited by the caller. */
export function recordAudit(input: AuditEventInput): void {
  let enriched: AuditEventInput
  try {
    enriched = enrich(input)
  } catch {
    enriched = input
  }
  const run = timedAppend(enriched).then(
    () => undefined,
    (err) => reportFailure(enriched, err)
  )
  pending.add(run)
  void run.finally(() => pending.delete(run))
}

/** The operation depends on this evidence: throws AuditLedgerUnavailableError when it cannot be stored. */
export async function recordAuditStrict(input: AuditEventInput): Promise<AuditEventRow> {
  const enriched = enrich(input)
  try {
    return await timedAppend(enriched)
  } catch (err) {
    reportFailure(enriched, err)
    throw err
  }
}

interface ThrottleState {
  windowStart: number
  suppressed: number
}
const throttles = new Map<string, ThrottleState>()
const MAX_THROTTLE_KEYS = 1_000

/** Best effort, at most one event per `key` per window (for events unauthenticated callers can provoke). */
export function recordAuditThrottled(input: AuditEventInput, key: string, windowMs = 10_000): void {
  const now = Date.now()
  const state = throttles.get(key)
  if (state && now - state.windowStart < windowMs) {
    state.suppressed += 1
    return
  }
  const suppressed = state?.suppressed ?? 0
  if (!state && throttles.size >= MAX_THROTTLE_KEYS) {
    const oldest = throttles.keys().next().value
    if (oldest !== undefined) throttles.delete(oldest)
  }
  throttles.set(key, { windowStart: now, suppressed: 0 })
  recordAudit({ ...input, metadata: { ...(input.metadata ?? {}), ...(suppressed > 0 ? { suppressedCount: suppressed } : {}) } })
}

/** Waits for in-flight best-effort appends (tests, graceful shutdown). */
export async function flushAuditLedger(): Promise<void> {
  for (let i = 0; i < 20 && pending.size > 0; i += 1) {
    await Promise.allSettled(Array.from(pending))
  }
}

/** Test-only. */
export function __resetAuditThrottleForTests(): void {
  throttles.clear()
  lastFailureLogAt = 0
}
