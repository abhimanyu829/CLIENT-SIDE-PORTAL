# 10 — Database Verification (Phase 6)

## Migration

`20261008050000_free_and_trial` applied to live Supabase (2026-10-09):

- `ALTER TYPE "EntitlementSourceType" ADD VALUE 'FREE_PLAN'`;
- `ALTER TYPE "EntitlementSourceType" ADD VALUE 'TRIAL'` (backward compatible);
- `TrialStatus` + `FreeEnrollmentStatus` enums;
- `TrialEnrollment` (`trialScopeKey @unique`, `@@index([userId,status])`,
  `@@index([planVersionId])`, `@@index([status, expiresAt])`, FK User CASCADE);
- `FreeEnrollment` (`dedupeKey @unique`, `@@index([userId,status])`,
  `@@index([planVersionId])`, FK User CASCADE).

## Post-apply checks

- Live columns verified: `TrialEnrollment.trialScopeKey/status/expiresAt`,
  `FreeEnrollment.dedupeKey/status`.
- Existing data intact: orders 27, EntitlementGrant 2 (prior evidence), trials 0,
  free enrollments 0.
- Drift: only the pre-existing legacy `Catalog*` delta remains.

## Live behavior note

A live enrollment run needs a configured published FREE plan and an eligible
paid plan in the DB (catalog currently holds the archived Phase-2 verify plan
only). Engine behaviors are fully covered by the in-memory suite; schema/
constraints verified above.