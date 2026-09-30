# Phase 8 — Task Recovery

Recovery relies on BullMQ's own durability (waiting/delayed jobs persist in Redis; an active job whose lock is not renewed is detected as stalled and redelivered) plus Postgres as the source of truth.

| Failure | Behaviour | Duplicate mutation? |
|---|---|---|
| Worker crashes before claiming | job redelivered; claimed normally | no |
| Task store down when the job arrives | worker throws; BullMQ redelivers with backoff; nothing claimed | no |
| Worker crashes after claim, before dispatch (STARTING) | redelivered job (or the maintenance pass after `AGENT_GATEWAY_TASK_STARTING_GRACE_MS`) treats it as a pre-dispatch failure -> retry | no |
| Worker crashes mid-run (RUNNING) | stalled job redelivered: SAFE_RETRY retries; CONDITIONAL / NO_RETRY -> `FAILED EXECUTION_FAILED / WORKER_INTERRUPTED` | no — non-idempotent work is never re-run |
| Crash between `FAILED(retry)` and `RETRY_QUEUED` | maintenance completes the retry step | no |
| Redis restarted without persistence (jobs lost) | maintenance re-enqueues QUEUED / RETRY_QUEUED tasks whose job is missing, under the deterministic id | no — claim is conditional on the attempt |
| Server restart | tasks and idempotency identities are in Postgres | no |
| Network interruption during enqueue | enqueue timeout -> task `FAILED QUEUE_UNAVAILABLE`; a late job finds a terminal task | no |
| Partial write (result stored, job not completed) | redelivery finds a terminal task and exits | no |
| Malformed result | FAILED, nothing stored | no |

Verified: the stalled-job case with real BullMQ against Memurai (a worker is force-closed mid-attempt; a second worker recovers the job; the read re-runs once, the write is marked FAILED and never runs twice), plus every row above with the in-memory suite.

## Maintenance pass

`runTaskMaintenance()` — once at worker start and every 5 minutes via the existing repeatable-job mechanism:

1. sweep: pending past queue timeout / deadline -> EXPIRED; running past execution timeout / deadline -> TIMED_OUT;
2. recover STARTING attempts older than the grace period;
3. complete lost retry steps;
4. re-enqueue pending tasks whose job is missing;
5. retention: clear results after 7 days, delete terminal rows after 30 days (non-terminal rows are never touched).

Each step is independent; a failing step is counted and logged and never blocks the others.
