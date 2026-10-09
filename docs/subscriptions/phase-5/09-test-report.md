# 09 — Test Report (Phase 5)

## Suites

| Suite | Command | Result |
|---|---|---|
| Phase-5 provisioning | `npm run test:provisioning` | **59/59 PASS** (7 files) |
| Phase-1 subscription | `npm run test:subscriptions` | **95/95 PASS** |
| Phase-2 plan catalog | `npm run test:plans` | **84/84 PASS** (+1 live skipped) |
| Phase-3 entitlements | `npm run test:entitlements` | **88/88 PASS** (+1 live skipped) |
| Phase-4 razorpay | `npm run test:razorpay` | **87/87 PASS** (+2 skipped incl. live-db) |
| Typecheck | `npm run type-check` | Phase-5 errors **0**; 3 pre-existing gateway errors |
| Lint (Phase-5 files) | `npx eslint …` | **clean** |
| Build | `npm run build` | **PASS** (242 pages) |
| DB apply/verify | `migrate deploy` + live query | **PASS**; drift zero beyond legacy Catalog |

## Coverage (59 tests by prompt group)

| File | Groups | Highlights |
|---|---|---|
| provisioning-plan-resolution.test.ts | A | bound-version resolution of full bundle; missing version; unknown sub/owner; DRAFT rejection; superseded-ARCHIVED acceptance; missing definition → permanent zero grants; unmappable item; environment mismatch |
| provisioning-activation-renewal.test.ts | B+C | complete bundle + period + source + scope; RESOURCE vs GLOBAL; TRIALING never grants; retry-after-DB-failure single result; scheduleProvisioning job-id identity; renewal extension (strictly later, no duplicates); halt no-extension; delayed renewal; new items on renewal |
| provisioning-expiration-cancellation.test.ts | D+E | boundary expiry; future grant stays; late-expiry cannot shorten; permanent grants untouched; period-end cancel preserves; immediate cancel revokes; other-subscription untouched; duplicate cancel idempotent |
| provisioning-overlap-idempotency.test.ts | F+G+H | standalone preserved; subscription B preserved; admin/promo untouched; repeated activation (1 grant); distinct periods independent; replay-safe; mid-bundle failure → FAILED_RETRYABLE → exact single recovery |
| provisioning-cache-security.test.ts | I+J | cache invalidation on activate/extend/expire/revoke; forged sub/owner/version/keys/period/env; source-substitution; replay; terminal-state inert |
| provisioning-concurrency-failure.test.ts | K+L | concurrent duplicate activations (1 grant); renewal+expiration race keeps renewed period; cancel+renew race (no phantom); claim-persist failure; read failure retryable; malformed plan permanent; no unsafe grants on failure |
| provisioning-schema-regression.test.ts | M | enums + unique dedupe + FK; migration additive-only (no table touched); no commerce/billing/provider code; Phase-3/4 services reused; webhook hook separate; standalone access untouched |

## Notes

- One entitlement-suite flake (cache invalidation count) appeared once under
  parallel load and passed cleanly on isolated re-run (88/88).
- Live provisioning round-trip against a real merchant TEST account remains
  blocked on Razorpay credential 401 (Phase-4 live item); the Phase-5 engine's
  DB behaviors are covered by the in-memory suites + structural DB verification.