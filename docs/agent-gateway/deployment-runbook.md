# Agent gateway — deployment runbook

How to take this release to production safely. Everything an operator has to do by hand is in the order it should be done. The agent gateway ships **off** (every `AGENT_GATEWAY_*` flag unset), so deploying the code changes nothing for agents until step 6. The human-route fixes (tickets, products, feedback, chat; see `known-issues-resolution.md`) take effect as soon as the code is live.

## 1. Pre-flight (read-only)

Run with the target environment's variables (the script loads `.env` without overriding variables already set):

```
node scripts/agent-gateway-readiness.cjs
```

It only runs SELECT queries and a Redis PING and never prints secret values. Before migrating, the expected result is one blocking item, `migrations - 7 not applied`. Everything else should be `OK`. On the database configured in this repository's `.env` (checked 2026-09-29) it reported: Redis answering, `ENCRYPTION_KEY` set, Twilio variables set, and **one** SUPER_ADMIN with a verified phone (warning: single point of failure for approvals; add a second approver).

## 2. Back up

Take a database backup (or note the point-in-time-recovery timestamp) before migrating. The migrations are additive, but a backup makes any surprise reversible.

## 3. Apply the migrations (before deploying the code)

From a machine with the production `DATABASE_URL` and `DIRECT_URL` (direct connection, not the transaction pooler):

```
npx prisma migrate deploy
npx prisma migrate status        # expect: "Database schema is up to date!"
```

`migrate deploy` applies exactly these seven, in this order:

| Migration | What it does |
|---|---|
| `20260916090000_catalog_intelligence` | catalog tables; **no-op** where they already exist (as on the `.env` database) |
| `20260930000000_agent_gateway_phase6_policy_engine` | policy tables and enums |
| `20261001000000_agent_gateway_phase7_approval_engine` | autonomy + approval tables |
| `20261002000000_agent_gateway_phase8_task_engine` | task table (+ CHECK constraints) |
| `20261003000000_agent_gateway_phase9_triggers` | trigger tables (+ CHECK constraints); adds `AgentTask.triggerId` |
| `20261004000000_agent_gateway_phase11_audit_ledger` | audit ledger + recovery tables; adds `AgentTask.traceId` |
| `20261005000000_agent_gateway_phase15_release_controls` | rollout + kill-switch tables |

All seven only create types, tables, indexes and foreign keys, plus two nullable columns on the new `AgentTask` table: nothing existing is altered or dropped, and the previous code keeps working against the migrated database. Each migration runs as one transaction.

The catalog migration was broken before this release (it created an index before its table), so `migrate deploy` could not get past it on any database. It is now idempotent; see `known-issues-resolution.md`.

**If a migration fails:** fix the cause, then mark the failed one rolled back and deploy again:

```
npx prisma migrate resolve --rolled-back <migration_name>
npx prisma migrate deploy
```

### How this was verified (without touching the real database)

- Read-only on the `.env` database: `prisma migrate status` (7 pending), the recorded checksums of the 6 applied migrations (all match the files), no unresolved failed migration, and the database's schema scripted with `prisma migrate diff --from-empty --to-schema-datasource`.
- That schema was loaded into a throwaway PostgreSQL 18.3 (PGlite, in a temp directory, outside the repository), the 6 applied migrations recorded with `prisma migrate resolve --applied`, and **Prisma's own runner** used: `migrate deploy` applied all 7, `migrate status` reported up to date, a second `deploy` was a no-op, and `migrate diff` against `schema.prisma` left only the six unmodelled catalog tables.
- Object by object, the migrated database matched `schema.prisma` (1863 columns, 506 indexes, 94 enums, all 309 primary / foreign / unique keys); the only extras are the migrations' 8 hand-written CHECK constraints, which Prisma does not model. Production's existing catalog tables were left untouched; on an empty database the catalog migration creates them and is a no-op when re-run. The original catalog migration fails on both kinds of database.
- Not verifiable locally: the production server's exact PostgreSQL version and extensions, lock contention under live traffic (the migrations only lock briefly; new tables are empty), and anything Supabase-specific. Run the migrations at a quiet time.

## 4. Deploy the code

Build and deploy as usual (the Dockerfile runs `prisma generate` and `next build`; it does not migrate). Leave every `AGENT_GATEWAY_*` flag unset.

