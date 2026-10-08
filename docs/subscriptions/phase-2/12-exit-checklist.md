# 12 — Exit Checklist (Phase 2)

| # | Criterion | Status |
|---|---|---|
| 1 | Plan catalog exists | ✅ extended `SubscriptionPlan` + `PlanVersion` + `PlanItem` |
| 2 | Plan types supported | ✅ FREE / MONTHLY / THREE_MONTH / SIX_MONTH (+ YEARLY / ENTERPRISE / CUSTOM) |
| 3 | Plan identity stable | ✅ internal cuid + unique slug; name changes don't alter identity |
| 4 | Pricing structure exists | ✅ plan base price + versioned price/currency/interval/duration |
| 5 | Plan versions work | ✅ draft/edit/publish/supersede; `@@unique([planId, version])` |
| 6 | Published versions protected | ✅ immutable; content mutations gated to DRAFT |
| 7 | Plan items work | ✅ 9 item types, referential + declared + limit |
| 8 | Products/services compose into bundles | ✅ PRODUCT/SERVICE/AI_CAPABILITY items reference real resources |
| 9 | Duplicate items prevented | ✅ DB unique `(planVersionId,itemType,itemRefKey)` + service checks |
| 10 | Invalid references rejected | ✅ existence checks per type |
| 11 | Lifecycle transitions controlled | ✅ pure machine + asserts + CAS |
| 12 | Publication validated | ✅ fail-closed `validatePlan` |
| 13 | Archival works | ✅ terminal; nothing deleted; versions intact |
| 14 | Concurrency safe | ✅ unique constraints + CAS + one-draft rule (Group F) |
| 15 | Database integrity passes | ✅ migration applied, constraints/indexes verified, drift check clean |
| 16 | Security tests pass | ✅ Group E |
| 17 | Standalone commerce regression passes | ✅ no commerce files touched; commerce traps in fake DB; Phase-1 suite 95/95 |
| 18 | Typecheck passes except documented pre-existing | ✅ Phase-2 errors 0 |
| 19 | Lint passes | ✅ clean |
| 20 | Build passes | ✅ 241 pages |
| 21 | DB verification passes | ✅ live CREATE→…→ARCHIVE test |
| 22 | Git diff scoped | ✅ every file has a Phase-2 reason |
| 23 | Documentation complete | ✅ 01–12 |
| 24 | Phase-1 architecture intact | ✅ Subscription source/environment + services preserved; Phase-1 suite green |

## Git diff scope (Phase 2)

| File | Reason |
|---|---|
| `prisma/schema.prisma` | 4 enums, `PlanVersion`, `PlanItem`, additive columns/index on `SubscriptionPlan` |
| `prisma/migrations/20261008010000_subscription_plan_catalog/migration.sql` | applies the above (additive) |
| `lib/services/plan-lifecycle.ts` | pure lifecycle + vocabularies |
| `lib/services/plan-catalog-service.ts` | catalog domain service |
| `vitest.plans.config.ts`, `package.json` (+`test:plans`) | separate suite |
| `vitest.subscriptions.config.ts` | scope include to `subscription-*` |
| `lib/services/__tests__/plan-*.test.ts` (9) + `helpers/fake-plan-db.ts` | tests |
| `docs/subscriptions/phase-2/01..12` | docs |

No commerce/checkout/payment/product/admin/entitlement/provider code changed.

## Protected systems verification

Standalone purchase, multi-product purchase, cart, checkout, Razorpay one-time,
PhonePe, Paytm, orders, invoices, product, marketplace, admin products, auth, RBAC,
workers, existing UI — **unchanged**. Phase-1 subscription foundation **preserved**.

## Final Phase-2 status

**COMPLETE**
