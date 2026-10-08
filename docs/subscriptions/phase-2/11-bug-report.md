# 11 — Bug Report (Phase 2)

## Bugs found and fixed (all test-infrastructure or private to Phase 2)

### BUG-P2-1 (P2, test-only, fixed) — fake `findFirst` mis-delegated to `findUnique`
- Reproduced: publish/validate failed with `No draft version to publish` because the
  fake's `findFirst` spread the original `where` over `{ id }`, losing the id lookup.
- Fix: `findFirst` builds its projection directly (supports `orderBy`/`take`/`include`).
- Retest: publish/validate pass.

### BUG-P2-2 (P2, test-only, fixed) — fake delegates ignored `include`
- Reproduced: `plan.versions` undefined → `Cannot read properties of undefined`.
- Fix: `findUnique`/`findMany` now project `versions` (+ nested `items`) with ordering.

### BUG-P2-3 (P2, test-only, fixed) — fake `updateMany` ignored `id: { not }`
- Reproduced: supersede-on-publish did not archive the previous version
  (`expected 'PUBLISHED' to be 'ARCHIVED'`).
- Fix: `updateMany` handles `id` as string or `{ not }`.

### BUG-P2-4 (P3, Phase-2 code, fixed) — publish returned stale version
- Reproduced: `publishPlan(...).version.status` still `DRAFT` (pre-transaction row).
- Fix: re-read the version inside the transaction and return the published row.

### BUG-P2-5 (P3, test-only, fixed) — over-strict static assertions
- `.toMatch(/ALTER TABLE … "status"/)` failed (column wraps to a continuation line);
  `"Razorpay"`/`"entitlement"` matched documentation prose.
- Fix: match the column definition; strip block+line comments before code scans.

### BUG-P2-6 (P3, test-config, fixed) — Phase-1 config over-included plan tests
- The subscriptions config `include` glob picked up `plan-*.test.ts` after they were
  added; scoped to `subscription-*.test.ts`.

### BUG-P2-7 (P3, contract note, fixed in verification) — AuditLog actor FK
- Live verification failed on `auditLog.create` until the actor was a real `User.id`
  (`AuditLog.userId` FKs to `User`). Not a defect (production callers are real
  admins) — documented as a caller constraint in `08-security.md`.

## Intentional design decisions (not bugs)

- FREE plans may publish with zero items; paid plans require ≥1 item and positive price.
- ARCHIVED is terminal (no un-archive).
- Only one DRAFT version per plan at a time.
- Catalog has no HTTP routes (backend/domain only in Phase 2).

## Pre-existing issues (out of scope, not touched)

| ID | Sev | Owner | Description |
|---|---|---|---|
| PRE-1 | P1 | LEGACY | 40 agent-gateway test failures at HEAD (commit `125d2c5`) |
| PRE-2 | P2 | LEGACY | 3 `tsc` errors in gateway product adapters (`PERMISSION_DENIED`) |
| PRE-3 | P2 | DATABASE | Live DB has 6 legacy `Catalog*` tables not declared in `schema.prisma` (drift); excluded from the Phase-2 migration |
| PRE-4 | P2 | DATABASE | 7 agent-gateway migrations + this Phase-2 migration still need a production `migrate deploy` |

No P0. No Phase-2 defect left open.
