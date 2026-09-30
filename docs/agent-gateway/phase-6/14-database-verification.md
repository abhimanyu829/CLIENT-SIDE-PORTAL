# Phase 6 — Database Verification

## Environment limitation (same disclosed limitation as Phase 2/4)

This environment has no live Postgres test database provisioned for this repository beyond the real production Supabase instance referenced in `.env`. Per the same policy Phase 2 and Phase 4 followed: schema/migration correctness was verified by (1) `npx prisma validate` against the full schema, (2) `npx prisma generate` succeeding and producing usable TypeScript types, (3) hand-review of the generated SQL against the Prisma schema, and (4) exercising the exact same read/write query shapes through the in-memory fake DB test suite (`authz-fake-db.ts`, `authz-policy-store.test.ts`, `authz-policy-cache.test.ts`). This proves the query construction and Prisma model shape are correct. It does **not** prove Postgres itself executes the migration's DDL without error on the live instance — that step (`prisma migrate deploy`) was deliberately **not run** against the production database (see below).

## Migration correctness (hand-reviewed)

`prisma/migrations/20260930000000_agent_gateway_phase6_policy_engine/migration.sql` — hand-curated, not a raw `prisma migrate diff` dump, for the same reason Phase 2's migration was hand-curated: the live database has other out-of-scope drift (legacy `Catalog*` tables) that a raw diff would attempt to touch. This migration contains *only* the Phase 6 additions.

