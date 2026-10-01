# Phase 9 — Concurrency

## Modes

| Mode | Behaviour |
|---|---|
| `DROP_WHILE_RUNNING` (default) | at most one live task per trigger; a delivery while one is live is recorded `DROPPED CONCURRENCY_LIMIT` |
| `QUEUE_ONE` | one live task plus one waiting run; further deliveries are `DROPPED COALESCED`; the waiting run starts when the slot frees |
| `ALLOW_PARALLEL` | every distinct delivery creates its own task |

`SINGLE_ACTIVE` is the invariant both `DROP_WHILE_RUNNING` and `QUEUE_ONE` enforce (never two live tasks for one trigger), so it is not a separate mode.

## How the database decides

`AgentTriggerRun` has two unique, nullable columns:

- `activeSlotKey` — set to the trigger id on the run that holds the trigger's single active slot;
- `pendingSlotKey` — set to the trigger id on the single waiting run (`QUEUE_ONE`).

Claiming a slot is one conditional update; a unique violation means someone else holds it. Ten concurrent deliveries under `DROP_WHILE_RUNNING` produce exactly one task (tested).

## Releasing a slot

The slot is held until the holder's task is terminal (`SUCCEEDED`, final `FAILED`, `CANCELLED`, `EXPIRED`, `TIMED_OUT`). Release is lazy and database-driven:

- the next delivery checks the holder's task and frees the slot when it is finished;
- every tick promotes waiting `QUEUE_ONE` runs whose slot has freed (≤ 60 s latency);
- a holder that never recorded a task within 10 minutes of `activeSince` is stale (the firing process died): its task is recovered by idempotency scope if it exists, otherwise the run is marked `FAILED TASK_CREATION_FAILED` and the slot freed. A trigger can never be blocked forever.

Waiting runs of a trigger that is paused, disabled, expired or revoked are dropped (`TRIGGER_INACTIVE`) instead of starting later.

## Schedules

Occurrence claiming is separate from task concurrency: the conditional `nextRunAt` update guarantees one run per occurrence even with several ticks or workers; the concurrency mode then decides whether that run may start a task.
