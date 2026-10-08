# Requirements Document

## Introduction

Phase 8 adds the Async Task Engine to the Abhibhi Agent Gateway. It is an orchestration layer for agent-originated asynchronous work. It lets an authenticated agent submit an operation for asynchronous execution, then read the status and filtered result of its own tasks and cancel them, all through the existing MCP boundary.

Async flow: Gateway → Identity → Capability → Authorization → Autonomy/Approval → Execution_Gate → Task_Engine → Agent_Task_Queue → Task_Worker (inside the existing worker process) → Phase 4 adapter → existing business service. The SYNC path stays unchanged. The Task_Engine does not replace any business worker.

The first real async capabilities are the existing READ capabilities `products.list`, `products.get`, `subscriptions.get` and `tickets.list`. They run as SAFE_RETRY with no business-service changes. The write-path behaviours (CONDITIONAL_RETRY, NO_RETRY, approval binding) are proven with test fixtures only. `products.createDraft` stays without an adapter.

Out of scope: triggers, schedules and webhooks (Phase 9); the governance dashboard (Phase 10); the audit ledger and rollback (Phase 11+); a second BullMQ, Redis or worker framework; workflow, DAG or parent/child task orchestration; applying database migrations (deferred until after Phase 15).

## Glossary

- **Task_Engine**: The Phase 8 module under `lib/agent-gateway/` that creates Agent_Tasks and owns their lifecycle, retry, timeout, cancellation and recovery.
- **Agent_Task**: The durable record of one agent-originated asynchronous operation.
- **Task_Store**: The Prisma-backed database storage for Agent_Task records. The Task_Store is the source of truth for task state.
- **Task_Reference**: The unpredictable, display-safe identifier of an Agent_Task returned to the agent. It is distinct from the Agent_Task primary key, requestId, capabilityId, approvalRequestId and connectionId.
- **Agent_Task_Queue**: The single dedicated BullMQ queue for Agent_Tasks, created with the `lib/queue.ts` conventions.
- **Task_Job**: One BullMQ job on the Agent_Task_Queue, representing one attempt of one Agent_Task.
- **Queue_Payload**: The data carried by a Task_Job.
- **Task_Worker**: The Agent_Task_Queue processor, registered in `startWorkers()` in `lib/workers.ts`.
- **Worker_Guard**: The worker-time re-verification step that runs before each attempt dispatches to an adapter.
- **Attempt**: One claimed execution try of an Agent_Task. The attempt counter increments when the Task_Worker claims the task.
- **Execution_Gate**: The existing Phase 7 `ExecutionGate` (identity, authorization, autonomy, approval), wired in `mcp/route-handler.ts`.
- **Policy_Authorizer**: The existing Phase 6 `PolicyEngineAuthorizer.decide()`.
- **Capability_Registry**: The existing Phase 3 capability registry and manifest (`lib/agent-gateway/capabilities/`).
- **Adapter_Registry**: The existing Phase 4 adapter registry (`lib/agent-gateway/execution/`).
- **Connection_Service**: The existing Phase 2 identity connection service (statuses ACTIVE, SUSPENDED, REVOKED, EXPIRED).
- **MCP_Server**: The existing MCP boundary (`mcp/server.ts`, `mcp/route-handler.ts`).
- **Task_Tools**: The gateway-reserved MCP tools for async submission (Submit_Tool), status and result retrieval (Status_Tool), and cancellation (Cancel_Tool).
- **Security_Context**: The connectionId, agentId, ownerId, teamId and environment derived on the server from the authenticated connection. The Security_Context is never read from a client payload.
- **Async_Capable_Capability**: A capability whose Capability_Registry metadata declares async support and whose `executionReference` is non-null.
- **Retry_Class**: One of SAFE_RETRY, CONDITIONAL_RETRY or NO_RETRY, derived from Phase 3/4 capability metadata.
- **Input_Digest**: The SHA-256 hex digest of the canonical JSON (Phase 7 canonicalization) of the validated capability input.
- **Binding_Digest**: The Phase 7 approval binding digest computed over the canonical operation binding.
- **Operation_Key**: The tuple connectionId, capabilityId, capabilityVersion, resourceType, resourceId and Input_Digest.
- **Transient_Failure**: An attempt failure with Phase 4 `ExecutionErrorCode` EXECUTION_UNAVAILABLE, TIMEOUT or INTERNAL_ERROR, or an infrastructure failure before adapter dispatch.
- **Pre_Dispatch_Failure**: An attempt failure that occurs while the Agent_Task is STARTING, before the adapter is invoked.
- **Queue_Timeout**: The maximum time an Agent_Task may remain in QUEUED or RETRY_QUEUED, measured from entry into that state.
- **Execution_Timeout**: The maximum duration of one RUNNING attempt.
- **Overall_Deadline**: The absolute time (`expiresAt`) after which an Agent_Task may no longer start or run.
- **Terminal_State**: SUCCEEDED, CANCELLED, EXPIRED, TIMED_OUT, or FAILED with no retry scheduled.
- **Result_Filter**: The step that validates adapter output against the capability's `outputSchema` and keeps only the parsed business result.
- **Recovery_Reconciler**: The callable function that reconciles non-terminal Agent_Tasks in the Task_Store with the Agent_Task_Queue.
- **Task_Event**: An observability event about an Agent_Task, emitted through the existing `gatewayLogger`, audit hook and metrics.
- **Default_Suite**: The test run executed by `vitest run`, using in-memory fakes only.
- **Integration_Suite**: The opt-in test suite that runs real BullMQ queues and workers against local Memurai.

