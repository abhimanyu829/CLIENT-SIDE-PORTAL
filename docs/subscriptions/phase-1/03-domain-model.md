# 03 — Domain Model (Phase 1)

## Schema changes (additive, zero new tables)

Migration `20261008000000_subscription_domain_foundation`:

```sql
CREATE TYPE "SubscriptionSource" AS ENUM
  ('CHECKOUT', 'STRIPE_WEBHOOK', 'RAZORPAY_WEBHOOK', 'ADMIN', 'SYSTEM');
ALTER TABLE "Subscription" ADD COLUMN "source" "SubscriptionSource";   -- nullable
ALTER TABLE "Subscription" ADD COLUMN "environment" TEXT;              -- nullable
```

NULL on both = legacy row created before Phase 1. Existing 22 rows untouched.

## Identity

- Primary key: internal cuid (`Subscription.id`). Never a provider ID.
- External refs: `stripeSubId? @unique`, `razorpaySubId? @unique` (pre-existing, kept).
- Foundation `externalReference` goes into `metadata.externalReference` — NOT a provider column.

## State model (`SubStatus`, reused — no new enum)

```
TRIALING  → ACTIVE | PAST_DUE | PAUSED | CANCELLED
ACTIVE    → PAST_DUE | PAUSED | CANCELLED
PAST_DUE  → ACTIVE | PAUSED | CANCELLED
PAUSED    → ACTIVE | PAST_DUE | CANCELLED
CANCELLED → ACTIVE            (terminal; explicit reactivation only)
```
Same-state transitions always allowed (idempotent no-op).
Initial status for new records: TRIALING or ACTIVE only.
`CANCELLED → PAST_DUE` deliberately blocked (late "payment failed" webhook cannot
revive a cancelled subscription). This is the one intentional behaviour change.

## Controlled provenance

`SubscriptionSource`: CHECKOUT | STRIPE_WEBHOOK | RAZORPAY_WEBHOOK | ADMIN | SYSTEM.
Tagged at all three creation sites. Server-controlled; never from request bodies.

## Environment

`environment: String?` — exactly one of `development` | `test` | `production`
(validated by `normalizeSubscriptionEnvironment`). Derived server-side via
`currentSubscriptionEnvironment()` (maps NODE_ENV). Provider-independent label;
future provider phases use it for isolation.

## Code modules

| Module | Role |
|---|---|
| `subscription-state-machine.ts` | Pure transition table + validation. No I/O. |
| `subscription-domain.ts` | Foundation: validated create, ownership-checked read, CAS transition. |
| `subscription-service.ts` | Existing lifecycle (guarded in Phase 1). Single mutation source of truth. |
