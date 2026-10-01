/**
 * lib/agent-gateway/rollout/health-gates.ts
 *
 * Phase 15 — health gates over the evidence that already exists: the audit
 * ledger (Phase 11). No new telemetry store, no sampling of live traffic.
 *
 * For one capability (or one connection) in one environment, over a
 * trailing window:
 *   - service failures: `execution.failed` whose error is an infrastructure
 *     failure (the circuit-breaker vocabulary: EXECUTION_UNAVAILABLE,
 *     INTERNAL_ERROR, TIMEOUT). Agent mistakes (RESOURCE_NOT_FOUND,
 *     INVALID_INPUT, ...) are not service failures;
 *   - successes: `execution.succeeded`;
 *   - circuit openings: `failure.circuit_opened`;
 *   - security events: kill-switch / rollout refusals do not count, but
 *     task violations and refused inputs do (connection gates only).
 *
 * Verdicts: UNHEALTHY (failure rate above the threshold with enough
 * samples, or a circuit opened), INSUFFICIENT_DATA (fewer samples than the
 * minimum), HEALTHY. Store failures are UNAVAILABLE — never HEALTHY.
 */
import { db } from "@/lib/db"

export const HEALTH_WINDOW_MS = 60 * 60 * 1000
export const HEALTH_MIN_SAMPLES = 20
export const HEALTH_MAX_FAILURE_RATE = 0.25
/** Promotion of a connection's autonomy needs a clean record: no security event at all in the window. */
export const PROMOTION_MAX_SECURITY_EVENTS = 0

const SERVICE_FAILURE_CODES = ["EXECUTION_UNAVAILABLE", "INTERNAL_ERROR", "TIMEOUT"]
const CONNECTION_SECURITY_ACTIONS = ["security.task_violation", "security.input_rejected", "security.injection_suspected", "security.outbound_blocked"]

export type HealthVerdict = "HEALTHY" | "UNHEALTHY" | "INSUFFICIENT_DATA" | "UNAVAILABLE"

export interface HealthReport {
  verdict: HealthVerdict
  windowMs: number
  samples: number
  successes: number
  serviceFailures: number
  failureRate: number | null
  circuitOpenings: number
  securityEvents: number
  /** Stable reason codes for UNHEALTHY / INSUFFICIENT_DATA / UNAVAILABLE. */
  reasons: string[]
}

export interface HealthScope {
  environment: string
  capabilityId?: string
  connectionId?: string
}

export function judgeHealth(counts: { successes: number; serviceFailures: number; circuitOpenings: number; securityEvents: number }, windowMs: number, opts: { securityLimit?: number } = {}): HealthReport {
  const samples = counts.successes + counts.serviceFailures
  const failureRate = samples > 0 ? counts.serviceFailures / samples : null
  const reasons: string[] = []
  if (counts.circuitOpenings > 0) reasons.push("CIRCUIT_OPENED")
  if (opts.securityLimit !== undefined && counts.securityEvents > opts.securityLimit) reasons.push("SECURITY_EVENTS")
  if (samples >= HEALTH_MIN_SAMPLES && failureRate !== null && failureRate > HEALTH_MAX_FAILURE_RATE) reasons.push("FAILURE_RATE")
  let verdict: HealthVerdict
  if (reasons.length > 0) verdict = "UNHEALTHY"
  else if (samples < HEALTH_MIN_SAMPLES) {
    verdict = "INSUFFICIENT_DATA"
    reasons.push("TOO_FEW_SAMPLES")
  } else verdict = "HEALTHY"
  return { verdict, windowMs, samples, ...counts, failureRate, reasons }
}

export async function evaluateHealth(scope: HealthScope, now: Date, opts: { windowMs?: number; securityLimit?: number } = {}): Promise<HealthReport> {
  const windowMs = opts.windowMs ?? HEALTH_WINDOW_MS
  const since = new Date(now.getTime() - windowMs)
  const base: Record<string, unknown> = { environment: scope.environment, occurredAt: { gte: since } }
  if (scope.capabilityId) base.capabilityId = scope.capabilityId
  if (scope.connectionId) base.connectionId = scope.connectionId
  try {
    const [successes, serviceFailures, circuitOpenings, securityEvents] = await Promise.all([
      db.agentAuditEvent.count({ where: { ...base, action: "execution.succeeded" } }),
      db.agentAuditEvent.count({ where: { ...base, action: "execution.failed", errorCode: { in: SERVICE_FAILURE_CODES } } }),
      // Breaker events are SYSTEM events keyed by capability, without an environment column value.
      db.agentAuditEvent.count({ where: { action: "failure.circuit_opened", occurredAt: { gte: since }, ...(scope.capabilityId ? { capabilityId: scope.capabilityId } : {}), ...(scope.connectionId ? { connectionId: scope.connectionId } : {}) } }),
      // Security evidence (e.g. security.input_rejected) is recorded before an
      // environment is resolved; a connection belongs to one environment, so
      // it is counted by connection alone.
      scope.connectionId
        ? db.agentAuditEvent.count({ where: { connectionId: scope.connectionId, occurredAt: { gte: since }, action: { in: CONNECTION_SECURITY_ACTIONS } } })
        : Promise.resolve(0),
    ])
    return judgeHealth({ successes, serviceFailures, circuitOpenings, securityEvents }, windowMs, { securityLimit: opts.securityLimit })
  } catch {
    return { verdict: "UNAVAILABLE", windowMs, samples: 0, successes: 0, serviceFailures: 0, failureRate: null, circuitOpenings: 0, securityEvents: 0, reasons: ["HEALTH_DATA_UNAVAILABLE"] }
  }
}