## Requirements

### Requirement 1: Async capability declaration

**User Story:** As a gateway maintainer, I want READ capabilities to declare async support alongside their existing SYNC mode, so that agents can run them asynchronously without changing the SYNC path.

#### Acceptance Criteria

1. THE Capability_Registry SHALL accept a capability definition that declares async support in addition to its default `async.executionMode`, with the meaning of `async.executionMode` unchanged.
2. THE Capability_Registry SHALL treat a capability without an async-support declaration as SYNC-only.
3. THE manifest SHALL declare async support, naming the Agent_Task_Queue in the async `queue` and `worker` metadata, for `products.list`, `products.get`, `subscriptions.get` and `tickets.list`.
4. THE manifest SHALL keep `products.createDraft`, `coupons.create`, `products.updatePricing` and `refunds.process` SYNC-only.
5. IF a capability declaring async support has status DISABLED, exposure FORBIDDEN, or a null `executionReference`, THEN THE Capability_Registry SHALL reject the definition at registration with a validation error.
6. WHEN an Async_Capable_Capability is invoked through its existing capability tool, THE MCP_Server SHALL execute the capability synchronously with the same behaviour and result shape as before Phase 8.

### Requirement 2: Async submission through the existing gate

**User Story:** As an agent, I want to submit an operation for asynchronous execution through MCP, so that long-running work does not block my session, while every existing security check still applies.

#### Acceptance Criteria

1. THE Submit_Tool SHALL accept only a capability id, the capability input and an optional idempotency key, and SHALL reject any other argument, with no change to any capability input schema.
2. WHEN a submission is received, THE Task_Engine SHALL create an Agent_Task only after identity resolution, capability resolution, input validation and the Execution_Gate have allowed the operation, using the same components as the SYNC path.
3. IF the submitted capability is not an Async_Capable_Capability with exposure AGENT_AVAILABLE and status ACTIVE, THEN THE Task_Engine SHALL reject the submission with the existing capability-not-found or CAPABILITY_DISABLED error and create no Agent_Task.
4. IF the Execution_Gate denies the operation, including when approval is required, THEN THE Task_Engine SHALL return the Execution_Gate's denial code and create no Agent_Task.
5. THE Task_Engine SHALL derive the Security_Context, capability version, adapterId, resource, Retry_Class, maxAttempts, Queue_Timeout, Execution_Timeout and Overall_Deadline on the server.
6. WHEN a submission is accepted, THE Submit_Tool SHALL return the Task_Reference and the current task status.

### Requirement 3: Task record and identity

**User Story:** As a gateway maintainer, I want each async task stored durably with a stable, independent identity and only the fields it needs, so that the task can be executed, verified and audited later.

#### Acceptance Criteria

1. THE Task_Store SHALL persist for each Agent_Task: Task_Reference, requestId, connectionId, agentId, ownerId, teamId, capabilityId, capabilityVersion, adapterId, environment, resourceType, resourceId, canonical input, Input_Digest, approvalRequestId, authorization policy reference, autonomy policy version, Retry_Class, status, attempts, maxAttempts, createdAt, startedAt, completedAt, failedAt, cancelledAt, expiresAt, result and errorCode.
2. THE Task_Engine SHALL generate each Task_Reference from at least 128 bits of cryptographically secure randomness.
3. THE Task_Store SHALL enforce uniqueness of the Task_Reference with a database constraint.
4. THE Task_Store SHALL hold no credentials, tokens, secrets or raw request headers.
5. THE Phase 8 schema change SHALL consist of a Prisma model following existing `Agent*` naming plus a hand-written migration, and the migration SHALL remain unapplied.

