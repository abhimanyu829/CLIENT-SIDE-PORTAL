# Testing — Phase 8

## Executed (actual results)

| Command | Result |
|---|---|
| `npm run test:subscriptions` | 95 passed (95) |
| `npm run test:plans` | 84 passed, 1 skipped (85) |
| `npm run test:entitlements` | 88 passed, 1 skipped (89) |
| `npm run test:razorpay` | 87 passed, 2 skipped (89) |
| `npm run test:provisioning` (+ `admin-subscription-guard.test.ts`, `admin-subscription-service.test.ts`) | 73 passed (73) |
| `npm run test:freetrial` | 70 passed (70) |
| `npm run type-check` | 0 Phase-8 errors; 3 pre-existing gateway errors (commit `125d2c5`) |
| `npx eslint <phase-8 files>` | clean |
| `npm run build` | Compiled successfully (242+ pages) |

## New Phase-8 tests

- `admin-subscription-guard.test.ts` — RBAC gate: SUPER_ADMIN allow, SUB_ADMIN
  allow/deny matrix, customer/banned/anonymous denied.
- `admin-subscription-service.test.ts` — governance metrics accuracy,
  operational-issue aggregation (CHARGE/PROVISIONING/WEBHOOK), sanitized audit
  rows, structural protected-system checks (no commerce mutation code, one-time
  Razorpay routes intact, Phase-7 pages intact).

## Not run (disclosed)

- Browser UI interaction tests (no component harness in repo; UI verified via
  typecheck/lint/build).
- Live admin actions against a real Razorpay TEST account (Phase-4 credential
  blocker, deferred per user).