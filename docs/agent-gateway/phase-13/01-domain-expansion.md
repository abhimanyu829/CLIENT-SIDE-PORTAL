# Phase 13 — 01 Domain expansion

Phase 13 widens what agents can do in five business domains (products, marketing, subscriptions, support, analytics) without adding a subsystem. Every new capability is a Phase 3 manifest entry, a Phase 4 adapter that traces to an existing route or model, and nothing else: discovery (Phase 5), authorization (Phase 6), autonomy and approval (Phase 7), tasks (Phase 8), triggers (Phase 9), governance (Phase 10), evidence and recovery (Phase 11) and the content guard (Phase 12) apply unchanged.

## Rules applied to every capability

1. Traceable: the adapter performs the same query or write as an existing route (named in its header), never a new business rule.
2. Owner-scoped from the verified identity (`context.ownerId`); never from input. Not-found and not-owned are the same `RESOURCE_NOT_FOUND`.
3. Explicit selects and explicit mapping; closed (`.strict()`) input and output schemas with bounded lists; closed enums for filters.
4. Declared content trust (`THIRD_PARTY_CONTENT` whenever any string can be authored by a user, vendor or admin).
5. Honest readiness: an operation without a safe existing path is `NOT_READY` with its blocker (`07-capability-map`), never a stub.

## What was added

| Capability | Tier | Domain | Traces to |
|---|---|---|---|
| `products.listMine` | READ | products | vendor ownership `VendorProfile.userId` → `Product.vendorId` |
| `campaigns.getActive` | READ | marketing | `app/api/campaigns/active` (public) |
| `subscriptions.list` | READ | subscriptions | Subscription ownership (as `subscriptions.get`) |
| `tickets.get` | READ | support | client branch of `GET /api/tickets/[id]` |
| `tickets.create` | LOW_RISK_WRITE | support | `POST /api/tickets` |
| `tickets.close` | LOW_RISK_WRITE | support | client branch of `PATCH /api/tickets/[id]` |
| `analytics.summary` | READ | analytics | KPIs of `app/api/analytics`, owner-restricted |
| `analytics.productPerformance` | READ | analytics | `PlatformMetricEvent` funnel of one owned product |

## Platform changes needed by the first writes

- Synchronous idempotency key: `params._meta["abhibhideveloper.online/idempotency-key"]` on `tools/call` (`mcp/request-meta.ts`). It is not a tool argument, so it changes neither the Phase 3 schema nor the approval binding digest. A keyed capability called without a key is refused before the gate (`IDEMPOTENCY_KEY_REQUIRED`), so no approval or task is created for a call that cannot run.
- Reserved key prefixes: `trigger.` (Phase 9) and now `recovery.` (Phase 11 recovery executions) cannot be chosen by an agent on either the sync or the task path (`isReservedIdempotencyKey`).
- Manifest lock updated (16 capabilities, fingerprint `e9abf0b9e9e02054614c8bbeea6ada7bffa26a81825b2ee8d789c1cbb80a601c`).

## Idempotency guarantees, stated precisely

- Task path (`agent_task_submit` + `idempotencyKey`): durable, enforced by the unique `AgentTask.idempotencyScope`. Recommended for writes.
- Sync path (`_meta` key): the Phase 4 replay cache in Redis (10 minutes, per connection and capability). As designed in Phase 4 it was best-effort and failed open when Redis was unavailable. Since the post-Phase-15 fix it fails closed instead (`EXECUTION_UNAVAILABLE`, nothing runs) and reserves the key atomically, so a concurrent duplicate gets `IDEMPOTENCY_CONFLICT` (`../known-issues-resolution.md`).
