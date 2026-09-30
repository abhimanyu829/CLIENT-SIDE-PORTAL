# Phase 8 — Queue Integration

## Reused infrastructure

- Queue: `agentTaskQueue = createLazyQueue("agent-task")` in `lib/queue.ts`, next to every other queue, on the same `REDIS_URL` connection.
- Job names: `AGENT_TASK_JOBS = { EXECUTE: "agent-task.execute", MAINTENANCE: "agent-task.maintenance" }` (the `*_JOBS` convention).
- Retention: `removeOnComplete {count: 100}`, `removeOnFail {count: 500}` (the existing defaults).

No new Redis client, queue library or worker application.

## Why a dedicated queue

Agent tasks need their own worker (re-verification before every attempt) and must not share retry semantics with business queues. A named queue on the existing stack is the smallest way to get that.

## One job per attempt

The engine, not BullMQ, decides retries. Attempt *n* is one job with id `<taskId>-a<n>` (BullMQ forbids `:` in custom ids). Enqueueing the same attempt twice yields one job. BullMQ's own `attempts: 3` only covers failures before an attempt is claimed (the task store was unreachable when the job arrived) — those never dispatch anything.

## Payload

```
{ taskId, attempt, capabilityId, capabilityVersion, adapterId, environment, idempotencyRef }
```

References only (strict zod schema). Never the input, identity, credentials, tokens or secrets. The worker loads the task row and treats it as the only source of execution parameters; a payload that disagrees with the row is tampering (see `09-task-security.md`).

## Fail closed

`createLazyQueue` returns a proxy that silently does nothing when `REDIS_URL` is unset. `BullTaskQueue` never trusts that:

- `REDIS_URL` unset -> `QUEUE_UNAVAILABLE` before the gate runs (no approval can be consumed);
- `add()` returning no job, throwing, or not finishing within `AGENT_GATEWAY_TASK_ENQUEUE_TIMEOUT_MS` -> `QUEUE_UNAVAILABLE`; the just-created task is moved `QUEUED -> FAILED(QUEUE_UNAVAILABLE)` and its idempotency key released, so it is never reported as queued.

If an ambiguous timed-out `add()` later succeeds, the job finds a terminal task and exits without dispatch.

## Verified against real BullMQ

`p8-bullmq.integration.ts` (opt-in, Memurai): real job creation and processing, deterministic ids (one job), real delayed retry, jobs surviving a worker restart, stalled-job recovery after a simulated crash, and an unreachable Redis failing closed.
