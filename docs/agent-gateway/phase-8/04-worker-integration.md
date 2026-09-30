# Phase 8 — Worker Integration

The `agent-task` processor is registered inside the existing `startWorkers()` in `lib/workers.ts` through the existing `startWorker()` helper — same process (`npm run workers`), same Redis connection, same failed/completed logging. It is registered only when `AGENT_GATEWAY_TASKS_ENABLED` is on; otherwise the worker process is unchanged. On start it runs one reconciliation pass; `scheduleRecurringJobs()` adds a `*/5 * * * *` maintenance job on the same repeatable-job mechanism the subscription and payment reconcilers use.

## Per job

1. Parse the payload (strict). Malformed -> logged, ignored.
2. Load the task by id. **Store unreachable -> throw** (BullMQ redelivers; nothing claimed). Unknown id -> `TASK_NOT_FOUND` logged, ignored. Terminal -> ignored.
3. Compare the payload with the row. Mismatch -> task `FAILED EXECUTION_FAILED / PAYLOAD_INTEGRITY`, security event, no dispatch.
4. By state:
   - `QUEUED / RETRY_QUEUED`, attempt = stored + 1 -> run the attempt;
   - `STARTING`, same attempt -> previous worker died before dispatch -> retry per class;
   - `RUNNING`, same attempt -> previous worker died mid-run -> SAFE_RETRY retries, everything else `FAILED / WORKER_INTERRUPTED` (never executed twice);
   - `CANCELLING`, same attempt -> SAFE_RETRY `CANCELLED`, otherwise `FAILED`;
   - any other attempt number -> stale job, `TASK_ALREADY_RUNNING` logged, ignored.
5. Run the attempt: time rules -> atomic claim -> re-verification (`guard.ts`) -> `STARTING -> RUNNING` -> Phase 4 `AdapterResolver.execute()` under the execution timeout -> outcome recorded atomically.

## Execution

The worker never calls an adapter directly. It calls the existing Phase 4 `AdapterResolver` with a request context built from the task's stored, server-derived identity (`credentialId` is `agent-task:<taskRef>` — explicitly not a credential). The resolver re-runs its own hard safety checks, schema validation, environment check, idempotency guard and output-contract validation. No business service changed.

## Environment

The worker's `AGENT_GATEWAY_ENVIRONMENT` must equal the task's environment and the connection's recorded environment; otherwise the task expires (`TASK_EXPIRED / ENVIRONMENT_MISMATCH`). The worker process therefore needs the same gateway configuration as the web process.
