# 01 — Plan Catalog (Phase 2)

## Audit first (Step 0)

Existing plan-like abstractions found:
- `SubscriptionPlan` (billing-center) — platform plan definitions (name/slug/tier/
  billingCycle/price/currency/trialDays), `PlanBenefit[]`, `UserSubscription[]`.
  **No versioning, no composition, no lifecycle.**
- `ProductTier` (Stack A) — per-product pricing, has `version`, `entitlementRules`, `aiQuota`.
- `ServicePlan`, `PremiumService`, `AddonService` (services/billing domains).

Decision (honors "reuse or extend"): **extend `SubscriptionPlan`** and add
`PlanVersion` + `PlanItem`. No duplicate catalog system; existing billing-center
columns/relations untouched (additive only).

## What the catalog is

A commercial composition layer. A PLAN references existing resources; it never
duplicates them and never becomes the Product.

```
SubscriptionPlan (identity, lifecycle, type)
    └── PlanVersion (versioned commercial definition: pricing + config)  [immutable once PUBLISHED]
           └── PlanItem (composition: PRODUCT/SERVICE/FEATURE/AI_CAPABILITY/limits/SUPPORT)
```

## Scope boundary

In: plan/version/item models, pricing, lifecycle, composition, validation,
publishing, archiving, internal catalog service.
Out (later phases): Razorpay/recurring billing, entitlement engine, free-tier &
trial engines, subscription checkout, upgrade/downgrade, renewal, customer/admin
UI, reconciliation, analytics. Phase 2 grants/checks NO access.

## Public surface

Backend/domain only — **no new routes or UI** (per prompt). Consumed later by admin
governance (Phase 8) and provider phases. Admin auth is reused where a caller exists;
no new admin role, no AI-admin path.

## Files

- `lib/services/plan-lifecycle.ts` — pure lifecycle + vocabularies (no I/O)
- `lib/services/plan-catalog-service.ts` — the only mutation path
- schema: `PlanStatus`, `PlanType`, `PlanVersionStatus`, `PlanItemType`,
  `PlanVersion`, `PlanItem`, additive columns on `SubscriptionPlan`
