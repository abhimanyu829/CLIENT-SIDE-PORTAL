# Phase 9 — Database Verification

Migration: `prisma/migrations/20261003000000_agent_gateway_phase9_triggers/migration.sql` — hand-written, additive, **not applied** (applying the Phase 6–10 migrations is deferred until after Phase 15). Order: after `20261002000000` (Phase 8), because it adds a column and a foreign key to `AgentTask`.

| Check | Result |
|---|---|
| `prisma validate` | valid |
| `prisma generate` | generated; the trigger store, service and runtime typecheck against `db.agentTrigger` / `db.agentTriggerRun` |
| Schema diff | additive: 5 enums, 2 models, nullable `AgentTask.triggerId` (+ FK, index), back-relations `AgentConnection.triggers`, `AgentTrigger.tasks`. No existing column changed or dropped |

## SQL review

| Object | Purpose |
|---|---|
| `AgentTrigger_publicRef_key` (unique) | unguessable public reference, also the webhook path segment |
| `(type, status)`, `(status, nextRunAt)`, `(eventType, status)`, `(connectionId)` | event matching, the schedule tick, connection revocation |
| CHECK `AgentTrigger_event_config_check` | an EVENT trigger always has an event type and an `OWNER`/`ANY` scope |
| CHECK `AgentTrigger_webhook_config_check` | a WEBHOOK trigger always has an (encrypted) secret |
| CHECK `AgentTrigger_schedule_config_check` | a SCHEDULE trigger always has kind, timezone and missed-run policy |
| CHECK `version >= 1`, `failureCount >= 0` | sane counters |
| `AgentTriggerRun_publicRef_key` (unique) | public run reference |
| `AgentTriggerRun_triggerId_deliveryKey_key` (unique) | **delivery dedup** — one run per event / webhook event id / occurrence |
| `AgentTriggerRun_taskId_key` (unique, nullable) | a task is linked to at most one run |
| `AgentTriggerRun_activeSlotKey_key` / `_pendingSlotKey_key` (unique, nullable) | **concurrency slots** decided by the database |
| `activeSince` | when the active slot was taken (stale-holder detection) |
| `(triggerId, receivedAt)` | run history per trigger |
| FK `AgentTrigger.connectionId -> AgentConnection` ON DELETE CASCADE | triggers never outlive their connection |
| FK `AgentTriggerRun.triggerId -> AgentTrigger` ON DELETE CASCADE | runs belong to their trigger |
| FK `AgentTask.triggerId -> AgentTrigger` ON DELETE SET NULL | deleting a trigger keeps task history |

## Tenant isolation

Owner, team and environment on a trigger are copied from the connection at creation and never accepted as input; the trigger acts only as that connection. Webhook lookups are by `publicRef` and require type WEBHOOK + ACTIVE; unknown and inactive refs are indistinguishable. Trigger tasks are owner-scoped like every Phase 8 task.

## Rollback safety

```sql
ALTER TABLE "AgentTask" DROP CONSTRAINT "AgentTask_triggerId_fkey";
DROP INDEX "AgentTask_triggerId_idx";
ALTER TABLE "AgentTask" DROP COLUMN "triggerId";
DROP TABLE "AgentTriggerRun"; DROP TABLE "AgentTrigger";
DROP TYPE "AgentTriggerRunStatus"; DROP TYPE "AgentTriggerMissedRunPolicy";
DROP TYPE "AgentTriggerConcurrency"; DROP TYPE "AgentTriggerStatus"; DROP TYPE "AgentTriggerType";
```

Nothing outside the agent gateway references these objects.

## Representative operations (verified against the fake, which reproduces these constraints)

- 10 concurrent deliveries under `DROP_WHILE_RUNNING` -> 1 slot holder, 1 task;
- 3 concurrent ticks on one occurrence -> 1 run (conditional `nextRunAt` claim);
- duplicate event / webhook event id -> unique `(triggerId, deliveryKey)` violation -> `DUPLICATE`;
- optimistic edits: `WHERE version = expected` -> exactly one of two racing admins wins.

Not verified against a live Postgres: no isolated test database exists in this environment, and the migration is not applied.
