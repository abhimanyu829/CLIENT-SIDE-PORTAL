# Backup & Recovery (Phase 10)

## Verified in this environment

- Database: managed Supabase PostgreSQL (`db.czqjvrlzlpldmdtlnngk.supabase.co`).
- Application data added by Phase 10 (`ReconciliationRun`,
  `ReconciliationFinding`) is derived/diagnostic — no financial records are
  written by reconciliation, so recovery objectives follow the existing billing
  tables' backup policy, not a new one.

## NOT verified (honest status)

- Restore drill: NOT performed — no approved non-production restore target was
  available during implementation, and restoring over any live data is
  prohibited. **Unverified:** whether the Supabase PITR/scheduled backups
  actually restore is untested here.
- Backup integrity checks, retention windows, and recovery access controls live
  in Supabase console settings — not reproducible from the repo.

## Required operational follow-up (unblocked, human-owned)

1. Take/confirm a Supabase backup snapshot before each production migration.
2. Run a restore drill into a scratch database and verify row counts for
   `Order`, `Payment`, `Subscription`, `SubscriptionCharge`,
   `EntitlementGrant`.
3. Record the drill result (date, RPO observed, tables checked) in this doc.

Until steps 1–3 are done, backup readiness = CONFIGURED-BUT-UNVERIFIED.