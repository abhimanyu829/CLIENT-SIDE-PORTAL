# Phase 8 — Database Verification

Migration: `prisma/migrations/20261002000000_agent_gateway_phase8_task_engine/migration.sql` — hand-written, additive, **not applied** (applying all Phase 6–10 migrations is deferred until after Phase 15, per the rollout plan). Order: after `20261001000000` (Phase 7), because of the foreign key to `AgentApprovalRequest`.

| Check | Result |
|---|---|
| `prisma validate` | valid |
| `prisma generate` | generated; the engine typechecks against `db.agentTask` |
| Schema diff | additive: enums `AgentTaskStatus`, `AgentTaskRetryClass`; model `AgentTask`; back-relations `AgentConnection.tasks`, `AgentApprovalRequest.task`. No existing column changed |

## SQL review

| Object | Purpose |
|---|---|
| `AgentTask_taskRef_key` (unique) | unguessable public reference |
| `AgentTask_idempotencyScope_key` (unique, nullable) | one task per connection + idempotency key |
| `AgentTask_activeOperationKey_key` (unique, nullable) | one in-flight key-less task per identical operation |
| `AgentTask_approvalRequestId_key` (unique, nullable) | one approval binds at most one task |
| `(connectionId, status)`, `(status, expiresAt)`, `(ownerId, createdAt)`, `(finishedAt)` | owner lists, sweeps, retention |
| FK `connectionId -> AgentConnection` ON DELETE CASCADE | tasks never outlive their connection |
| FK `approvalRequestId -> AgentApprovalRequest` ON DELETE SET NULL | approval history can be purged without deleting tasks |
| CHECK `attempts BETWEEN 0 AND maxAttempts`, `maxAttempts BETWEEN 1 AND 10` | bounded retries |
| CHECK `NOT retryScheduled OR status = 'FAILED'` | a retry flag cannot linger on another state |

## Tenant isolation

Every read by an agent is keyed by `taskRef` and then checked against the caller's `connectionId` AND `ownerId`; a mismatch is indistinguishable from not found. Idempotency and operation keys embed the connection id. There is no query path across tenants.

## Rollback safety

The migration only creates objects. Rollback: `DROP TABLE "AgentTask"; DROP TYPE "AgentTaskStatus"; DROP TYPE "AgentTaskRetryClass";`. Nothing else depends on them.

## Representative operations (verified against the fake, which reproduces these constraints)

- 10 concurrent identical submissions -> 1 row (unique violation path);
- conditional transitions with `status IN (...)` and `attempts = n` -> exactly one winner;
- retention: result cleared, then row deleted; non-terminal rows untouched.

Not verified against a live Postgres: no isolated test database exists in this environment, and the migration is not applied.
