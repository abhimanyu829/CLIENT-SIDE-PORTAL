# Limitations (Phase 10)

## Blocked (environmental)

- **Migration apply + live run**: `prisma migrate deploy` for
  `20261008060000_billing_reconciliation` blocked by Supabase `P1001`
  unreachable (5 attempts, 2026-10-10). Code, SQL, `prisma validate`, and the
  full test suite are green; apply + first live DETECT_ONLY run must be
  re-executed when the DB returns.
- **Live provider evidence**: Razorpay TEST credentials rejected (`401
  Unauthorized`, Phase-4 deferred item) → provider lookup + settlement
  comparison not executed; recorded honestly as
  `EXTERNAL_PROVIDER_UNAVAILABLE` per run.

## Unsupported by design (verified absent)

- **Settlement/payout reconciliation (Category F)**: no verified settlement
  data source in repo → unsupported, not faked.
- **Invoice auto-repair**: issued financial documents are never rewritten; no
  correction/credit workflow exists → findings only.
- **Provider replay of failed webhook events**: replay is money-adjacent and
  unproven idempotent for every event type → manual only.
- **External alerting pipeline**: no alert integration in repo — thresholds are
  queries + logs (see monitoring-and-alerting.md).

## Pre-existing (unchanged)

- 40 gateway test failures + 3 gateway tsc errors (commit `125d2c5`).
- 6 legacy `Catalog*` drift tables.
- No component-test harness; browser E2E absent.

## Deferred

Backup restore drill (human-owned, documented), external alert delivery,
production rollout authorization (no deploy performed).