# Phase 9 — Task Integration

Triggers never execute a capability. Each firing calls the existing `AgentTaskService.submit()` — the same method `agent_task_submit` uses — with a context built from the trigger's connection:

| Field | Source |
|---|---|
| connection, owner, team, agent | the connection row, read fresh from the database at fire time |
| credential id | `agent-trigger:<triggerRef>` (a marker, not a credential; same convention as Phase 8's worker) |
| environment | the trigger's environment, which must equal the connection's and this process's |
| capability + version | the trigger's pinned version, which must still be the current, ACTIVE, AGENT_AVAILABLE, async version |
| input | the stored, schema-validated input (+ the bound resource id) |
| idempotency key | `trigger.<run hex>` (reserved prefix) |
| origin | `{ triggerId }` — server-side only, stored as `AgentTask.triggerId` |

## What submit re-checks on every firing

Phase 3 capability resolution and input validation, the connection environment, then the Phase 7 `ExecutionGate.grant()` over live Phase 6 policy and Phase 7 autonomy:

| Outcome | Run |
|---|---|
| allowed | `TASK_CREATED` (`taskId` linked) |
| Phase 6 deny, autonomy deny, policy unavailable, identity invalid | `DENIED AUTHORIZATION_DENIED` |
| approval required | `APPROVAL_REQUIRED` — the gate files the approval request in the existing approvals inbox; nothing runs. Once a human approves, the next firing of the same operation consumes that approval (single use, bound to the operation) and creates the task |
| queue not configured / enqueue failed | `FAILED QUEUE_UNAVAILABLE` (retryable; checked before the gate, so no approval is consumed) |
| task store unavailable | `FAILED TASK_CREATION_FAILED` (retryable) |
| configuration no longer valid (input, capability) | `FAILED TRIGGER_VALIDATION_FAILED` |

Before submit, the runtime refuses and records `DENIED` for a suspended, revoked, expired, owner-changed or other-environment connection (a revoked connection also revokes the trigger; an expired one expires it), and `FAILED TRIGGER_VALIDATION_FAILED` plus `DISABLED` when the pinned capability version is no longer current.

## After creation

The task is an ordinary Phase 8 task: one job per attempt, the worker-time guard (so a policy revoked between firing and execution still stops it — tested), retry classes, cancellation, timeouts, result retention. The owning connection sees it through `agent_task_status` with `origin: "TRIGGER"`; other connections and owners get `TASK_NOT_FOUND`.

## Phase 8 changes

- `submit(ctx, env, args, origin?)` — `origin` is a server-side parameter; the MCP tools never pass it.
- `SubmitTaskResult.taskId` — internal id for linking; the MCP tools still return only `task` + `created`.
- `AgentTaskView.origin`.
- Idempotency keys starting with `trigger.` are rejected for agent submissions.
