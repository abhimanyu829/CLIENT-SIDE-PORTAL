# Phase 10 — Database Verification

**Phase 10 adds no migration and no table, column or index.** Governance reads and writes the Phase 2–9 tables through their existing services. The two store changes (policy and autonomy optimistic concurrency) use columns and unique constraints that already exist.

| Check | Result |
|---|---|
| Schema diff (Phase 10) | none |
| `prisma validate` | valid (unchanged since Phase 9) |
| Pending agent-gateway migrations (unapplied, by plan) | `20260930000000` (Phase 6), `20261001000000` (Phase 7), `20261002000000` (Phase 8), `20261003000000` (Phase 9) — unchanged by Phase 10 |

## Queries and the indexes that serve them

| Read model | Query | Index |
|---|---|---|
| Connections list | `status` / `environment` / `authMethod`, `createdAt desc`, `skip/take 20` + `count` | `AgentConnection(status)` |
| Connection detail | credentials by `connectionId`; autonomy history by `connectionId`, `version desc`; triggers / tasks by `connectionId` | `AgentCredential(connectionId)`, unique `AgentAutonomyPolicy(connectionId, version)`, `AgentTrigger(connectionId)`, `AgentTask(connectionId, status)` |
| Policies | `enabled`, page; current versions by `id in (…)`; versions by `policyId`, `version desc` | `AgentPolicy(enabled)`, primary key, unique `AgentPolicyVersion(policyId, version)` |
| Autonomy | ACTIVE by level, page | `AgentAutonomyPolicy(connectionId, status)` |
| Approvals | status / expiry / connection, `createdAt desc` | `AgentApprovalRequest(status, expiresAt)`, `(connectionId, status)` |
| Tasks | status / origin / capability / connection, `createdAt desc` | `AgentTask(connectionId, status)`, `(status, expiresAt)`, `(triggerId)`; unfiltered order by `createdAt` has no dedicated index (bounded by 30-day retention) |
| Trigger runs | by `triggerId`, `receivedAt desc` | `AgentTriggerRun(triggerId, receivedAt)` (exact) |
| Triggers / schedules / webhooks | `type`, `status`, `connectionId` | `AgentTrigger(type, status)`, `(connectionId)` |
| Runtime | stuck tasks by `status` + `attemptStartedAt`; overdue schedules by `status` + `nextRunAt` | `AgentTask(status, expiresAt)` (status prefix), `AgentTrigger(status, nextRunAt)` |
| Overview | one `count` per status (5 + 10 + 6 + 3 small indexed counts) | status indexes above |

Every list is bounded by `take: 20` (asserted in the UI and performance tests); per-row lookups are batched with `in (…)` (no N+1).

## Writes

| Write | Mechanism |
|---|---|
| Trigger edits / transitions / rotation | `UPDATE … WHERE id = ? AND version = ? AND status IN (…)` (Phase 9 store) |
| Policy version / rollback | head-version check + unique `(policyId, version)` inside the existing transaction |
| Autonomy save / disable | head-version check + unique `(connectionId, version)`; `UPDATE … WHERE version = ? AND status = 'ACTIVE'` |
| Task cancel | status precondition, then the Phase 8 conditional transitions |
| Connection lifecycle | Phase 2 service (see the pre-existing race in `14-bug-report.md`) |
| Audit | `INSERT AuditLog` via `lib/audit.ts` (fire-and-forget, existing behaviour) |

## Recommendation (not applied)

If task volume grows beyond retention-bounded sizes, add `@@index([createdAt])` on `AgentTask` (or `(status, createdAt)`) in a later migration.

Not verified against a live Postgres: no isolated test database exists in this environment and the Phase 6–9 migrations are not applied.
