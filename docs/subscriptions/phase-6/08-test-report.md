# 08 — Test Report (Phase 6)

## Suites

| Suite | Command | Result |
|---|---|---|
| Phase-6 free/trial | `npm run test:freetrial` | **64/64 PASS** (8 files) |
| Phase-1 subscription | `npm run test:subscriptions` | **95/95 PASS** |
| Phase-2 plan catalog | `npm run test:plans` | **84/84 PASS** (+1 live skipped) |
| Phase-3 entitlements | `npm run test:entitlements` | **88/88 PASS** (+1 live skipped) |
| Phase-4 razorpay | `npm run test:razorpay` | **87/87 PASS** (+2 skipped incl. live-db) |
| Phase-5 provisioning | `npm run test:provisioning` | **59/59 PASS** |
| Typecheck | `npm run type-check` | Phase-6 errors **0**; 3 pre-existing gateway errors |
| Lint (Phase-6 files) | `npx eslint …` | **clean** |
| Build | `npm run build` | **PASS** (242 pages) |
| DB apply/verify | `migrate deploy` + live query | **PASS** (2026-10-09); drift zero beyond legacy Catalog |

## Coverage (64 tests by prompt group)

| File | Groups | Highlights |
|---|---|---|
| free-trial-lifecycle.test.ts | pure | 14-day math (UTC exact), scope/free keys, state machine, read-time expiry, eligibility policy |
| free-enrollment.test.ts | A | enroll + only-bundle grants (permanent FREE_PLAN), idempotency, missing/unpublished free plan, banned/unknown user, limits honored, no subscription/payment/charge |
| trial-eligibility.test.ts | B | eligible start, unverified/consumed/active/paid gates, FREE-as-trial rejected, unpublished plan/version, per-customer scope, banned |
| trial-activation-expiration.test.ts | C+D | exact 14-day window + bound version, default benefits (1 product + 1 admin + 1GB, no premium), provisioning failure → PENDING + retry recovery, boundary denial without cleanup, sweep idempotency, future trial untouched |
| trial-conversion.test.ts | E | no-conversion without paid sub, pending never converts, provisioned-grant requirement, converts with paid grant then retires trial grants (no gap), duplicate conversion idempotent, expired can't convert, trial creates no billing |
| trial-overlap.test.ts | F | standalone survives trial expiry, free/subscription survive cancellation, second-scope trial survives, 4-source matrix retires independently |
| trial-idempotency-security.test.ts | G+H | duplicate free enrollment, duplicate/concurrent trial, repeated expiry no-op, forged ids/plans/durations/cross-tenant/expired-access/source-substitution |
| trial-failure-concurrency-regression.test.ts | I+J+K | failure atomicity (PENDING + no grants), DRAFT/malformed plan, concurrency matrix, schema/migration additivity, no commerce mutation code, Phases 1-5 preserved |

## Live notes

Razorpay TEST round-trip (Phase-4 credential blocker) also gates a live
trial→paid conversion run; all engine behaviors verified in-suite
(in-memory) + structurally against the live DB.