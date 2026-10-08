# 05 — Pricing Model (Phase 2)

## Separation of concepts

```
Product standalone price   ≠   Plan price   ≠   Provider plan id
```

A plan references a Product for composition and independently carries its own
commercial price. Product prices are never read, changed or mirrored.

## Where price lives

- `SubscriptionPlan.price` (legacy required column) — mirrored base price; kept so
  the existing billing-center code keeps working.
- `PlanVersion.price` + `currency` + `billingIntervalMonths` + `durationMonths` —
  the authoritative, versioned commercial definition. Published versions freeze it.

## Currency

`PriceCurrency` enum (USD/EUR/GBP/INR/CAD/AUD), validated by `isPlanCurrency`.
INR supported for the Indian market; nothing hard-codes INR, and no provider ids
are created.

## Billing interval vs commercial duration

Kept distinct:
- `billingIntervalMonths`: 1 (monthly), 3, 6, 12.
- `durationMonths`: commercial term length (FREE = 0; ENTERPRISE/CUSTOM = negotiated).

`PLAN_TYPE_DURATION_MONTHS` / `PLAN_TYPE_BILLING_MONTHS` map plan types to defaults.

## Plan types

`FREE | MONTHLY | THREE_MONTH | SIX_MONTH | YEARLY | ENTERPRISE | CUSTOM`

- FREE = a plan DEFINITION with zero price (the free-access engine is a later phase).
- Paid plans require a positive version price and ≥1 item at publish.
- ENTERPRISE/CUSTOM may be negotiated (pricing relaxed), but still require items.

## No provider coupling

No Razorpay/Stripe plan or price ids are created, stored or called in Phase 2.
Provider mapping is Phase 4.
