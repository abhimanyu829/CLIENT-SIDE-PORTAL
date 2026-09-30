# Phase 8 — Cancellation

`agent_task_cancel { taskRef }` — owner-scoped. Outcomes are honest; cancellation is never faked.

| Current state | Result |
|---|---|
| QUEUED / RETRY_QUEUED | `CANCELLED`; the pending job is removed (best effort — if it still runs, it finds a terminal task and does nothing) |
| STARTING | `CANCELLED`; the worker's `STARTING -> RUNNING` then fails, so nothing is dispatched |
| FAILED with a retry scheduled | the canceller takes the retry slot (`FAILED -> RETRY_QUEUED`) and cancels it: `CANCELLED` |
| RUNNING, adapter declares `cooperativeCancellation` | `CANCELLING`, answer `CANCELLATION_REQUESTED`; the worker aborts the signal; `CANCELLED` once the adapter stops, or `SUCCEEDED` / `FAILED` if it finished first |
| RUNNING, adapter does not | `CANCELLATION_UNAVAILABLE`, task stays RUNNING |
| CANCELLING | `CANCELLATION_REQUESTED` |
| CANCELLED / EXPIRED / TIMED_OUT | `TASK_CANCELLED` / `TASK_EXPIRED` / `TASK_TIMEOUT`, unchanged |
| SUCCEEDED / final FAILED | `TASK_ALREADY_COMPLETED`, unchanged |

None of the current READ adapters can be interrupted mid-query, so none declares `cooperativeCancellation`: cancelling a running READ returns `CANCELLATION_UNAVAILABLE`. The cooperative path is implemented and tested with a fixture adapter.

## Races

Cancel vs claim is decided by the conditional update: exactly one wins, and a cancelled task is never dispatched (tested repeatedly in `p8-task-engine.test.ts`). If a worker moves the task between the canceller's read and write, the canceller re-reads once and answers for the new state.
