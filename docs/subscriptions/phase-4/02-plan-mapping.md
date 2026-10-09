# 02 — Plan Mapping (Phase 4)

## When a plan may map

Only: PUBLISHED plan + PUBLISHED plan version + non-FREE type + positive price +
supported currency (INR/USD/EUR/GBP/CAD/AUD) + supported billing interval
(1/3/6/12 months). Everything else is rejected with a typed error.

## Interval mapping (never silently changed)

| internal interval | Razorpay | interval |
|---|---|---|
| 1 month (MONTHLY) | monthly | 1 |
| 3 month | monthly | 3 |
| 6 month | monthly | 6 |
| 12 month | monthly | 12 |

## Total billing cycles

`total_count = durationMonths / billingIntervalMonths` when the published
contract has a finite term (non-integral → rejected, never guessed). NULL when
the contract is indefinite renew-until-cancelled. FREE → 0 (never billable).

## Money safety

- Price/currency resolved server-side from the published version only.
- INR → paise (`₹499 = 49900`), other supported currencies → cents. Integer
  subunits, no floating point.
- Provider plan id from the response only; never from a client.
- Mapping unique per `(planVersionId, environment)`, `razorpayPlanId @unique`.

## Idempotency & timeout recovery

- Existing ACTIVE mapping → reused, no second remote plan.
- Timeout after possible remote create → no blind retry; persistence failure
  after remote success → `BILLING_RECONCILIATION_REQUIRED`, never a silent
  duplicate or a fabricated success.
- `NEEDS_RECONCILIATION` mapping cannot be used until resolved.