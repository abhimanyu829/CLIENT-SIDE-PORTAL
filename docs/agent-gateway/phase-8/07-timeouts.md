# Phase 8 — Timeouts

| Limit | Default | Config | Measured from | Outcome |
|---|---|---|---|---|
| Queue timeout | 15 min | `AGENT_GATEWAY_TASK_QUEUE_TIMEOUT_MS` | entry into QUEUED / RETRY_QUEUED (`queuedAt`) | EXPIRED `TASK_EXPIRED`, never dispatched |
| Execution timeout | 60 s | `AGENT_GATEWAY_TASK_EXECUTION_TIMEOUT_MS` | start of the RUNNING attempt | TIMED_OUT `TASK_TIMEOUT` |
| Overall deadline | 1 h (capped by a bound approval's expiry) | `AGENT_GATEWAY_TASK_DEADLINE_MS` | creation | EXPIRED before dispatch, TIMED_OUT while running |
| Enqueue timeout | 5 s | `AGENT_GATEWAY_TASK_ENQUEUE_TIMEOUT_MS` | `add()` call | QUEUE_UNAVAILABLE |

The deadline is exclusive: dispatch only while `now < expiresAt`; the instant itself expires (tested 1 ms before and at the boundary).

## What a timeout means

- **Before start** (queue timeout / deadline): cancel-before-start. The task never reaches an adapter.
- **During execution**: the worker aborts the `AbortSignal` it passed to the adapter and marks the task TIMED_OUT. The current READ adapters check the signal only before calling their service, so the underlying query may still complete — **mark timed out while the service continues**. Its result is discarded (the `RUNNING -> SUCCEEDED` update fails because the task is already TIMED_OUT). The status view says so explicitly: "The underlying service call may still have completed; its result was discarded."
- **After completion**: no effect; terminal tasks are never touched.

## Where the rules are enforced

At worker claim, at every status read and cancel (lazily, with a conditional transition), and in the maintenance sweep (crashed workers). No new scheduler.
