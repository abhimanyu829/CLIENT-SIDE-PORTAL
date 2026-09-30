# Phase 4 — Capability -> Adapter -> Existing Service Map

| Capability | Adapter | adapterKey (Phase 3 executionReference) | Existing service invoked |
|---|---|---|---|
| `products.list@v1` | `ProductsListAdapter` | `products.listAdapter` | `db.product.findMany` — same query shape as `app/api/products/route.ts` GET |
| `products.get@v1` | `ProductsGetAdapter` | `products.getAdapter` | `db.product.findUnique` — same model as `app/api/products/[slug]/route.ts` GET, keyed by `id` instead of `slug` |
| `subscriptions.get@v1` | `SubscriptionsGetAdapter` | `subscriptions.getAdapter` | `db.subscription.findUnique` + ownership check — the same pattern already duplicated across `app/api/subscriptions/[id]/{cancel,pause,resume,upgrade,downgrade}/route.ts` |
| `tickets.list@v1` | `TicketsListAdapter` | `tickets.listAdapter` | `db.ticket.findMany` — same model as `app/api/tickets/route.ts` GET, but unconditionally owner-scoped |
| `products.createDraft@v1` | **none** | `products.createDraftAdapter` (declared, unbound) | `createProduct` Server Action — **NOT_EXECUTABLE_YET**, see `04-existing-service-mapping.md` |
| `coupons.create@v1` | **none** | `coupons.createAdapter` (declared, unbound) | `createCoupon` Server Action — **NOT_EXECUTABLE_YET**, see `04-existing-service-mapping.md` |
| `products.updatePricing@v1` | **none** | `null` (Phase 3 already set this) | `updateTier` — exposure is `INTERNAL_ONLY`, correctly not agent-available |
| `refunds.process@v1` | **none** | `null` (Phase 3 already set this) | `processRefund` — exposure is `FORBIDDEN`, permanently excluded |

## Registration

`lib/agent-gateway/execution/adapters/index.ts`'s `registerCoreAdapters()` registers exactly the 4 adapters in the first table above into an `AdapterRegistry`. This is the execution-layer analog of Phase 3's `registerCoreCapabilities()` — same trust boundary (module-init-time only, never reachable from a request handler), same fail-closed behavior (any single adapter failing to register throws for the whole load, per `AdapterRegistry.register()`'s duplicate-rejection check).

## Why only 4 of the 6 AGENT_AVAILABLE capabilities have an adapter

Phase 3 marked 6 capabilities `exposure: AGENT_AVAILABLE` (the READ tier's 4, plus `products.createDraft` and `coupons.create`). The Phase 4 Step 0 audit found that the two LOW_RISK_WRITE capabilities' real implementations (`createProduct`, `createCoupon`) are Next.js Server Actions whose entire body is gated by `requireAdmin()`, which:

1. requires a real Clerk human session (`auth()` -> `currentUser()`),
2. calls `next/navigation`'s `redirect()` on any authorization failure rather than returning or throwing a catchable, structured error,
3. reads real HTTP request `headers()` (`x-nexusai-admin-permission-scope`, etc., set by the admin reverse proxy) to enforce the SUB_ADMIN permission matrix.

A repository-wide search for any service-principal, delegated-identity, or system-actor pattern (`servicePrincipal`, `systemActor`, `machineActor`, `SYSTEM_USER`, `delegatedAdmin`, `actingAs`) returned zero matches. There is no supported way today to construct a "trusted machine principal" that `requireAdmin()` would accept — and the spec explicitly forbids faking a human admin session or building a new delegation mechanism as part of a "thin adapter." Both capabilities are therefore intentionally left with **no registered adapter** — `AdapterResolver.execute()` fails closed with `ADAPTER_NOT_FOUND` for either one (verified by test, see `11-test-report.md`), which is the correct, safe outcome, not a bug.

This is documented in depth, including the exact blocking code path, in `04-existing-service-mapping.md`.