### Requirement 4: Task state machine

**User Story:** As a gateway maintainer, I want an explicit, atomic task state machine, so that a task can never reach an invalid or contradictory state.

#### Acceptance Criteria

1. THE Task_Engine SHALL use exactly the states QUEUED, STARTING, RUNNING, CANCELLING, SUCCEEDED, FAILED, RETRY_QUEUED, CANCELLED, EXPIRED and TIMED_OUT.
2. THE Task_Engine SHALL permit only the transitions listed in Table 1.
3. THE Task_Engine SHALL permit no transition out of a Terminal_State.
4. THE Task_Engine SHALL perform each transition as one atomic conditional update that succeeds only when the stored status and attempt number equal the expected values.
5. IF a transition's expected status or attempt number differs from the stored values, THEN THE Task_Engine SHALL leave the Agent_Task unchanged and report the transition as rejected.
6. WHEN a transition succeeds, THE Task_Engine SHALL set the timestamp of the target state in the same atomic update.
7. WHEN an Agent_Task transitions to FAILED, THE Task_Engine SHALL record in the same atomic update whether a retry is scheduled.

Table 1: Permitted transitions

| From | To |
|---|---|
| QUEUED | STARTING, CANCELLED, EXPIRED, FAILED (enqueue or Queue_Payload integrity failure only) |
| STARTING | RUNNING, CANCELLED, EXPIRED, FAILED |
| RUNNING | SUCCEEDED, FAILED, CANCELLING, TIMED_OUT |
| CANCELLING | CANCELLED, SUCCEEDED, FAILED, TIMED_OUT |
| FAILED (retry scheduled) | RETRY_QUEUED |
| RETRY_QUEUED | RUNNING, CANCELLED, EXPIRED, FAILED |

### Requirement 5: Queue integration

**User Story:** As a platform maintainer, I want agent tasks to use the existing BullMQ conventions and fail closed when the queue is unavailable, so that no work is silently dropped and no second queue framework appears.

#### Acceptance Criteria

1. THE Task_Engine SHALL use one dedicated Agent_Task_Queue created through `createLazyQueue`, with job names declared in an `*_JOBS` constant, and SHALL add no other queue, Redis client or worker framework.
2. THE Queue_Payload SHALL contain only taskId, capabilityId, capabilityVersion, adapterId, environment and an idempotency reference.
3. THE Task_Engine SHALL assign each Task_Job a deterministic job id derived from the taskId and attempt number, so that enqueuing the same attempt twice yields one Task_Job.
4. IF `REDIS_URL` is unset, the Agent_Task_Queue is unreachable, or an enqueue is not confirmed within the configured enqueue timeout, THEN THE Task_Engine SHALL return QUEUE_UNAVAILABLE and SHALL NOT report the task as QUEUED.
5. WHEN queue unavailability is detected before the Execution_Gate runs, THE Task_Engine SHALL return QUEUE_UNAVAILABLE with no Agent_Task created and no approval consumed.
6. IF enqueuing fails after the Agent_Task was created, THEN THE Task_Engine SHALL transition the task from QUEUED to FAILED with errorCode QUEUE_UNAVAILABLE, schedule no retry, and release the task's idempotency identity.

### Requirement 6: Worker integration

**User Story:** As a platform maintainer, I want agent tasks processed by the existing worker process through the existing adapters, so that no business service or worker app changes.

#### Acceptance Criteria

