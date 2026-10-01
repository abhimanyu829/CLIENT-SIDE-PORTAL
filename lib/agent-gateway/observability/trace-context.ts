/**
 * lib/agent-gateway/observability/trace-context.ts
 *
 * Phase 11 — request-scoped correlation for the agent platform.
 *
 * One `traceId` (W3C trace-id format: 32 lowercase hex) follows an agent
 * operation across every layer and every async boundary:
 *
 *   MCP / HTTP request -> gateway -> gate -> resolver -> adapter
 *   -> task (stored on AgentTask.traceId) -> worker -> adapter
 *   -> trigger firing -> task -> worker
 *
 * When an OpenTelemetry tracer provider is registered (Sentry's server SDK
 * registers one), the trace id of the active span is reused, so ledger
 * events, logs and Sentry traces share one id. Otherwise a fresh random id
 * is generated. Trace ids are correlation data only: never an
 * authorization input, never client-supplied (inbound `traceparent`
 * headers are not trusted).
 */
import { AsyncLocalStorage } from "node:async_hooks"
import { randomBytes } from "crypto"
import { trace } from "@opentelemetry/api"

export interface AgentTraceContext {
  traceId: string
  /** The gateway request id the operation started from (task workers keep the task's). */
  requestId?: string
  /** Set while a task attempt runs. */
  taskRef?: string
  /** Set while a trigger fires. */
  triggerRef?: string
}

const TRACE_ID = /^[0-9a-f]{32}$/
const INVALID_TRACE_ID = "0".repeat(32)
const storage = new AsyncLocalStorage<AgentTraceContext>()

export function isValidTraceId(value: unknown): value is string {
  return typeof value === "string" && TRACE_ID.test(value) && value !== INVALID_TRACE_ID
}

export function newTraceId(): string {
  for (;;) {
    const id = randomBytes(16).toString("hex")
    if (id !== INVALID_TRACE_ID) return id
  }
}

/** Reuses the active OpenTelemetry span's trace id when there is a recording provider; otherwise a fresh id. */
export function deriveTraceId(): string {
  const active = trace.getActiveSpan()?.spanContext().traceId
  return isValidTraceId(active) ? active : newTraceId()
}

export function currentTraceContext(): AgentTraceContext | undefined {
  return storage.getStore()
}

/** Runs `fn` inside a new correlation scope. */
export function runWithTraceContext<T>(context: AgentTraceContext, fn: () => T): T {
  const traceId = isValidTraceId(context.traceId) ? context.traceId : newTraceId()
  return storage.run({ ...context, traceId }, fn)
}

/** Runs `fn` with extra correlation fields on top of the current scope (keeps its trace id). */
export function withTraceFields<T>(fields: Omit<Partial<AgentTraceContext>, "traceId">, fn: () => T): T {
  const parent = storage.getStore()
  return storage.run({ ...(parent ?? { traceId: newTraceId() }), ...stripUndefined(fields) }, fn)
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [key, v] of Object.entries(value)) if (v !== undefined) (out as Record<string, unknown>)[key] = v
  return out
}
