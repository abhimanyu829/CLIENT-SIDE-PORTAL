# 05 — Migration (Phase 1)

## File

`prisma/migrations/20261008000000_subscription_domain_foundation/migration.sql`

```sql
CREATE TYPE "SubscriptionSource" AS ENUM
  ('CHECKOUT', 'STRIPE_WEBHOOK', 'RAZORPAY_WEBHOOK', 'ADMIN', 'SYSTEM');
ALTER TABLE "Subscription" ADD COLUMN "source" "SubscriptionSource";
ALTER TABLE "Subscription" ADD COLUMN "environment" TEXT;
```

## Safety properties

- STRICTLY ADDITIVE: no DROP, no RENAME, no ALTER TYPE, no DELETE, no existing column touched.
- Both new columns nullable → every existing row remains valid with zero backfill.
- No new tables, no changed constraints, no changed indexes.
- Rollback: `ALTER TABLE "Subscription" DROP COLUMN "environment"; DROP COLUMN "source";`
  plus `DROP TYPE "SubscriptionSource";` (safe: no other object depends on the type).

## Applied + verified (this environment)

`npx prisma migrate deploy` — applied to the configured Supabase database
(`db.czqjvrlzlpldmdtlnngk.supabase.co`). Post-apply verification:

| Check | Result |
|---|---|
| `Subscription.source` exists, enum, nullable | YES |
| `Subscription.environment` exists, text, nullable | YES |
| Total subscriptions | 22 |
| Legacy rows (source IS NULL) | 22 (all untouched) |
| Orders / Payments / Entitlements | 27 / 97 / 22 — intact |

## Production note

This migration is separate from the 7 agent-gateway migrations listed in
`PRODUCTION-CHECKLIST.md`. Production still requires its own `prisma migrate deploy`
run; this Phase-1 migration must be included in that run.
