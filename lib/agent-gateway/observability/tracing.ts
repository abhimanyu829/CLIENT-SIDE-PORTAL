/**
 * lib/agent-gateway/observability/tracing.ts
 *
 * Phase 11 — spans through the standard OpenTelemetry API.
 *
 * The repository's observability stack is Sentry (OpenTelemetry-based since
 * SDK v8) plus pino. Spans created here through `@opentelemetry/api` become
 * Sentry spans when Sentry's server SDK is initialised (instrumentation.ts)
 * and are no-ops otherwise (tests, a worker process without Sentry). No
 * second tracing system is introduced.
 *
 * Span names follow one closed vocabulary (agent.request, agent.execution,
 * ...). Attributes are ALLOWLISTED: identifiers, risk tier, outcome and
 * error codes only — never input, output, tokens, owner ids, emails or
 * free text. Exceptions are never attached (messages could carry detail);
 * only a stable error code is.
 */
import { SpanStatusCode, trace } from "@opentelemetry/api"
import { currentTraceContext } from "./trace-context"

export type AgentSpanName =
  | "agent.request"
  | "agent.authentication"
  | "agent.authorization"
  | "agent.approval"
  | "agent.execution"
  | "agent.business_service"
  | "agent.task"
  | "agent.worker"
  | "agent.trigger"
  | "agent.recovery"

export type SpanAttributeInput = Record<string, string | number | boolean | null | undefined>

const ALLOWED_ATTRIBUTES = new Set([
  "agent.protocol",
  "agent.request.id",
  "agent.connection.id",
  "agent.capability.id",
  "agent.capability.version",
  "agent.risk_tier",
  "agent.environment",
  "agent.outcome",
  "agent.reason_code",
  "agent.error_code",
  "agent.task.ref",
  "agent.trigger.ref",
  "agent.trigger.source",
  "agent.attempt",
  "agent.autonomy.level",
])

const SAFE_VALUE = /^[A-Za-z0-9_.:@/-]{0,128}$/

export interface SpanRecord {
  name: AgentSpanName
  traceId: string | null
  attributes: Record<string, string | number | boolean>
  status: "OK" | "ERROR"
  errorCode?: string
  durationMs: number
}

type SpanObserver = (record: SpanRecord) => void
const observers = new Set<SpanObserver>()

/** Diagnostics/test hook: receives every finished agent span (never in the hot path unless registered). */
export function addSpanObserver(observer: SpanObserver): () => void {
  observers.add(observer)
  return () => observers.delete(observer)
}

export function sanitizeSpanAttributes(input: SpanAttributeInput): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_ATTRIBUTES.has(key) || value === null || value === undefined) continue
    if (typeof value === "number") {
      if (Number.isFinite(value)) out[key] = value
      continue
    }
    if (typeof value === "boolean") {
      out[key] = value
      continue
    }
    out[key] = SAFE_VALUE.test(value) ? value : "redacted"
  }
  return out
}

function errorCodeOf(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? code : "INTERNAL_ERROR"
}

function notify(record: SpanRecord): void {
  for (const observer of observers) {
    try {
      observer(record)
    } catch {
      // Observers can never affect the traced operation.
    }
  }
}

/** Runs `fn` inside an agent span. Telemetry failures never change the operation's result. */
export async function withAgentSpan<T>(name: AgentSpanName, attributes: SpanAttributeInput, fn: () => Promise<T>): Promise<T> {
  // The operation's own promise is authoritative: whatever the tracer does
  // (throw before, during or after the callback), the caller receives
  // exactly the operation's result or error, and the operation runs once.
  const holder: { operation: Promise<T> | null } = { operation: null }
  const run = () => {
    holder.operation = fn()
    return holder.operation
  }
  try {
    return await startSpan(name, sanitizeSpanAttributes(attributes), run)
  } catch {
    if (holder.operation === null) return fn() // the tracer failed before the operation started: run it untraced
    return holder.operation
  }
}

function startSpan<T>(name: AgentSpanName, safe: Record<string, string | number | boolean>, fn: () => Promise<T>): Promise<T> {
  const traceId = currentTraceContext()?.traceId ?? null
  const startedAt = performance.now()
  const tracer = trace.getTracer("abhibhi.agent-gateway", "11")
  return tracer.startActiveSpan(name, { attributes: { ...safe, ...(traceId ? { "abhibhi.trace_id": traceId } : {}) } }, async (span) => {
    try {
      const result = await fn()
      try {
        span.setStatus({ code: SpanStatusCode.OK })
      } catch {
        // ignore telemetry failure
      }
      notify({ name, traceId, attributes: safe, status: "OK", durationMs: performance.now() - startedAt })
      return result
    } catch (err) {
      const errorCode = errorCodeOf(err)
      try {
        span.setAttribute("agent.error_code", errorCode)
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorCode })
      } catch {
        // ignore telemetry failure
      }
      notify({ name, traceId, attributes: safe, status: "ERROR", errorCode, durationMs: performance.now() - startedAt })
      throw err
    } finally {
      try {
        span.end()
      } catch {
        // ignore telemetry failure
      }
    }
  })
}
