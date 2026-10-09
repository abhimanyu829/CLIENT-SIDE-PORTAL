# 09 — Bug Report (Phase 6)

## Bugs found and fixed

| ID | Sev | Root cause | Fix |
|---|---|---|---|
| BUG-P6-1 | P1 | `EntitlementSourceType` froze the OLD 4-value source set in `entitlement-lifecycle` — TRIAL/FREE_PLAN grants were rejected with `Invalid source type` | added both values to `ENTITLEMENT_SOURCE_TYPES` |
| BUG-P6-2 | P1 | Consumed-trial detection treated ACTIVE as consumed → duplicate ACTIVE start mis-reported | consumed = EXPIRED/CANCELLED/CONVERTED only; ACTIVE handled by the active gate |
| BUG-P6-3 | P1 | `expireExpiredTrials` relied on a multi-key filtered query that returned nothing (fake/filter edge); cancelled/conversion paths could leave TRIAL grants ACTIVE | fetch by `sourceType+sourceReference` only, filter status/owner in code (same for conversion's paid-grant check) |
| BUG-P6-4 | P1 | `confirmTrialConversion` paid-subscription lookup matched UNPAID records (filter gap) | strict `status: "ACTIVE"` filter |
| BUG-P6-5 | P2 | Idempotency vs eligibility conflict on duplicate ACTIVE start | duplicates are REFUSED (`TRIAL_ALREADY_ACTIVE`, one enrollment only); retry path retained only for PENDING (failed provisioning) |
| BUG-P6-6 | P3 | Start-trial error message always "not eligible" regardless of code | maps `TRIAL_ALREADY_ACTIVE` to a specific message; tests align |
| BUG-P6-7 | P3 | Fixture/fake gaps (missing status filter in fake `userSubscription.findFirst`, partial item typing, isTrialExpiredAt boundary misuse in a test, free-plan seed missing in one file, migration/`prisma` structural assertions) | fixed tests/fake + loosened structural assertion to DB-access tokens |

## Pre-existing (untouched)

- 3 gateway tsc errors + 40 gateway test failures (commit `125d2c5`).
- 6 legacy `Catalog*` tables (drift).
- Razorpay live TEST credential `401` (Phase-4 follow-up, deferred per user).

No P0. No open Phase-6 defect.