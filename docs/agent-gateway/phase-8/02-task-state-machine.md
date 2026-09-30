# Phase 8 — Task State Machine

```
QUEUED       -> STARTING | CANCELLED | EXPIRED | FAILED
STARTING     -> RUNNING  | CANCELLED | EXPIRED | FAILED
RUNNING      -> SUCCEEDED | FAILED | CANCELLING | TIMED_OUT
CANCELLING   -> CANCELLED | SUCCEEDED | FAILED | TIMED_OUT
FAILED       -> RETRY_QUEUED          (only while retryScheduled = true)
RETRY_QUEUED -> STARTING | CANCELLED | EXPIRED | FAILED
```

Terminal: SUCCEEDED, CANCELLED, EXPIRED, TIMED_OUT, and FAILED with `retryScheduled = false`. There is no path out of a terminal state (tested for all 100 status pairs).

Deviation from the conceptual diagram: a retry goes `RETRY_QUEUED -> STARTING -> RUNNING` rather than straight to RUNNING, so the worker-time re-verification runs before every attempt, retries included.

## Atomicity

`store.transitionTask()` is the only writer. Each transition is one `updateMany` whose `WHERE` carries `status IN (<from>)` and, where it matters, `attempts = <n>`; success means `count === 1`. Consequences:

- a worker claim (`QUEUED/RETRY_QUEUED -> STARTING`, attempts n-1 -> n) and a cancel (`-> CANCELLED`) can never both win;
- a stale job for an old attempt cannot move the task;
- a late result after `TIMED_OUT` fails its `RUNNING -> SUCCEEDED` update and is discarded;
- `FAILED -> RETRY_QUEUED` additionally requires `retryScheduled = true`, so a final failure can never be re-queued.

Terminal transitions also clear `activeOperationKey` (the in-flight dedupe key) in the same update, and set `finishedAt` (retention reference).

## Timestamps

| Transition | Fields |
|---|---|
| -> STARTING | `attemptStartedAt` (claim) |
| -> RUNNING | `attemptStartedAt` (execution-timeout reference), `startedAt` (first run) |
| -> SUCCEEDED | `completedAt`, `finishedAt`, `result` |
| -> FAILED | `failedAt` (+ `finishedAt` when final) |
| -> CANCELLED | `cancelledAt`, `finishedAt` |
| -> EXPIRED / TIMED_OUT | `finishedAt` |
| -> RETRY_QUEUED | `queuedAt` (queue-timeout reference), `retryScheduled = false` |
| -> CANCELLING | `cancelRequestedAt` |

A database CHECK constraint also enforces `retryScheduled` only on FAILED rows and `0 <= attempts <= maxAttempts <= 10`.
