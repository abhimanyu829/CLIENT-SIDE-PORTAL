# 10 — Test Report (Phase 3)

## Suites

| Suite | Command | Result |
|---|---|---|
| Phase-3 entitlement suite | `npm run test:entitlements` | **88/88 PASS** (10 files) |
| Phase-1 subscription suite | `npm run test:subscriptions` | **95/95 PASS** |
| Phase-2 plan catalog suite | `npm run test:plans` | **84/84 PASS** (+1 live skipped by default) |
| Typecheck | `npm run type-check` | Phase-3 errors **0**; 3 pre-existing gateway errors |
| Lint (Phase-3 files) | `npx eslint …` | **clean** |
| Build | `npm run build` | **PASS** (241 pages) |
| Live DB apply/verify | `prisma migrate deploy` / live test | **BLOCKED — Supabase unreachable** (`P1001`, 4 attempts over ~30 min). SQL written from `migrate diff`; unit + structural DB tests pass in-memory |

## Phase-3 breakdown (88 tests)

| File | Group | Coverage |
|---|---|---|
| entitlement-lifecycle.test.ts | pure | status matrix, terminal states, time rule incl. expiry boundary, vocabularies, key validation, dedupe determinism, max-limit rule, plan-item contract map |
| entitlement-definitions.test.ts | A | create, duplicate key, invalid type/config/key, strict schema, get by key/id, list filters, deactivate |
| entitlement-grants.test.ts | B | grant, idempotency, distinct refs, permanent/dated, window validation, unknown/banned subject, deactivated definition, invalid source, mixed subject ids, scope/resource consistency, suspend→restore→revoke terminality, missing grant, getGrant |
| entitlement-effective.test.ts | C+D | single grant, hasEntitlement, exclusion of expired/revoked/suspended, source overlap, deterministic winner, resource scoping, team isolation, limits max-wins, null limit, non-limit keys |
| entitlement-standalone.test.ts | E | adapter for order/subscription/admin records, hasEntitlement against purchases, cross-customer isolation, expired purchase excluded |
| entitlement-contract.test.ts | F | full verified-plan composition → descriptor keys, no provisioning during translation, unmappable rejection, Phase-5-style grant flow |
| entitlement-expiration-revocation.test.ts | G+H | cached-expiry DENY, pre-expiry ALLOW, permanent, worker cleanup, revoke invalidates cache + immediate DENY, row preserved, source separation on revoke |
| entitlement-cache.test.ts | I | miss→resolve+set, snapshot semantics, grant/revoke/suspend/restore invalidation, Redis-down fallback, stale-payload denial, key scoping |
| entitlement-security-concurrency.test.ts | J+K | forged ids/sources/status/expiry/quantity, cross-tenant/team/resource denial, commerce traps; simultaneous identical grants → 1 row, distinct refs coexist, revoke race, revoke+check race, suspend/revoke race |
| entitlement-failure-regression.test.ts | L+M | create/revoke/source-read failures, malformed input pre-DB, no partial state, schema/migration additivity, no commerce/plan/provider code, Phase-1+2 preservation, tenant/resource isolation |

## Migration & DB status (honest)

- `prisma validate` PASS (offline).
- Migration SQL generated via `prisma migrate diff` from the live schema (same
  method proven in Phase 2 where the DB was reachable).
- APPLY + live verification INCOMPLETE: Supabase at `db.czqjvrlzlpldmdtlnngk.supabase.co`
  is unreachable (`Error: P1001 Can't reach database server`). Re-run
  `npx prisma migrate deploy` when the DB is back.