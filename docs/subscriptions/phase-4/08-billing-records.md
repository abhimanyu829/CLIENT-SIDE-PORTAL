# 08 — Billing Records (Phase 4)

## SubscriptionCharge

One row per recurring charge on a `UserSubscription` (Stack B):

| field | source |
|---|---|
| subscriptionId | internal FK (UserSubscription) |
| razorpaySubscriptionId | provider ref (not identity) |
| razorpayPaymentId @unique | dedupe axis |
| providerEventId @unique | dedupe axis |
| amountSubunits / currency | authenticated provider payload only |
| chargeStatus | captured → SUCCEEDED; failed → FAILED; else PENDING |
| billingPeriodStart/End | provider current_start/current_end |

## Rules

- Recurring charges NEVER create `Order`/`OrderItem`/`Invoice` rows — the
  standalone accounting domain stays clean.
- `razorpayPaymentId` unique + `providerEventId` unique make duplicate payments
  impossible; concurrent duplicate deliveries collapse.
- Failed/pending charges are never recorded as successful renewals.
- No live charge can run in tests: the provider is mocked and no real financial
  mutation is ever performed by the suite.

## DB state (verified 2026-10-09)

`RazorpayPlanMapping` and `SubscriptionCharge` tables exist with correct
columns/indexes/uniques; both empty (no test data written to live billing).
Standalone commerce unchanged (orders 27, payments 97).