# 06 — Webhook Lifecycle (Phase 4)

## Supported events → internal state (conditional on valid transitions)

| Razorpay event | Internal SubscriptionStatus | Side effects |
|---|---|---|
| subscription.authenticated | (no change; stays TRIALING) | none — checkout only |
| subscription.activated | TRIALING→ACTIVE | period fields, emit ACTIVATED |
| subscription.charged | per entity status | idempotent SubscriptionCharge, emit CHARGE_SUCCEEDED/FAILED |
| subscription.pending | →UNPAID | PENDING charge record |
| subscription.halted | →PAST_DUE | emit HALTED |
| subscription.paused | →PAUSED | emit PAUSED |
| subscription.resumed | →ACTIVE | period fields, emit REACTIVATED |
| subscription.cancelled | →CANCELED | emit CANCELLED |
| subscription.completed / expired | →EXPIRED (terminal) | emit STATE_CHANGED |
| subscription.updated | mapped from entity status | guarded; emit STATE_CHANGED |

## Guarded transitions

`applyProviderStatus` is compare-and-set against the CURRENT internal status:
same-status = no-op; illegal transition (stale event) = recorded
(`metadata.lastProviderConflict`) and NOT applied — a stale ACTIVATED can never
revive a CANCELLED or EXPIRED subscription, and an older event can never
overwrite newer valid provider state.

## Billing only

No event grants, extends, revokes or provisions entitlements. Phase 5 listens to
the emitted internal events (existing `event-bus`) to provision access.

## Charge records

`subscription.charged` records one `SubscriptionCharge` per unique
`razorpayPaymentId` (and `providerEventId`). Duplicate deliveries and
same-payment-different-event deliveries collapse to one charge. Amount/currency
come from the authenticated provider payload only.