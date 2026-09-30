# Phase 3 — Risk & Side-Effect Metadata

## Risk tier: reused verbatim from Phase 0

`operationType: RiskTier` is exactly Phase 0's four values (`READ`, `LOW_RISK_WRITE`, `HIGH_RISK_MUTATION`, `CRITICAL`) as defined in `docs/agent-gateway/phase-0/RISK-MATRIX.md`. No second, conflicting risk system was introduced — this was an explicit spec requirement ("reuse Phase 0 classifications wherever possible").

## Permission metadata: reused from existing RBAC, never invented

`permission.permission` is either:
- a literal string from `lib/permissions.ts`'s `PERMISSIONS` constants (e.g. `"read:products"`, `"write:products"`, `"read:billing"`, `"read:tickets"`), or
- `null`, with a `note` explaining the gap.

The `coupons.create` capability is the one case in the initial manifest with `permission: null` — there is no existing `lib/permissions.ts` constant covering marketing/coupons. The `note` field documents this explicitly (`"No existing lib/permissions.ts constant covers coupons; Phase 6 must define one rather than this registry inventing it."`) rather than silently inventing a new permission name that could conflict with future RBAC additions.

`refunds.process` (the `FORBIDDEN` example) also has `permission: null` — by design, since it is a human-only, financial-settlement operation that should never be assigned an agent-facing permission at all.

## Side-effect metadata: descriptive, not a new event architecture

`sideEffects.effects` is a plain array of human-readable strings (e.g. `"database write (Product, ProductVersion, AuditLog)"`, `"external payment-gateway money movement"`). `emitsEvents`/`triggersRevalidation` mirror the EXISTING event-bus (`lib/services/event-bus.ts`'s `EVENTS` constants) and revalidation mechanism (Next.js `revalidateTag`/`revalidatePath`, as used by `app/(admin)/admin/products/actions.ts`'s `revalidateProductCaches()`) — no new event bus, no new cache-invalidation mechanism was built.

**Note on the dangerous-primitive guard's scope**: the guard deliberately does NOT scan `sideEffects.effects` (only `id`, `domain`, and `executionReference.adapterKey`). Free-text descriptions of consequences legitimately use words like "database write" as prose, and scanning them would produce false positives against the guard's own token list (which includes `database`) — this was confirmed by a dedicated test (`dangerous-primitive-guard.test.ts`: "does not false-positive on legitimate descriptive side-effect text mentioning 'database write'").

## Idempotency metadata: mirrors Phase 0's `IDEMPOTENCY-MATRIX.md` per capability

Each capability's `idempotency` block reflects the REAL, already-documented behavior of its underlying service, not an aspiration:

- `products.list`/`products.get`/`subscriptions.get`/`tickets.list` — `class: "IDEMPOTENT"`, `retrySafe: true` (pure reads).
- `products.createDraft` — `class: "NON_IDEMPOTENT"`, `requiresIdempotencyKey: true` — a naive retry would create a second draft with a conflicting slug.
- `products.updatePricing` — `class: "NON_IDEMPOTENT"`, flags that a retry with a *different* intended price after a timeout could apply the wrong value once Phase 4 wires real execution.
- `refunds.process` — explicitly documents that "no gateway-side idempotency key exists on the real `processRefund` implementation — a retry could double-refund," directly citing Phase 0's `BUG-BASELINE #14`. This is one of the two independent reasons `refunds.process` is `FORBIDDEN` (the other being the permanent architectural exclusion for money-movement operations).

## Async metadata

All eight initial capabilities declare `executionMode: "SYNC"` — none of them are wired to BullMQ (`queue`/`worker` fields are unused in the initial manifest). The type model supports `ASYNC` with `queue`/`worker`/`expectedDurationMs`/`pollingSupported` for a future capability like `deployments.createDeployment`, but none is registered yet since Phase 0's capability matrix classifies deployment lifecycle actions as `AI_APPROVAL_REQUIRED_CANDIDATE` (HIGH_RISK_MUTATION), and the initial manifest intentionally keeps its HIGH_RISK_MUTATION example (`products.updatePricing`) minimal rather than adding a second, async one.

## Rollback metadata

Directly mirrors Phase 0's `IDEMPOTENCY-MATRIX.md` rollback column:

| Capability | Reversibility | Mechanism |
|---|---|---|
| `products.createDraft` | REVERSIBLE | Delete the draft (`products.delete`, not yet registered) |
| `coupons.create` | REVERSIBLE | Delete the coupon (`coupons.delete`, not yet registered) |
| `products.updatePricing` | REVERSIBLE | Admin manually re-sets the previous price; `PricingHistory` provides an audit trail but no auto-revert |
| `refunds.process` | IRREVERSIBLE | None — a refund is terminal |
