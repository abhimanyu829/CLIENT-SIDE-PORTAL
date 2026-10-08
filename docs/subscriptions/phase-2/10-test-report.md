# 10 — Test Report (Phase 2)

## Suites

| Suite | Command | Result |
|---|---|---|
| Phase-2 plan catalog suite | `npm run test:plans` | **84/84 PASS** (9 files; 1 live test skipped by default) |
| Phase-2 live DB verification | `$env:LIVE_DB="1"; npm run test:plans -- plan-live-db` | **PASS** (real Supabase) |
| Phase-1 subscription suite | `npm run test:subscriptions` | **95/95 PASS** |
| Typecheck | `npm run type-check` | Phase-2 errors **0**; 3 pre-existing gateway errors |
| Lint (Phase-2 files) | `npx eslint …` | **clean** |
| Build | `npm run build` | **PASS** (241 pages) |

## Phase-2 breakdown (84 tests)

| File | Group | Highlights |
|---|---|---|
| plan-lifecycle.test.ts | pure | 4×4 plan-status matrix, 3×3 version matrix, terminal ARCHIVED, plan-type durations/billing, currency/slug/item-type classifiers |
| plan-catalog.test.ts | A | create DRAFT+V1, slug derivation/duplication, invalid type/currency/price, strict schema, FREE zero-price, header edit + revision bump, publish validation, publish, FREE publish with no items, pause/resume, archive (terminal), invalid transitions, V2 drafting, published immutability, get by id/slug, listing + deterministic order |
| plan-items.test.ts | B | add PRODUCT/SERVICE/AI_CAPABILITY/STORAGE/USER_LIMIT/ADMIN_LIMIT/SUPPORT, invalid resource, missing/stray refs, duplicate + singleton, invalid quantity/limit, remove draft item, multiple distinct products |
| plan-composition.test.ts | C | MONTHLY bundle (product + AI + storage + admin limit + support), SIX_MONTH bundle (3 products + service + limits + support), same product across plans |
| plan-versioning.test.ts | D | V1 unchanged while V2 edited/published; V1 superseded→ARCHIVED, V2 PUBLISHED; one-draft rule; monotonic versions; readable after archive |
| plan-security.test.ts | E | forged plan id, owner/team, status/currentVersion, arbitrary/invalid refs, forged item type, published-version mutation, archive-then-publish, archived header edit, commerce traps |
| plan-concurrency.test.ts | F | same-slug race (one winner), concurrent drafts (≤1), concurrent publish (one PUBLISHED), archive/pause race consistency, duplicate item race |
| plan-failure.test.ts | H | create/version/item/updateMany failures, $transaction failure, malformed input pre-DB, publish atomicity (no plan PUBLISHED without version) |
| plan-schema-regression.test.ts | G + I | models/enums/columns, unique keys, FK cascade, additivity, commerce/legacy-drift exclusion, no provider/entitlement code, pure lifecycle, Phase-1 preservation, ProductTier untouched |

## Live DB verification (opt-in)

`plan-live-db.test.ts` (skipped unless `LIVE_DB=1`) runs the real flow against the
configured DB: CREATE→DRAFT→EDIT→PUBLISH→V2→PUBLISH→ARCHIVE, then asserts
`v1.status === ARCHIVED` (superseded, intact), `v2.status === PUBLISHED`, and
`after.versions.length === 2` (nothing deleted on archive). PASSED.

## Pre-existing failures (NOT Phase-2)

- 40 agent-gateway test failures + 3 gateway `tsc` errors — from HEAD commit
  `125d2c5` (product mutation capabilities not reflected in lock/tool lists).
  Already documented in Phase-1 `09-bug-report.md`; stash-proven pre-existing.
