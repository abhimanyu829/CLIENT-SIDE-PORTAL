# Phase 11 — 04 Tracing

`observability/tracing.ts` creates spans through the standard `@opentelemetry/api` (pinned `1.9.1`, already present through `@sentry/nextjs`, whose v8+ SDK is OpenTelemetry-based). With Sentry's server SDK initialised the spans become Sentry spans; without it (tests, a worker without Sentry) they are no-ops. No second tracing system or exporter was introduced.

## Span vocabulary (closed)

`agent.request`, `agent.authentication` (reserved), `agent.authorization`, `agent.approval` (reserved), `agent.execution`, `agent.business_service`, `agent.task` (reserved), `agent.worker`, `agent.trigger`, `agent.recovery`.

| Span | Opened by |
|---|---|
| `agent.request` | `withRequestTrace` (MCP route handler, HTTP boundary) |
| `agent.authorization` | `ExecutionGate.grant` / `evaluatePolicy` (reason = purpose: decision / revalidation / result_read) |
| `agent.execution` | `AdapterResolver.execute` |
| `agent.business_service` | around `adapter.execute()` only |
| `agent.worker` | `AgentTaskWorker.process` |
| `agent.trigger` | `TriggerRuntime` firing |
| `agent.recovery` | `RecoveryService` |

## Attribute allowlist

Only: `agent.protocol`, `agent.request.id`, `agent.connection.id`, `agent.capability.id`, `agent.capability.version`, `agent.risk_tier`, `agent.environment`, `agent.outcome`, `agent.reason_code`, `agent.error_code`, `agent.task.ref`, `agent.trigger.ref`, `agent.trigger.source`, `agent.attempt`, `agent.autonomy.level` (+ `abhibhi.trace_id`). Unknown keys are dropped; string values must match `[A-Za-z0-9_.:@/-]{0,128}` or become `"redacted"`. Never input, output, owner ids, emails, tokens or free text (tested against a real call).

Exceptions are never recorded on a span (messages can carry detail); only a stable error code (`[A-Z][A-Z0-9_]+`, else `INTERNAL_ERROR`).

## Telemetry can never change the operation

`withAgentSpan` treats the operation's own promise as authoritative:

- tracer throws before running the callback → the operation runs once, untraced;
- tracer throws after the operation settled → the caller still gets the operation's result / error (no second run);
- `setStatus` / `setAttribute` / `end` failures are swallowed;
- a span observer that throws is isolated.

All four are tested (`p11-failures.test.ts`, "telemetry failures").

`addSpanObserver()` is a diagnostics / test hook receiving every finished span record (name, trace id, sanitized attributes, status, error code, duration); nothing is registered in production by default.
