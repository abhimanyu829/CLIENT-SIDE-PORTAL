# Phase 9 — Idempotency

The guarantee: **one delivery -> at most one run -> at most one task -> the Phase 8 execution guarantees.**

## Run

`AgentTriggerRun` has a unique `(triggerId, deliveryKey)`. `fire()` inserts the run first (status `PENDING`); a unique violation means the delivery was already seen:

- if the existing run failed transiently (`QUEUE_UNAVAILABLE`, `TASK_CREATION_FAILED`) it is re-armed in one conditional update and retried;
- otherwise the answer is `DUPLICATE` with the existing `runRef`.

## Task

The run submits with `idempotencyKey = trigger.<run ref hex>` (deterministic per run). Phase 8 scopes keys by connection, so the task identity is `<connectionId>:trigger.<hex>`:

- a retried run finds its existing task (`created: false`) and links it;
- a task whose enqueue failed released its key (Phase 8), so the retried run creates a fresh task and never reports a task that was not queued;
- `AgentTriggerRun.taskId` is unique: one task is linked to at most one run.

## Crash windows

| Crash point | Recovery |
|---|---|
| before the run insert | the caller retries (webhook 503 / BullMQ retry); nothing was recorded |
| after the run insert, before the task | stale-holder recovery (10 min, measured from `activeSince`) marks the run `FAILED TASK_CREATION_FAILED` and frees the slot; for webhooks the sender's retry re-arms it |
| after the task insert, before the run is updated | stale-holder recovery finds the task by its idempotency scope and records `TASK_CREATED` |
| after enqueue | Phase 8 durability (worker / maintenance) |

## Execution

Everything after task creation is Phase 8: one BullMQ job per attempt, the claim-by-attempt transition, retry classes from capability metadata, and the worker-time guard.