1. THE Task_Worker SHALL be registered through `startWorker()` inside the existing `startWorkers()` in `lib/workers.ts`, with no additional worker process or entry point.
2. WHEN the Task_Worker receives a Task_Job, THE Task_Worker SHALL load the Agent_Task from the Task_Store by taskId and use the stored record as the only source of execution parameters.
3. IF any Queue_Payload field differs from the stored Agent_Task, THEN THE Task_Worker SHALL transition the task to FAILED with errorCode EXECUTION_FAILED and no retry, without adapter dispatch, and emit a security Task_Event.
4. IF the Queue_Payload taskId matches no Agent_Task, THEN THE Task_Worker SHALL complete the Task_Job without adapter dispatch and log TASK_NOT_FOUND.
5. WHEN the Task_Worker receives a Task_Job for an Agent_Task in a Terminal_State, THE Task_Worker SHALL complete the Task_Job without adapter dispatch and without changing the Agent_Task.
6. THE Task_Worker SHALL dispatch through the Adapter_Registry using the stored adapterId, with no change to any business service.
7. THE Task_Worker SHALL tag every log line and Task_Event of an attempt with taskId, Task_Reference, requestId, attempt number and BullMQ job id.

### Requirement 7: Worker-time re-verification

**User Story:** As a security owner, I want every attempt to re-check identity, capability, authorization, approval, environment and integrity just before execution, so that revocation, policy downgrade, approval expiry or capability disablement after queuing stops the task.

#### Acceptance Criteria

1. WHEN the Task_Worker claims an Agent_Task for any attempt, including a retry, THE Worker_Guard SHALL perform the checks in criteria 2 to 8 before adapter dispatch.
2. IF the Connection_Service's authoritative (uncached) status for the task's connection is not ACTIVE, THEN THE Worker_Guard SHALL transition the task to EXPIRED with errorCode AUTHORIZATION_REVOKED.
3. IF the Policy_Authorizer, evaluated with the stored Security_Context, capability and resource, denies the operation, THEN THE Worker_Guard SHALL transition the task to EXPIRED with errorCode AUTHORIZATION_REVOKED.
4. IF the current autonomy evaluation requires an approval that is not bound to the task, THEN THE Worker_Guard SHALL transition the task to EXPIRED with errorCode AUTHORIZATION_REVOKED.
5. IF the stored capability version no longer resolves as ACTIVE, or its current adapterKey differs from the stored adapterId, THEN THE Worker_Guard SHALL transition the task to EXPIRED with errorCode CAPABILITY_DISABLED.
6. IF the task's environment differs from the worker's server environment, THEN THE Worker_Guard SHALL transition the task to EXPIRED with errorCode TASK_EXPIRED.
7. IF the Input_Digest recomputed from the stored canonical input differs from the stored Input_Digest, THEN THE Worker_Guard SHALL transition the task to FAILED with errorCode EXECUTION_FAILED and no retry, and emit a security Task_Event.
8. IF the current time is at or after the Overall_Deadline, THEN THE Worker_Guard SHALL transition the task to EXPIRED with errorCode TASK_EXPIRED.

### Requirement 8: Approval and authorization binding

**User Story:** As a security owner, I want a queued task to execute exactly the operation that was authorized and approved, so that nothing can be substituted between approval and execution.

#### Acceptance Criteria

1. WHERE the Execution_Gate consumes an approval for a submission, THE Task_Engine SHALL store that approvalRequestId on the Agent_Task and create the task only when the approval's bindingDigest equals the Binding_Digest computed from the task's server-derived operation.
2. THE Task_Engine SHALL bind each approval to at most one Agent_Task.
3. WHERE an Agent_Task is bound to an approval, THE Task_Engine SHALL set the Overall_Deadline no later than the approval's `expiresAt`.
4. IF, at worker time, the bound approval is not consumed, its bindingDigest differs from the Binding_Digest recomputed from the stored task, or the current time is at or after the approval's `expiresAt`, THEN THE Worker_Guard SHALL transition the task to EXPIRED with errorCode APPROVAL_EXPIRED.
5. IF task creation fails after the Execution_Gate consumed an approval, THEN THE Task_Engine SHALL leave the approval consumed and unusable for any other operation.
6. THE Task_Engine SHALL record on the Agent_Task the authorization policy reference and autonomy policy version in effect at submission.

### Requirement 9: Idempotency

**User Story:** As an agent, I want duplicate submissions of the same operation to return the same task, so that retries on my side never cause duplicate execution.

#### Acceptance Criteria

