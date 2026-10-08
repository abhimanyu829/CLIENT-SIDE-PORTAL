# 07 — Database (Phase 2)

## Migration

`prisma/migrations/20261008010000_subscription_plan_catalog/migration.sql` —
**additive only**, applied and verified on the live Supabase database.

## Changes

Enums: `PlanStatus`, `PlanType`, `PlanVersionStatus`, `PlanItemType`.

`SubscriptionPlan` (ADD COLUMN only):
- `status PlanStatus NOT NULL DEFAULT 'PUBLISHED'` (legacy plans stay offered)
- `planType PlanType?`, `durationMonths Int?`, `billingIntervalMonths Int?`,
  `currentVersionId TEXT?`, `catalogRevision Int NOT NULL DEFAULT 0`
- relation `versions PlanVersion[]`
- index `@@index([status, planType])`

New tables: `PlanVersion`, `PlanItem`
- `PlanVersion`: `@@unique([planId, version])`, `@@index([planId, status])`,
  FK `planId → SubscriptionPlan(id) ON DELETE CASCADE`.
- `PlanItem`: `@@unique([planVersionId, itemType, itemRefKey])`,
  `@@index([planVersionId])`, `@@index([itemType, itemRefId])`,
  FK `planVersionId → PlanVersion(id) ON DELETE CASCADE`.

## Safety properties

- No DROP / RENAME / DELETE / ALTER of any existing column/index/constraint.
- No standalone commerce table touched (Order/Cart/Payment/Invoice/Product).
- Both new SubscriptionPlan lifecycle columns that must be present for legacy rows
  have defaults (`status='PUBLISHED'`); the rest are nullable.

## Drift note (pre-existing, out of scope)

The live DB contains legacy `CatalogCanonicalProduct`/`CatalogCrawl*`/`CatalogSource*`
tables NOT declared in `schema.prisma`. `prisma migrate diff` therefore still reports
those as pending drops. This drift predates Phase 2 and Phase 2 deliberately does
NOT drop them (migration excludes them and a test asserts they are absent from it).

## Verification

Post-migration: `migrate diff` reports ONLY the pre-existing Catalog drift → the
Phase-2 SQL exactly matches the schema. Live flow verified end-to-end (see 10).
