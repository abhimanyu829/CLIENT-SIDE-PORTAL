# Phase 10 — Governance Architecture

Agent Governance is a **SUPER_ADMIN-only area inside the existing admin panel**. It reads and changes agent-gateway state through the services Phases 2–9 already own; it adds no table, no second source of truth and no agent-reachable surface.

```
Browser (super administrator, Clerk session)
  │  /admin/agent-governance/*            server-rendered pages (read)
  │     layout + every page: requireSuperAdmin()          lib/admin-auth.ts
  │     queries.ts / health.ts  ──────────────► Postgres (existing tables), Phase 3 registry
  │
  │  POST/PATCH /api/admin/agent-governance/*   one route per named operation (write)
  │     requireHumanApprover()   SUPER_ADMIN + live Clerk session + no agent credential
  │     readJsonBody()           application/json only, ≤ 32 KB, strict zod schema
  │     actions.ts               optimistic concurrency + audit (lib/audit.ts -> AuditLog)
  │        ├─ TriggerService           (Phase 9)
  │        ├─ AgentTaskService.cancel  (Phase 8)
  │        └─ policy-store             (Phase 6)
  │
  │  existing routes reused as-is (+ one optional field)
  │     /api/admin/agent-connections/*          Phase 2 lifecycle (create / suspend / reactivate / revoke / rotate)
  │     /api/admin/agent-connections/[id]/autonomy   Phase 7 (+ optional expectedVersion)
  │     /admin/agent-approvals/[ref]            Phase 7 decision page (binding + SMS step-up)
  ▼
router.refresh() after every mutation (the existing admin revalidation pattern)
```

## Modules

| Path | Responsibility |
|---|---|
| `lib/agent-gateway/governance/access.ts` | `requireGovernanceViewer` (= `requireSuperAdmin`), `requireGovernanceOperator` (= Phase 7 `requireHumanApprover`) |
| `governance/queries.ts` | paginated, filtered read models (overview, connections, capabilities, policies, autonomy, approvals, tasks, triggers, schedules, webhooks, form options) |
| `governance/views.ts` | explicit allowlist projections (no hashes, secrets, inputs, results) |
| `governance/health.ts` | runtime snapshot (switches, dependencies, queue depth, stuck tasks, overdue schedules, backlog) |
| `governance/actions.ts` | the named mutations, each optimistic and audited |
| `governance/schemas.ts` | strict request bodies |
| `governance/http.ts` | JSON body parsing, stable error mapping, `no-store` responses |
| `governance/routes.ts` | the route handlers bound by `app/api/admin/agent-governance/**/route.ts` |
| `governance/pagination.ts`, `errors.ts`, `audit.ts`, `index.ts` | supporting pieces |
| `app/(admin)/admin/agent-governance/**` | layout + 15 pages |
| `components/admin/agent-governance/*` | server-safe presentational pieces (`ui.tsx`) and client islands (forms, confirmed actions, one-time secret dialog, section nav) |

## Changes to existing code (all additive)

| File | Change | Why |
|---|---|---|
| `components/admin/AdminLayoutClient.tsx` | one `superAdminOnly` nav item | entry point in the existing sidebar |
| `authorization/policy-store.ts` | optional `expectedCurrentVersion` on `createPolicyVersion` / `rollbackToVersion`; `PolicyConflictError` | optimistic concurrency for policy versions (omitted = previous behaviour) |
| `autonomy/policy-store.ts` | optional `expectedVersion` on `setAutonomyPolicy` / `disableAutonomyPolicy`; `AutonomyConflictError` | optimistic concurrency for autonomy (omitted = previous behaviour) |
| `app/api/admin/agent-connections/[id]/autonomy/route.ts` | optional `expectedVersion` (PUT body / DELETE query); 409 `CONFLICT` | the governance editor always sends it; older callers still work |

## Design rules

- **One source of truth.** Capabilities stay code (the reviewed manifest); everything else stays in its Phase 2–9 table. Governance never caches or copies state.
- **Reads are server-rendered pages**, writes are specific POST/PATCH routes. There is no governance GET API and no generic "action" endpoint.
- **Optimistic concurrency** on every versioned configuration: trigger `version`, policy version head, autonomy version head, task status. A stale view is a 409 `CONFLICT`; nothing is overwritten silently.
- **Dangerous operations are confirmed** in the UI (and the reason is audited where a route accepts one); the server re-validates everything regardless.
- **Every mutation is audited** to the existing `AuditLog` via `lib/audit.ts`, with non-secret summaries only.
- **Revalidation** uses `router.refresh()` (server re-render), the pattern the admin panel already uses.

## Scope

Not built: an audit ledger or immutable history (Phase 11), new sub-admin permissions, agent self-service, UI for capability definition changes (capabilities are code), bulk operations.