1. WHEN a submission carries an idempotency key already used by an Agent_Task with the same connectionId, capabilityId, capabilityVersion, resource and Input_Digest, THE Task_Engine SHALL return the existing Agent_Task and create no Agent_Task or Task_Job.
2. IF a submission carries an idempotency key already used by an Agent_Task of the same connectionId and capabilityId with a different capabilityVersion, resource or Input_Digest, THEN THE Task_Engine SHALL reject the submission with IDEMPOTENCY_CONFLICT and create no Agent_Task.
3. IF the capability requires an idempotency key and the submission carries none, THEN THE Task_Engine SHALL reject the submission with IDEMPOTENCY_KEY_REQUIRED and create no Agent_Task.
4. WHEN a submission without an idempotency key has the same connectionId and gateway-derived requestId as an existing Agent_Task, THE Task_Engine SHALL return the existing Agent_Task.
5. WHILE a non-terminal Agent_Task exists with a given Operation_Key, THE Task_Engine SHALL return that Agent_Task for any submission with the same Operation_Key and no idempotency key.
6. THE Task_Engine SHALL scope every idempotency identity to the connectionId, so that equal keys from different connections never match.
7. WHEN multiple identical submissions are processed concurrently, THE Task_Engine SHALL create exactly one Agent_Task and one Task_Job and return that task's Task_Reference to every submission.
8. THE Task_Store SHALL enforce idempotency identities with database uniqueness constraints that hold across process restarts and while Redis is unavailable.

### Requirement 10: Retry policy

**User Story:** As a platform maintainer, I want retries driven by each capability's declared safety metadata, so that reads retry safely and non-idempotent mutations or payments are never blindly retried.

#### Acceptance Criteria

1. WHEN an Agent_Task is created, THE Task_Engine SHALL assign Retry_Class SAFE_RETRY if idempotency class is IDEMPOTENT and `retrySafe` is true; NO_RETRY if reversibility is IRREVERSIBLE, exposure is FORBIDDEN, or `retrySafe` is false with no idempotency-key requirement; CONDITIONAL_RETRY otherwise.
2. IF the capability's idempotency or rollback metadata is absent, THEN THE Task_Engine SHALL assign Retry_Class NO_RETRY.
3. THE Task_Engine SHALL set maxAttempts to 3 for SAFE_RETRY and CONDITIONAL_RETRY and to 1 for NO_RETRY.
4. WHEN a SAFE_RETRY attempt ends in a Transient_Failure with attempts below maxAttempts, THE Task_Engine SHALL transition the task to FAILED with a retry scheduled and then to RETRY_QUEUED.
5. WHEN a CONDITIONAL_RETRY attempt fails, THE Task_Engine SHALL schedule a retry only for a Pre_Dispatch_Failure with attempts below maxAttempts.
6. IF an attempt fails with a non-transient failure, or with any failure under NO_RETRY, THEN THE Task_Engine SHALL transition the task to FAILED with errorCode EXECUTION_FAILED and no retry.
7. IF an otherwise retryable failure occurs when attempts equal maxAttempts, THEN THE Task_Engine SHALL transition the task to FAILED with errorCode RETRY_EXHAUSTED and no retry.
8. THE Task_Engine SHALL delay attempt n+1 by 1000 × 2^(n−1) milliseconds after attempt n fails.
9. THE Task_Worker SHALL allow BullMQ-level redelivery of a Task_Job only for failures that occur before an attempt is claimed.

### Requirement 11: Timeouts and expiry

**User Story:** As an agent, I want queue, execution and overall deadlines enforced and reported truthfully, so that stale work never starts and I always know what happened.

#### Acceptance Criteria

1. THE Task_Engine SHALL read Queue_Timeout, Execution_Timeout, the Overall_Deadline duration, the enqueue timeout, the maximum result size and the retention periods from gateway server configuration with documented defaults.
2. IF an Agent_Task is QUEUED or RETRY_QUEUED when its Queue_Timeout elapses or at or after its Overall_Deadline, THEN THE Task_Engine SHALL transition the task to EXPIRED with errorCode TASK_EXPIRED without adapter dispatch.
3. THE Task_Engine SHALL treat the Overall_Deadline as exclusive, permitting dispatch only while the current time is strictly before the Overall_Deadline.
4. WHEN a RUNNING attempt's elapsed time reaches the Execution_Timeout, or the current time reaches the Overall_Deadline while the task is RUNNING or CANCELLING, THE Task_Engine SHALL transition the task to TIMED_OUT with errorCode TASK_TIMEOUT.
5. WHEN an attempt completes after its Agent_Task reached TIMED_OUT, THE Task_Engine SHALL discard the late output and keep the status TIMED_OUT.
6. THE Status_Tool SHALL report a TIMED_OUT task without stating that the underlying service call stopped.
7. THE Task_Engine SHALL enforce expiry and timeout at worker claim, at status retrieval and in a callable sweep function, with no new scheduler or trigger.

