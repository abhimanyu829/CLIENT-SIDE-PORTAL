# 07 — Future Phase Contract (Phase 1)

Contracts Phase 1 freezes for later phases. Later phases build ON these; they do not
replace them.

## 1. Identity contract

```
Abhibhi Subscription ID (cuid, PK)
        ↓ maps to (optional, unique, per-provider)
stripeSubId | razorpaySubId | <future provider ref>
```
Never invert. Provider IDs are references, never identities.

## 2. Creation contract

New subscription records are created through
`createFoundationSubscription(input)` (`lib/services/subscription-domain.ts`):
- Strict zod input (unknown keys rejected).
- Controlled `source` (CHECKOUT | STRIPE_WEBHOOK | RAZORPAY_WEBHOOK | ADMIN | SYSTEM).
- Controlled `environment` (development | test | production), server-derived by default.
- Initial status ∈ {TRIALING, ACTIVE}.
- Referential integrity verified (owner exists+not banned, product exists, tier belongs
  to product and is active).
Provider-specific creation (Razorpay recurring, etc.) = a later phase WRAPPING this
contract, not bypassing it.

## 3. Transition contract

All status changes go through the state machine
(`subscription-state-machine.ts`). Two APIs:
- `transitionSubscriptionStatus(id, expectedFrom, to, actorId, reason)` — CAS, audited,
  idempotent, conflict-throwing. Preferred for new code.
- Existing `subscription-service.ts` functions — now internally guarded (soft-skip +
  warn). Signatures unchanged.

Adding new states later = extend `SubStatus`, extend `SUBSCRIPTION_TRANSITIONS`, add
migration for the enum value. Never bypass the table.

## 4. Read contract

`getSubscriptionForOwner(subscriptionId, ownerId)` — owner-scoped, anti-enumeration.
Later provider phases must not introduce an unscoped read for external callers.

## 5. Environment contract

Provider phases MUST filter/couple by `environment` when mapping provider state
(e.g. test-mode Razorpay webhooks only touch `environment = "development" | "test"`
records). The column exists precisely for that.

## 6. Explicit non-contracts (NOT built, NOT promised)

Entitlement engine for subscriptions beyond the existing sync, free-forever tier,
14-day trials, upgrade/downgrade proration, renewal billing, reconciliation,
subscription analytics, plan catalogs. Each is a later-phase decision.