- **3 new enums**: `AgentPolicyEffect`, `AgentPolicyScope`, `AgentPolicyVersionStatus` — match `prisma/schema.prisma` exactly (verified via `prisma validate`).
- **2 new tables**: `AgentPolicy`, `AgentPolicyVersion` — column-for-column match against the schema's field list, types, and defaults (`enabled BOOLEAN DEFAULT true`, `priority INTEGER DEFAULT 0`, `status DEFAULT 'ACTIVE'`, `approvalRequirement BOOLEAN DEFAULT false`).
- **No existing table is altered.** Confirmed by inspection — every statement is `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, or `ALTER TABLE "AgentPolicy"/"AgentPolicyVersion"` (adding a new table's own FK, never modifying `User`, `Team`, or any Phase 1-5 table's existing columns).

## Indexes

| Index | Type | Purpose |
|---|---|---|
| `AgentPolicy_currentVersionId_key` | UNIQUE | Enforces the 1:1 "a version is at most one policy's current version" invariant |
| `AgentPolicy_enabled_idx` | B-tree | `loadActivePolicySet()`'s `WHERE policy.enabled = true` filter |
| `AgentPolicy_priority_idx` | B-tree | Precedence tie-breaking reads (`ORDER BY priority DESC` pattern, though the current query loads the full active set and sorts in memory — this index is forward-looking for a future `WHERE priority > X` optimization, not yet load-bearing) |
| `AgentPolicyVersion_policyId_version_key` | UNIQUE | Enforces monotonically-increasing, collision-free version numbers per policy — the exact invariant `createPolicyVersion()`'s "next version" logic depends on |
| `AgentPolicyVersion_policyId_idx` | B-tree | `findFirst({ where: { policyId }, orderBy: { version: "desc" } })` (next-version lookup) and `updateMany({ where: { policyId, status: "ACTIVE" } })` (supersede-on-write) |
| `AgentPolicyVersion_capabilityId_idx` | B-tree | Forward-looking — a future capability-scoped policy admin UI would filter by this; the current `loadActivePolicySet()` reads the full active set unfiltered by capability (filtering happens in-memory inside `engine.ts`) |
| `AgentPolicyVersion_scope_idx` | B-tree | Same rationale as `capabilityId` — forward-looking for scoped admin queries |
| `AgentPolicyVersion_status_idx` | B-tree | `loadActivePolicySet()`'s `WHERE status = 'ACTIVE'` filter |

## Uniqueness constraints

- `AgentCredential`-style pattern reused: `AgentPolicy.currentVersionId` is `UNIQUE` (nullable) — enforces that a given `AgentPolicyVersion` row can be the "current version" of at most one `AgentPolicy`, which is exactly the 1:1 relationship the Prisma schema declares (`AgentPolicy.currentVersion` / `AgentPolicyVersion.currentOf`).
- `AgentPolicyVersion.(policyId, version)` is a composite `UNIQUE` constraint — the exact invariant `createPolicyVersion()`'s version-numbering logic relies on: two concurrent writers racing to create "the next version" for the same policy cannot both succeed with the same version number; the loser's `INSERT` fails the unique constraint at the database level (not just prevented by application logic, which could race).

## Foreign keys and cascade behavior

| FK | On Delete | Rationale |
|---|---|---|
| `AgentPolicy.createdById -> User.id` | RESTRICT | Mirrors Phase 2's `AgentConnection.createdById` convention exactly — a `User` who created a policy cannot be hard-deleted while that policy still references them (matches the existing app-wide convention of never allowing a `User` row to be deleted out from under referencing data). |
| `AgentPolicy.currentVersionId -> AgentPolicyVersion.id` | SET NULL | If a version row were ever deleted directly (not the normal path — versions are meant to be immutable and only ever superseded, never deleted), the parent policy's pointer clears rather than leaving a dangling reference. In normal operation this FK is never exercised on delete, since nothing in `policy-store.ts` ever deletes an `AgentPolicyVersion` row. |
| `AgentPolicyVersion.policyId -> AgentPolicy.id` | CASCADE | Deleting an `AgentPolicy` (an administrative action never exposed as an agent capability — see `06-rbac-separation.md`) correctly removes its entire version history rather than leaving orphaned versions. |
| `AgentPolicyVersion.createdById -> User.id` | RESTRICT | Same rationale as `AgentPolicy.createdById`. |

**Note on the two-table FK relationship**: `AgentPolicy.currentVersionId` and `AgentPolicyVersion.policyId` reference each other (a version belongs to a policy; a policy points at its current version). This is the same modeling pattern Phase 2 already uses for `AgentCredential.replacesCredentialId` (a self-referential rotation chain) — a legitimate, intentional bidirectional reference, not a modeling error. Insert order matters (`createPolicyVersion()` always creates the `AgentPolicy` row first with `currentVersionId: null`, then creates the version, then updates `currentVersionId` — verified by `authz-policy-store.test.ts`'s "createPolicyVersion with no policyId creates a brand-new AgentPolicy + version 1" test, which asserts this exact sequence via the fake DB's call-order-preserving map).

## No orphan records — verified logically and by test

- Every `AgentPolicyVersion` row is created only via `createPolicyVersion()`, which either creates a fresh parent `AgentPolicy` in the same logical operation or requires an existing `policyId` — there is no code path that creates an orphaned version row pointing at a nonexistent policy. (The `authz-failure.test.ts` "incomplete policy set" test deliberately constructs such an orphan via the fake DB directly — bypassing the store's own write path entirely — specifically to prove the READ path fails closed if such a row somehow existed, e.g. from external tooling; it is not a state the write path can itself produce.)
- Deleting a policy (`AgentPolicy` row, via a future admin action — not built in this phase) cascades to remove all its versions, preventing the app-level scenario of orphaned versions when a policy itself is legitimately deleted.

## Rollback/migration-application verification (explicitly NOT performed against production)

**The Phase 6 migration has NOT been applied to the live database.** `.env`'s `DATABASE_URL`/`DIRECT_URL` point at a real production Supabase Postgres instance. Running `prisma migrate deploy` (or `db push`) against it is a schema-altering action against a live production database with real user data — per this session's safety guardrails, that is a high-risk, hard-to-fully-reverse action requiring your explicit confirmation before being executed, not something to do implicitly as part of "finishing a phase."

**Practical consequence, stated plainly**: until the migration is applied, the `AgentPolicy`/`AgentPolicyVersion` tables do not exist in the real database. `PolicyEngineAuthorizer`'s `loadActivePolicySet()` call would fail with a genuine Postgres "relation does not exist" error the very first time any real MCP `tools/call` reaches it in production. This is caught by `authorizer.ts`'s own fail-closed `try/catch` and converted to `POLICY_UNAVAILABLE`, enforced identically to `DENY` — so the *safety* property holds even in this state (nothing can be allowed by mistake), but the endpoint is **fully non-functional for any real tool call** until:
1. The migration is applied (`npx prisma migrate deploy` against the real database — requires your explicit go-ahead), and
2. At least one real policy is created (either via `seedBaselineReadPolicies()` or hand-authored policy rows) — an empty, freshly-migrated policy table still resolves to `DEFAULT_DENY_NO_POLICY` for everything.

This is documented here rather than silently assumed to be "handled."
