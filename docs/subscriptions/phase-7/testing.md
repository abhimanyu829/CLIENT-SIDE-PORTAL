# Testing — Phase 7

## Executed commands (actual results)

| Command | Result |
|---|---|
| `npm run test:subscriptions` | 95 passed (95) |
| `npm run test:plans` | 84 passed, 1 skipped (85) |
| `npm run test:entitlements` | 88 passed, 1 skipped (89) |
| `npm run test:razorpay` | 87 passed, 2 skipped (89; live-db gated on TEST keys) |
| `npm run test:provisioning` (incl. new `customer-subscription-view.test.ts`) | 62 passed (62) |
| `npm run test:freetrial` (incl. new `trial-eligibility-ui.test.ts`) | 70 passed (70) |
| `npm run type-check` | 0 Phase-7 errors; 3 pre-existing gateway adapter errors (commit `125d2c5`) |
| `npx eslint <phase-7 files>` | clean |
| `npm run build` | Compiled successfully (242 pages) |
| Migration | none required (no schema change) |

## New tests

- `trial-eligibility-ui.test.ts` (freetrial suite): server-computed eligibility
  — eligible with ids/duration; ACTIVE → TRIAL_ALREADY_ACTIVE; EXPIRED →
  TRIAL_ALREADY_USED; unverified account / existing paid sub → ineligible;
  unknown/unpublished/FREE plans UI-safe (never throws).
- `customer-subscription-view.test.ts` (provisioning suite): published-only
  plan catalog, price/items normalization; overview composition with ownership,
  access keys, storage/admin limits; empty-customer safety.

## Not executed (disclosed)

- Browser/component interaction tests: the repository has no component test
  harness (vitest suites are service-level only); UI verified via typecheck,
  lint, and production build. Responsive/accessibility behavior is manual-E2E.
- Live Razorpay TEST round-trip (Phase-4 credential blocker, deferred per user)
  also gates live paid-checkout E2E; the subscription checkout contract is
  verified offline (signature formula, Phase-4 suite).