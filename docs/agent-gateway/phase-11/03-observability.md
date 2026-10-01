# Phase 11 — 03 Observability

Three signals, deliberately separate:

| Signal | Purpose | Store | Docs |
|---|---|---|---|
| Ledger events | evidence (who / what / under which policy) | Postgres `AgentAuditEvent` | `01`, `02` |
| Spans | where time went, which layer failed | OpenTelemetry API → Sentry (when initialised) | `04` |
| Metrics | rates, latencies, saturation | process-local registry | `05` |
| Logs | operations detail | existing pino `gatewayLogger` (unchanged) | — |

## Correlation

One `traceId` (W3C trace-id: 32 lowercase hex, never all-zero) per agent operation, carried by an `AsyncLocalStorage` scope (`observability/trace-context.ts`):

```
MCP / HTTP request ─ withRequestTrace(protocol, requestId)       (route handler, http boundary)
  └ gate (agent.authorization) ─ resolver (agent.execution) ─ adapter (agent.business_service)
  └ task submission → AgentTask.traceId (stored)
        └ worker attempt: runWithTraceContext({ traceId: task.traceId, requestId, taskRef })
webhook delivery ─ runWithTraceContext(deriveTraceId())
  └ trigger firing (triggerRef) → task (traceId stored) → worker → adapter
schedule tick / event → trigger firing → new trace per firing
recovery ─ new trace unless already inside one
```

- One **requestId** per request: Phase 11 threads the pipeline's id into `buildRequestContext` (previously the context minted a second id); error bodies, logs, spans and ledger events now agree.
- When Sentry's server SDK has registered an OpenTelemetry provider, the active span's trace id is reused, so ledger rows, logs and Sentry traces share one id; otherwise a random id is generated.
- Inbound `traceparent` headers are **not trusted**: a trace id is correlation data, never an authorization input, never client-chosen (tested).
- The recorder fills `traceId`, `requestId`, `taskRef`, `triggerRef` from the scope when the caller did not set them; explicit values win.

Verified end to end (`p11-observability.test.ts`): request → gate → resolver → adapter spans share the request trace; a submitted task stores it; the worker, running later outside any request scope, continues it (spans and ledger rows carry the same trace id, the original request id and the task ref); a webhook delivery's trace reaches the task's execution.

## Administrator surfaces

- `/admin/agent-governance/ledger` — events newest first, filter by category, and (by link) connection, capability, task or trace; digests shown as prefixes; chain verification button.
- `/admin/agent-governance/recoveries` — recovery requests and outcomes.
- `/admin/agent-governance/runtime` — now also lists circuit breakers that are not closed (process-local).

Durable, cross-instance health (Phase 15 health gates) is computed from Postgres (ledger + `AgentTask`), not from process-local metrics or breakers.