### Requirement 12: Cancellation

**User Story:** As an agent, I want to cancel my own tasks and get an honest answer about whether cancellation happened, so that I never act on a fake cancellation.

#### Acceptance Criteria

1. WHEN a cancel request targets a QUEUED, RETRY_QUEUED or STARTING task, THE Task_Engine SHALL transition the task to CANCELLED, return status CANCELLED, and remove the pending Task_Job.
2. WHERE the task's adapter declares cooperative cancellation support, WHEN a cancel request targets a RUNNING task, THE Task_Engine SHALL transition the task to CANCELLING and return CANCELLATION_REQUESTED.
3. IF a cancel request targets a RUNNING task whose adapter lacks cooperative cancellation support, THEN THE Task_Engine SHALL return CANCELLATION_UNAVAILABLE and keep the task RUNNING.
4. WHILE a task is CANCELLING, WHEN the adapter confirms it stopped, THE Task_Engine SHALL transition the task to CANCELLED.
5. WHILE a task is CANCELLING, WHEN the operation completes, THE Task_Engine SHALL transition the task to SUCCEEDED or FAILED according to the actual outcome.
6. IF a cancel request targets a task in a Terminal_State, THEN THE Task_Engine SHALL return TASK_CANCELLED, TASK_EXPIRED, TASK_TIMEOUT or TASK_ALREADY_COMPLETED matching the current state and leave the task unchanged.
7. WHEN a cancel request and a worker claim race on the same QUEUED or RETRY_QUEUED task, THE Task_Engine SHALL apply exactly one of the two transitions, with no adapter dispatch when cancellation wins.

### Requirement 13: Status and result retrieval

**User Story:** As an agent, I want to read the status and result of my own tasks only, so that I get my results without seeing any other tenant's work.

#### Acceptance Criteria

1. WHEN the Status_Tool receives a Task_Reference owned by the caller, THE Status_Tool SHALL return the Task_Reference, capabilityId, status, attempts, maxAttempts, lifecycle timestamps and errorCode, and the result only when the status is SUCCEEDED.
2. THE Task_Tools SHALL treat an Agent_Task as owned by the caller only when its connectionId and ownerId equal the caller's Security_Context.
3. IF a Task_Reference is malformed, unknown, or owned by another connection, THEN THE Task_Tools SHALL return TASK_NOT_FOUND with an identical response in all three cases.
4. IF the caller's connection is not ACTIVE, THEN THE Task_Tools SHALL deny the call with the existing MCP identity error.
5. WHEN an attempt produces output, THE Result_Filter SHALL store only the value parsed by the capability's `outputSchema`.
6. IF adapter output fails the capability's `outputSchema` or exceeds the configured maximum result size, THEN THE Task_Engine SHALL transition the task to FAILED with errorCode EXECUTION_FAILED and no retry, storing no output.
7. THE Status_Tool SHALL include progress only when the adapter reported progress for the current attempt.
8. THE MCP_Server SHALL reject startup when any Task_Tool name equals a registered capability id.

### Requirement 14: Error codes and sanitization

**User Story:** As an agent developer, I want stable, safe error codes, so that I can handle failures programmatically without the gateway leaking internals.

#### Acceptance Criteria

1. THE Task_Engine SHALL report task failures only with TASK_NOT_FOUND, TASK_EXPIRED, TASK_CANCELLED, TASK_TIMEOUT, TASK_ALREADY_RUNNING, TASK_ALREADY_COMPLETED, CAPABILITY_DISABLED, AUTHORIZATION_REVOKED, APPROVAL_EXPIRED, EXECUTION_FAILED, RETRY_EXHAUSTED and QUEUE_UNAVAILABLE, plus the outcome codes CANCELLATION_REQUESTED and CANCELLATION_UNAVAILABLE and the reused Phase 4 codes IDEMPOTENCY_CONFLICT and IDEMPOTENCY_KEY_REQUIRED.
2. WHEN an attempt fails with a Phase 4 `ExecutionError`, THE Task_Engine SHALL store the `ExecutionErrorCode` as a detail code alongside the task errorCode.
3. THE Task_Engine SHALL exclude SQL, stack traces, file paths, connection strings, credentials and tokens from every agent-facing message and every stored error field.
4. THE Task_Tools SHALL surface denials as `AuthorizationDeniedError(message, code)` and other failures as MCP tool error results, consistent with `mcp/errors.ts`.
5. WHEN the Task_Worker receives a Task_Job whose attempt number differs from the Agent_Task's current attempt number, THE Task_Worker SHALL complete the Task_Job without adapter dispatch and log TASK_ALREADY_RUNNING.

