# 13 — Database Verification (Phase 4)

## Migrations applied (2026-10-09, live Supabase)

1. `20261008030000_razorpay_recurring_billing` — PlanMappingStatus +
   SubscriptionChargeStatus enums, `RazorpayPlanMapping`, `SubscriptionCharge`.
2. `20261008030100_recurring_charges_on_user_subscription` — re-pointed the
   brand-new `SubscriptionCharge` FK from Stack-A `Subscription` to Stack-B
   `UserSubscription` (the correct billing record for plan-based recurring
   subscriptions), plus additive `UserSubscription.planVersionId` /
   `.environment` and an index.

## Post-apply checks

- `prisma migrate diff` against live: only the pre-existing legacy `Catalog*`
  delta remains — zero Phase-4 drift.
- Tables/columns verified live:

```
RazorpayPlanMapping: planVersionId, razorpayPlanId, environment, amountSubunits … ok
SubscriptionCharge:  subscriptionId, razorpayPaymentId, chargeStatus … ok
UserSubscription:    planVersionId, environment … ok
```

## Existing-data integrity (live counts)

orders 27, payments 97, Subscription (Stack A) 22, PlanVersion 2,
EntitlementGrant 2 (previous live verification data), UserSubscription 0,
RazorpayPlanMapping 0, SubscriptionCharge 0, WebhookEvent 0.

## Limits

- No real charging in tests (provider mocked).
- A live TEST-MODE merchant round-trip must be completed manually against a
  TEST-MODE Razorpay account; the schema and every offline verification path
  are already proven.