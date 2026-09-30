# Phase 4 — Error Mapping

## `ExecutionError` — the only error type Phase 4 surfaces

Separate from Phase 3's `CapabilityError` (registry-time: not found, disabled, invalid input shape) and Phase 1's `GatewayError` (HTTP-transport). `ExecutionError` covers what can go wrong DURING execution against a real service.

| Code | Meaning | Where it originates |
|---|---|---|
| `INVALID_INPUT` | Input failed schema validation, or an adapter rejected a value the schema allowed but the real service doesn't support (e.g. `products.list`'s `category`) | `CapabilityRegistry.validateInput()` (wrapped) or an adapter |
| `RESOURCE_NOT_FOUND` | The real service's lookup returned nothing (including "found but not owned," normalized identically) | An adapter |
| `FORBIDDEN` | No/invalid machine identity, connection not ACTIVE, or the capability is permanently `FORBIDDEN` | `hard-safety-checks.ts` |
| `CONFLICT` | A duplicate adapter/definition registration was attempted (module-init-time only) | `AdapterRegistry.register()` |
| `EXECUTION_UNAVAILABLE` | The capability exists but is currently `DISABLED` | `hard-safety-checks.ts` |
| `TIMEOUT` | Reserved — no adapter in this phase has a long-running call that needs it (all 4 are single fast Prisma reads) |  |
| `CANCELLED` | `context.signal.aborted` was true before the adapter's real-service call | Every adapter, checked explicitly |
| `NOT_EXECUTABLE_YET` | The capability's `exposure` is not `AGENT_AVAILABLE` (e.g. `INTERNAL_ONLY`) | `hard-safety-checks.ts` |
| `ENVIRONMENT_MISMATCH` | The connection's recorded environment doesn't match the gateway's configured environment | `hard-safety-checks.ts` |
| `ADAPTER_NOT_FOUND` | No adapter is registered for an otherwise-valid, `AGENT_AVAILABLE` capability | `hard-safety-checks.ts` |
| `IDEMPOTENCY_KEY_REQUIRED` | The capability's Phase 3 metadata requires a key and none was supplied | `AdapterResolver.execute()` |
| `IDEMPOTENCY_CONFLICT` | Reserved — not currently reachable, since the idempotency cache always either misses (proceed) or hits (replay); no distinct "conflict" state exists in the current design |  |
| `INTERNAL_ERROR` | Anything else, including an adapter producing output that fails the resolver's own `outputSchema` re-validation | `toExecutionError()`'s catch-all |

## Real-service error translation table (per the spec's required examples)

| Real condition | Real behavior observed in the audited route/action | `ExecutionError` code |
|---|---|---|
| Product/subscription/ticket not found | 404 JSON (`products/[slug]/route.ts`) or bare `null` (no dedicated subscription route) | `RESOURCE_NOT_FOUND` |
| Subscription not owned by caller | 404 (`cancel`/`resume`) or 403 (`pause`) — inconsistent in the real code | `RESOURCE_NOT_FOUND` (standardized, never leaks existence) |
| Zod/manual validation failure | Manual `if (!x) return 400` in most routes; Phase 3 `.strict()` zod schema at the gateway boundary | `INVALID_INPUT` |
| `requireAdmin()`/`auth()` failure | `redirect()` or 401/403 JSON | Not applicable — these capabilities have no adapter (see `04-existing-service-mapping.md`); the failure never reaches this layer |
| Unexpected Prisma/service exception | Routes `console.error` and return a generic 500 | `INTERNAL_ERROR` — never the raw Prisma error, never a stack trace, never a SQL fragment |

## Never leaked, in any `ExecutionError`

Stack traces, raw Prisma error objects/codes, SQL fragments, payment-gateway internals (unless a future capability's contract explicitly requires one — none does today), secret/credential values, internal file paths. `toExecutionError()` is the single funnel every caught value passes through before ever being thrown further — an adapter that lets an unexpected exception escape still gets normalized to `INTERNAL_ERROR` at this boundary, never the original detail.