### Requirement 15: Crash recovery and resumption

**User Story:** As a platform maintainer, I want tasks to recover safely from worker crashes, Redis or server restarts, network interruptions, stalled jobs and partial writes, so that no mutation is ever duplicated.

#### Acceptance Criteria

1. THE Task_Engine SHALL accept an attempt outcome only from the currently claimed attempt number.
2. WHEN a Task_Job is redelivered for a task still STARTING, THE Task_Worker SHALL treat the prior attempt as a Pre_Dispatch_Failure and continue according to the Retry_Class.
3. WHEN a Task_Job is redelivered for a task in RUNNING, THE Task_Worker SHALL treat the prior attempt as a Transient_Failure for a SAFE_RETRY task, and SHALL transition a CONDITIONAL_RETRY or NO_RETRY task to FAILED with errorCode EXECUTION_FAILED and no retry.
4. IF the Task_Store is unavailable when the Task_Worker receives a Task_Job, THEN THE Task_Worker SHALL skip adapter dispatch and fail the job for BullMQ redelivery.
5. WHEN the Recovery_Reconciler runs, THE Recovery_Reconciler SHALL re-enqueue QUEUED and RETRY_QUEUED tasks lacking a Task_Job, complete scheduled retries lacking a RETRY_QUEUED transition, and apply the expiry and timeout rules of Requirement 11 to every other non-terminal task.
6. THE Task_Worker SHALL run the Recovery_Reconciler once when the Task_Worker starts.
7. WHILE Redis job data is lost, THE Task_Engine SHALL rebuild the pending work from the Task_Store through the Recovery_Reconciler.

### Requirement 16: Retention and cleanup

**User Story:** As a platform maintainer, I want task results and records cleaned up after defined periods, so that stored data stays bounded.

#### Acceptance Criteria

1. THE Task_Engine SHALL provide a callable cleanup function that removes stored results of terminal Agent_Tasks older than the configured result retention period.
2. THE cleanup function SHALL delete terminal Agent_Task records older than the configured task retention period.
3. THE cleanup function SHALL leave every non-terminal Agent_Task unchanged.
4. WHEN the Status_Tool is called for a SUCCEEDED task whose result was removed, THE Status_Tool SHALL return the status and indicate that the result is no longer available.
5. THE Agent_Task_Queue SHALL use the existing job retention defaults (`removeOnComplete` count 100, `removeOnFail` count 500).

### Requirement 17: Observability hooks

**User Story:** As an operator, I want every task lifecycle event logged, audited and counted through the existing hooks, so that I can trace and monitor async work.

#### Acceptance Criteria

1. THE Task_Engine SHALL emit the Task_Events task.created, task.queued, task.started, task.retrying, task.succeeded, task.failed, task.cancellation_requested, task.cancelled, task.expired and task.timed_out through the existing `gatewayLogger`, audit hook and metrics.
2. THE Task_Engine SHALL include in each Task_Event the taskId, Task_Reference, requestId, connectionId, capabilityId, capabilityVersion, status, attempt number, errorCode and duration where applicable.
3. THE Task_Engine SHALL exclude capability input, results, credentials, tokens and secrets from every Task_Event.
4. IF emitting a Task_Event fails, THEN THE Task_Engine SHALL continue task processing with the task state unaffected.
5. THE Task_Engine SHALL write Task_Events only to the existing logger, audit hook and metrics, with no new event store.

### Requirement 18: Test coverage

**User Story:** As a maintainer, I want the engine proven by unit, integration and adversarial tests, so that correctness and security are demonstrated rather than assumed.

#### Acceptance Criteria