If the code is ever live before the migrations, requests to `/api/agent-gateway/*` log `The table public.AgentAuditEvent does not exist` (the audit ledger cannot append); the requests are still answered normally (`503 GATEWAY_DISABLED` while the gateway is off). Applying the migrations removes the error.

Connection pool: in the local production-build smoke test against the `.env` database, Supabase answered `EMAXCONNSESSION ... max clients are limited to pool_size: 15` until the app's retry succeeded. Prisma's default pool is `2 x CPU cores + 1` per instance, so on machines with many cores (or several instances) it can exceed the session pooler's 15. Set `connection_limit` in `DATABASE_URL` (for example `connection_limit=5`) or point the app at Supabase's transaction pooler (port 6543, `pgbouncer=true`) and keep `DIRECT_URL` for migrations. This is pre-existing configuration, not part of this release.

## 5. Smoke checks after deploy

These were run locally against the production build (`next start`, read-only requests, 13/13 passed); repeat them on the deployed site.

- `GET /api/agent-gateway/health` is 200; `POST /api/agent-gateway/mcp` is `503 GATEWAY_DISABLED`.
- `GET /api/products/<missing-slug>` is 404; `PATCH /api/products/<slug>` is 403; `GET /api/products` and `GET /api/feedback` are 200 and contain no `deliveryConfig` / access URLs / reservation fields / e-mail addresses. (The `.env` database had no published products and no approved reviews, so locally both lists were empty and the field stripping itself is covered by `hardening-human-routes.test.ts`; check it on a site with published products.)
- Signed out: `/admin` redirects to `/login`; `GET /api/tickets` is 401.
- Signed in as a customer: create a ticket from `/dashboard/tickets` with each priority, including **Urgent** (it used to fail; it now creates a CRITICAL ticket), and send a message on it.
- Signed in as a SUPER_ADMIN (browser): open the agent governance pages, the approvals page and the release page; each must render without errors.

## 6. Enable the gateway (gradually)

1. Re-run step 1: everything `OK` except the flags.
2. Make sure at least two SUPER_ADMINs have a verified phone, then run **one live approval drill** in staging or with an internal connection: an `ASSISTED` connection calls `tickets.create`; the agent gets `APPROVAL_REQUIRED` with an `apr_…` reference; a SUPER_ADMIN opens it, requests the SMS code, approves; the identical call then runs once; repeating it needs a new approval.
3. Follow the go-live sequence in `phase-15/08-production-readiness.md` (rollouts DISABLED → INTERNAL → CANARY → GENERAL, kill-switch drill, attestations).

## Behaviour changes operators and support should know

- Agents: an approval-gated call on a resource the owner cannot reach is refused with `RESOURCE_NOT_FOUND` before any approval is raised; a connection with 20 approval requests already waiting gets `APPROVAL_LIMIT_REACHED`; a synchronous keyed write that duplicates one in flight gets `IDEMPOTENCY_CONFLICT`, and one made while Redis is failing gets `EXECUTION_UNAVAILABLE` (the task path keeps working).
- Tickets API: support staff are SUPER_ADMINs, or SUB_ADMINs with the workforce **Support** permission and an active admin session. Customers never receive staff-internal notes. Someone else's ticket or project is a 404. Invalid fields are a 400 with a reason instead of a 500.
- Product API: only AVAILABLE products, only approved reviews, no delivery / access / reservation / editor fields; `PATCH /api/products/[slug]` is 403 (edits go through the admin console).

## Notes for later work

- Migration folder names already run to `20261005000000`, later than today's date. Name new migrations after that timestamp (rename the folder `prisma migrate dev` creates) so `migrate deploy` keeps applying them in order.
- There is no initial migration: a brand-new database must be created with `prisma db push` (or a baseline) before `migrate deploy`.
- The six catalog tables are not modelled in `schema.prisma`, and production's copies differ slightly from the migration (`CatalogSourceRecord.changeFlags` / `fieldsVerified` nullable without default; an extra `CatalogCanonicalProduct_opportunityScore_idx`). Model them (or drop them) when the catalog feature lands; until then `prisma migrate dev` will propose dropping them, so do not run it against shared databases.
