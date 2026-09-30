# Phase 8 — Idempotency

Duplicate submissions never create duplicate work. Enforcement is by **database uniqueness**, not Redis — the existing Phase 4 idempotency cache deliberately fails open when Redis is down, which is not acceptable here.

| Submission | Identity | Result |
|---|---|---|
| with key K, same operation as an existing task | `idempotencyScope = "<connectionId>:K"` (unique) | the existing task, no new task or job |
| with key K, different capability / version / resource / input | same | `IDEMPOTENCY_CONFLICT` |
| without key, identical to an in-flight task | `activeOperationKey` = sha256 of (connection, capability, version, resource, input digest) — unique, set only while non-terminal | the in-flight task |
| without key, after that task finished | key released on the terminal transition | a new task |
| key required by the capability, none given | — | `IDEMPOTENCY_KEY_REQUIRED` |

Keys are always scoped to the calling connection: the same key from another connection is a different task. Keys must be 8–128 characters of `[A-Za-z0-9._:-]`.

## Concurrency

Ten concurrent identical submissions (keyed and key-less) produce exactly one task and one job: every loser hits the unique constraint (P2002), re-reads, and returns the winner. Tested in `p8-task-engine.test.ts`.

## Restarts

Because identities live in Postgres, a restarted process (tested with a fresh service instance) still resolves the same key to the same task.

## Approval-required submissions

If two identical submissions race and one consumes the approval, the other is denied by the gate; the engine then re-checks for the winner's task and returns it if it already exists. No approval is ever consumed twice and no second task is created.

## Release on enqueue failure

When a task is created but its first job cannot be enqueued, the task is `FAILED (QUEUE_UNAVAILABLE)` and its `idempotencyScope` is set to null in the same update, so the agent can retry with the same key.

## Execution-level idempotency

Each attempt is one job with a deterministic id and a conditional claim on the attempt number, so a duplicate delivery runs the business operation once (tested with two concurrent deliveries of the same job, and with real BullMQ).