1. THE Default_Suite SHALL run all Task_Engine unit tests against in-memory fakes that reproduce P2002 unique violations, single-step conditional `updateMany` and serialized `$transaction`, and SHALL open no Redis connection.
2. THE Integration_Suite SHALL run only when explicitly enabled by a dedicated environment variable and SHALL connect only to an explicit local test URL, never to `REDIS_URL` from `.env`.
3. IF the Integration_Suite test URL host is not a loopback address, THEN THE Integration_Suite SHALL refuse to run.
4. THE Integration_Suite SHALL use a unique queue and key prefix per run and SHALL remove every queue and key it created, including after a test failure.
5. IF Memurai is unreachable when the Integration_Suite starts, THEN THE Integration_Suite SHALL report the result as ENVIRONMENTAL, distinct from pass and fail.
6. THE test suites SHALL cover the categories in Table 2.
7. THE write-path behaviours (CONDITIONAL_RETRY, NO_RETRY, approval binding) SHALL be tested with fixture capabilities and fixture adapters that exist only in test code.

Table 2: Required test categories

| Category | Required cases |
|---|---|
| A Unit | creation, duplicates, valid and invalid transitions, lookup, ownership, capability/adapter/environment binding, expiry, timeout, cancellation, retry classification, error mapping, result filtering, approval and authorization binding |
| B Integration (opt-in) | enqueue → Task_Worker → adapter → SUCCEEDED for a READ capability, retry with backoff, stalled-job redelivery, queue/connection restart, queued cancellation, duplicate job id |
| C Idempotency | duplicate request, duplicate key, same key with different input, concurrent submissions, resubmission after restart |
| D Retry | retryable, non-retryable, max attempts, exhaustion, backoff timing, partial failure |
| E Cancellation | queued, running (with and without cooperative support), completed, failed, expired, concurrent cancel and claim |
| F Timeout | before, during and after execution, exact deadline boundary |
| G Security | forged taskId, connection, owner, team, capability, resource, approval and environment; payload replay and substitution; cross-tenant access; revoked connection; expired approval; disabled capability |
| H Failure | Redis, BullMQ, worker, database, adapter and service unavailable; worker crash; queue restart; network interruption; malformed result |
| I Regression | full existing suite |

### Requirement 19: Quality gates, documentation and scope

**User Story:** As the project owner, I want Phase 8 to pass the existing quality gates and stay inside its scope, so that no protected system regresses.

#### Acceptance Criteria

1. WHEN Phase 8 is complete, THE Default_Suite SHALL pass all 700 baseline tests plus every new Phase 8 test.
2. WHEN Phase 8 is complete, THE TypeScript typecheck SHALL report no error other than the pre-existing `app/api/feedback/route.ts(128,11)`.
3. WHEN Phase 8 is complete, THE ESLint run SHALL report no more than the 122 pre-existing problems and no problem in a Phase 8 file.
4. WHEN Phase 8 is complete, THE production build SHALL succeed with the 244-page baseline.
5. THE Phase 8 git diff SHALL be limited to `lib/agent-gateway/**`, the Task_Worker registration in `lib/workers.ts`, the Agent_Task_Queue definition in `lib/queue.ts`, `prisma/schema.prisma`, the new migration directory, `docs/agent-gateway/phase-8/**`, and test-script entries in `package.json`.
6. THE Phase 8 deliverables SHALL include `docs/agent-gateway/phase-8/` documents 01-task-architecture, 02-task-state-machine, 03-queue-integration, 04-worker-integration, 05-idempotency, 06-retry-policy, 07-timeouts, 08-cancellation, 09-task-security, 10-task-recovery, 11-test-report, 12-bug-report, 13-database-verification and 14-phase-8-exit-checklist.
7. THE 07-timeouts document SHALL state the semantics of each timeout: cancel-before-start for Queue_Timeout, and mark-timed-out-while-the-service-may-continue for Execution_Timeout and Overall_Deadline.
8. THE 13-database-verification document SHALL verify the migration SQL, indexes, constraints, foreign keys, uniqueness and tenant-isolation of every Task_Store query.
9. THE Phase 8 deliverables SHALL include the 19-item Phase 8 exit report defined by the Phase 8 master prompt.
10. WHEN a defect is found, THE 12-bug-report document SHALL record its severity (P0–P3) and ownership (PHASE-8, P7/P6/P4 integration, PRE-EXISTING, OUT-OF-SCOPE or INFRASTRUCTURE).
11. THE defect fixes SHALL preserve every security check, route all async execution through the Task_Engine, and keep every existing test active and unmodified in intent.
12. THE 14-phase-8-exit-checklist document SHALL confirm that auth, RBAC, gateway, registry, adapters, authorization, approval, MCP, marketplace, payments, orders, subscriptions, deployment, workers, events and UI behave as before Phase 8.
