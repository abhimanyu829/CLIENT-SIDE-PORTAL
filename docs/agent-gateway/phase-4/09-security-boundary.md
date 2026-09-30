# Phase 4 — Security Boundary

## The 9 hard execution-safety checks (`hard-safety-checks.ts`)

Explicitly NOT the Phase 6 policy/ABAC engine — structural safety checks only, run in order, failing closed on the first violation:

| # | Check | Enforced by |
|---|---|---|
| 1 | Capability must exist | `capabilityRegistry.resolve()` -> `CAPABILITY_NOT_FOUND` mapped to `RESOURCE_NOT_FOUND` |
| 2 | Capability must be executable (not `FORBIDDEN`) | `resolveExecutionTarget()` explicit exposure check -> `FORBIDDEN` |
| 3 | Capability must be enabled (not `DISABLED`) | `resolveExecutionTarget()` status check -> `EXECUTION_UNAVAILABLE` |
| 4 | Adapter must be registered | `adapterRegistry.get()` returning null -> `ADAPTER_NOT_FOUND` |
| 5 | Adapter mapping must be valid | Structural comparison of `adapter.capabilityId`/`capabilityVersion` against the resolved definition |
| 6 | Input must conform to schema | Delegated to `capabilityRegistry.validateInput()` — Phase 3's OWN validator, never reimplemented |
| 7 | Environment must match | `assertEnvironmentMatches()` — connection's recorded environment vs. gateway's configured environment |
| 8 | Machine identity must be valid | `gatewayContext.machine` presence + `connectionStatus === "ACTIVE"` check |
| 9 | Adapter must invoke only its explicitly bound service | Enforced structurally — there is no dynamic dispatch anywhere in this module for any code path to bypass; every adapter is a hardcoded class with one `execute()` method calling one Prisma model |

Additionally, exposure other than `AGENT_AVAILABLE` (e.g. `INTERNAL_ONLY`) is rejected with `NOT_EXECUTABLE_YET` — this is the mechanism that keeps `products.updatePricing` unreachable even though it has a fully valid, well-formed Phase 3 definition.

## Forbidden generic operations — structurally impossible, not just policy-forbidden

- **Arbitrary adapter invocation**: `AdapterRegistry` has no `invoke()`/`execute()` method taking an adapter name — only `get(capabilityId, version)`, and the only caller of that is the resolver itself, driven by the ALREADY-resolved Phase 3 capability. Verified by test.
- **Arbitrary function/route injection**: a capability reference like `"global.process.exit"` or `"/api/admin/users/delete"` is rejected by Phase 3's own `assertValidCapabilityId` (`RESOURCE_NOT_FOUND` — the string simply never matches a registered id). Verified by test.
- **Direct Prisma/raw SQL from a request**: no adapter accepts a query string, a `where` clause, or any Prisma-shaped object as input — every adapter's `TInput` type is a small, fully-typed interface (`{ id: string }`, `{ subscriptionId: string }`, etc.). A SQL-injection-shaped string passed as a legitimate field value (e.g. `products.get`'s `id`) is treated as an opaque string and passed to Prisma's own parameterized query — never concatenated, never executed as SQL. Verified by test.
- **Cross-tenant access**: every ownership-sensitive adapter (`subscriptions.get`, `tickets.list`) uses `context.ownerId` — the trusted Phase 2 identity — and NEVER any request-body field. A forged `ownerId`/`teamId`/`agentId` in the input is rejected outright by the capability's own `.strict()` zod schema (these fields aren't declared, so they're unknown fields -> `INVALID_INPUT`) before the adapter is ever reached. Verified by test.
- **Capability/adapter substitution**: there is no execution path that accepts an adapter identifier independent of the resolved capability — the resolver always derives the adapter strictly from the RESOLVED definition's own `(id, version)`. Verified by test.
- **Environment bypass**: no capability's input schema has an `environment` field — a caller cannot smuggle one in (rejected as an unknown field by the `.strict()` schema before the environment check even runs). Verified by test.
- **Disabled/high-risk-guard bypass**: `resolveExecutionTarget()` re-checks `status`/`exposure` on every single call, including for an explicit `@vN` reference — there is no "backdoor" resolution path that skips these checks. Verified by test.
- **Unauthorized async job creation**: structurally impossible in this phase — no registered adapter has `executionMode: "ASYNC"`, so there is no queue-enqueue code path to reach at all. Verified by test.

## Dangerous primitives search (new Phase 4 code)

Manually reviewed every file under `lib/agent-gateway/execution/` for: `eval(`, `new Function(`, `child_process`, `exec(`, `spawn(`, raw `$queryRaw`/`$executeRaw`, `require(` with a variable argument, dynamic `import()` with a variable argument, `fetch(` to an unbounded/caller-supplied URL, `fs.` filesystem access, `process.env` access. **None found.** Every database call is a fixed-shape, statically-known Prisma model method (`db.product.findMany`, `db.product.findUnique`, `db.subscription.findUnique`, `db.ticket.findMany`) with parameterized (never string-concatenated) `where`/`select` values.

## Data exposure boundary (Phase 0's `DATA-SENSITIVITY-MATRIX.md`, applied)

Every adapter's Prisma `select` is an explicit allowlist. Confirmed excluded across all 4 adapters: `deliveryConfig`, `commerceConfig`, `aiConfig`, `embedding` (Product); `stripeSubId`, `razorpaySubId`, `metadata` (Subscription); `assignedTo` (Ticket). None of these ever appear in any adapter's output, verified by dedicated tests per adapter (e.g. "does not query/return stripeSubId, razorpaySubId, or metadata").
