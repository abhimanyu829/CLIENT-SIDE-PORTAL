# 01 — Razorpay Architecture (Phase 4)

## Position in the platform

Phase 4 connects the published plan catalog to Razorpay Subscriptions for
RECURRING billing only. The standalone purchase system, the one-time Razorpay
flow, and Phases 1-3 are untouched.

```
PUBLISHED PlanVersion (Phase 2)   ← commercial truth
        ↓ ensureRazorpayPlanMapping
RazorpayPlanMapping               ← external provider reference (env-scoped)
        ↓ createRecurringSubscription
UserSubscription (Stack B)        ← internal subscription record (existing model)
        ↓ webhooks (new endpoint, signed)
guarded lifecycle + SubscriptionCharge (idempotent)   ← billing, NOT entitlements
        ↓ internal events (existing event-bus)
Phase 5 provisioning contract (not implemented)
```

## Files

- `lib/services/razorpay-billing.ts` — mapping, creation, checkout verification,
  cancel/pause/resume, provider-state mapping, money safety.
- `lib/services/razorpay-subscription-webhook.ts` — raw-body signature verify,
  durable inbox (existing `WebhookEvent`, `WebhookSource.RAZORPAY`), event
  lifecycle, idempotent charge recording, out-of-order protection.
- `app/api/webhooks/razorpay/subscriptions/route.ts` — dedicated endpoint.
- Schema: `RazorpayPlanMapping`, `SubscriptionCharge`, 2 enums; additive
  columns `UserSubscription.planVersionId` / `.environment`.

## Independent concepts kept separate

PlanVersion (commercial config) ≠ RazorpayPlanMapping (provider ref) ≠
UserSubscription (internal record) ≠ SubscriptionCharge (billing event) ≠
Entitlement (customer access, Phase 3/5). provider subscription id is never a
primary key.

## Boundaries respected

Implemented: billing backend + tests. NOT implemented: entitlement
provisioning, free/trial engines, customer/admin UI, upgrade/downgrade,
reconciliation framework, replacing checkout/order/one-time flow.