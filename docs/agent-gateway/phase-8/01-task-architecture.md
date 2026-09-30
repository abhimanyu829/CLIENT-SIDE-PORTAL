# Phase 8 — Task Architecture

The Task Engine is an orchestration layer for agent-originated asynchronous work. It does not replace any business worker and executes nothing a synchronous call could not.

```
MCP agent_task_submit (Phase 5)
  -> identity (Phase 1/2)
  -> capability resolution + input validation (Phase 3)
  -> ExecutionGate.grant()  (Phase 7 wrapping Phase 6; consumes an approval if one is required)
  -> AgentTask row (QUEUED)                       Postgres = source of truth
  -> agent-task BullMQ job (references only)      existing Redis / BullMQ
  -> existing worker process (npm run workers)    lib/workers.ts startWorkers()
  -> AgentTaskWorker: claim -> re-verify -> Phase 4 AdapterResolver -> existing service
  -> AgentTask SUCCEEDED / FAILED / ...          agent_task_status
```

SYNC is unchanged: a direct capability tool call still goes adapter -> service in the request.

## Modules (`lib/agent-gateway/tasks/`)

| File | Responsibility |
|---|---|
| `types.ts` | statuses, retry classes, error codes, agent-facing view |
| `state-machine.ts` | legal transitions, terminal rules |
| `store.ts` | the only reader/writer of `AgentTask`; every change is one conditional `updateMany` |
| `engine.ts` | `AgentTaskService`: submit / status / cancel |
| `worker.ts` | `AgentTaskWorker`: the `agent-task` queue processor |
| `guard.ts` | worker-time re-verification |
| `lifecycle.ts` | time rules, failure handling, retry scheduling (shared by worker and maintenance) |
| `maintenance.ts` | sweep, reconcile, retention |
| `retry-policy.ts` | retry class from capability metadata |
| `queue.ts` | `TaskQueuePort`, `BullTaskQueue` over `lib/queue.ts`'s `agentTaskQueue` |
| `result-filter.ts` | output contract + size limit |
| `ids.ts`, `view.ts`, `config.ts`, `errors.ts`, `observability.ts`, `index.ts` | supporting pieces |

MCP surface: `lib/agent-gateway/mcp/task-tools.ts` (three reserved tools).

## Changes to earlier phases (all additive)

| File | Change | Why |
|---|---|---|
| `capabilities/types.ts` | `async.asyncSupported`, `async.cooperativeCancellation` | declare async support without changing `executionMode` |
| `capabilities/registry.ts` | reject `asyncSupported` on FORBIDDEN / DISABLED / unwired | fail closed on manifest errors |
| `capabilities/manifest.ts` | the 4 READ capabilities declare async support | first real async capabilities |
| `execution-gate/gate.ts` | `grant()` (returns the consumed approval) and `evaluatePolicy()` (no approval side effect); `authorize()` unchanged | bind approvals to tasks; re-verify at worker time |
| `mcp/server.ts` | optional `taskService` dependency registers the task tools | absent = Phase 5 surface exactly |
| `mcp/route-handler.ts` | one gate per request shared by direct calls and submission; task tools when `AGENT_GATEWAY_TASKS_ENABLED` | opt-in rollout |
| `observability/metrics.ts` | 11 `agent_task_*` counters | lifecycle hooks |
| `lib/queue.ts` | `agentTaskQueue`, `AGENT_TASK_JOBS` | same convention as every other queue |
| `lib/workers.ts` | register the `agent-task` worker + maintenance repeatable job, only when enabled | no second worker app |
| `prisma/schema.prisma` + migration `20261002000000` | `AgentTask`, 2 enums, back-relations | durable task state |

## Scope

Not built: a second queue/Redis/worker framework, workflows/DAGs/parent tasks, schedules/triggers/webhooks (Phase 9), dashboard (Phase 10), audit ledger (Phase 11).

## Rollout switch

`AGENT_GATEWAY_TASKS_ENABLED` (default off). Off: no task tools, no `agent-task` worker, no maintenance job — the existing worker process and MCP surface are exactly as before.
