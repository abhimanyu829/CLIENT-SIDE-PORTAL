# 11 — Test Report (Phase 4)

## Suites

| Suite | Command | Result |
|---|---|---|
| Phase-4 razorpay recurring | `npm run test:razorpay` | **87/87 PASS** (8 files) |
| Phase-1 subscription | `npm run test:subscriptions` | **95/95 PASS** |
| Phase-2 plan catalog | `npm run test:plans` | **84/84 PASS** (+1 live skipped) |
| Phase-3 entitlements | `npm run test:entitlements` | **88/88 PASS** (+1 live skipped) |
| Typecheck | `npm run type-check` | Phase-4 errors **0**; 3 pre-existing gateway errors |
| Lint (Phase-4 files) | `npx eslint …` | **clean** |
| Build | `npm run build` | **PASS** (242 pages) |
| DB apply/verify | `migrate deploy` + live query | **PASS** (2026-10-09; drift zero beyond legacy Catalog) |
| Razorpay LIVE TEST-MODE round-trip | `LIVE_RZP=1` (razorpay-live-db.test.ts) | **BLOCKED on credentials**: TEST keys present (`rzp_test_…`) but Razorpay returns `401 Unauthorized` on `plans.create` and direct REST Basic auth (probed 2026-10-09, 3 attempts). Key format valid; the key/secret pair is not accepted (mismatched pair or secret regenerated after rotation). Re-run once a current TEST pair is in `.env`. All provider interaction in the automated suite is mocked; offline signature verification runs against the documented formula |

## Coverage (87 tests by prompt group)

| File | Groups | Highlights |
|---|---|---|
| razorpay-plan-mapping.test.ts | A | eligible mapping, plan-create params, mapping reuse (no dup), DRAFT/ARCHIVED/FREE/zero-price rejection, currency/subunit conversion, 1/3/6/12 interval mapping (3-month never reduced), total_count derivation (finite/in-definite/inexact/missing), timeout no-retry, persistence-fail-after-remote → reconcile, NEEDS_RECONCILIATION blocked, env-scoped lookup |
| razorpay-creation.test.ts | B | owner enforcement, plan validity, dedupe on retry, provider params (server-side plan id, total_count, quantity), timeout reserve-without-claim, 4xx, empty provider response, reconcile on reference-persist failure, subscription signature formula + wrong-order rejection |
| razorpay-webhook-signature.test.ts | D | valid/invalid/missing/malformed/wrong-secret/tampered/raw-body/no-secret |
| razorpay-webhook-lifecycle.test.ts | E | status mapping table, authenticated no-change, activated TRIALING→ACTIVE, charged (single SUCCEEDED charge), failed charge, pending→UNPAID+charge, halted→PAST_DUE, cancelled, paused/resumed, completed→EXPIRED, no-entitlement guarantee |
| razorpay-webhook-idempotency.test.ts | F+G | same event twice, same payment two events, concurrent duplicates, persistence-fail retryable, charge-fail → FAILED record, stale ACTIVATED vs CANCELED, stale PAUSED vs EXPIRED, cancelled-then-older-halted |
| razorpay-cancel-pause-resume.test.ts | I+H | immediate + cycle-end cancel, cancel idempotency + history kept, cross-tenant refusal, pause/resume with provider truth, resume-terminal refusal, pause-EXPIRED refusal, cancel timeout, pause/cancel race, pending/halted/recovery mapping |
| razorpay-security.test.ts | K | forged/missing owner, forged plan, cross-tenant, client cost fields never reach provider, forged provider plan id, invalid checkout sig, replayed webhook, invalid sig pre-persistence, missing fields, no-secret fail-closed |
| razorpay-failure-regression.test.ts | L+J+M | client-null failure, 5xx normalization, internal-create failure (no phantom), unknown-sub webhook safe, TRIALING never ACTIVE without activation, schema/migration additivity + uniques, one-time routes untouched, Phase 1-3 preserved, no commerce/entitlement/checkout code in billing, no grantEntitlement in webhook |

## Honest notes

- All provider interactions use a mocked Razorpay client — by design no real
  charge, plan or subscription was created in any automated test.
- A live TEST-MODE round-trip (real plan create → subscription create → webhook)
  requires merchant TEST keys and was not possible in this environment; the
  documented verification path is the manual TEST-MODE checklist in
  `14-phase-4-exit-checklist.md`.
