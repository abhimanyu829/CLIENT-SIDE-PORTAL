# Phase 9 — Trigger Architecture

A trigger is a **human-configured** request to run ONE async-capable capability for ONE agent connection when an allowlisted platform event, a signed webhook call or a schedule occurrence arrives. Firing never executes anything directly: it creates a Phase 8 task through the same chain an agent call uses. A trigger existing grants nothing.

```
platform event (emitEvent)      signed webhook POST              repeatable tick (1/min)
  -> event-intake: ids-only        -> webhook-handler: size, type,  -> TriggerRuntime.runScheduleTick
     reference job (agent-task        headers, skew, rate limit,       (due schedules from Postgres,
     queue, jobId = event digest)     HMAC, nonce, JSON, resourceId)    conditional nextRunAt claim)
          \                                  |                                 /
           +------------------ TriggerRuntime.fire(trigger, delivery) --------+
                 fresh trigger ACTIVE + unexpired
                 AgentTriggerRun (unique triggerId + deliveryKey = dedup)
                 concurrency slot (unique columns)
                 fresh connection (ACTIVE, unexpired, same owner + environment)
                 pinned capability version is still current + async
                 AgentTaskService.submit()  -> Phase 3 validation -> ExecutionGate (Phase 6 + Phase 7)
                                            -> AgentTask (triggerId) -> agent-task job -> Phase 8 worker
```

## Modules (`lib/agent-gateway/triggers/`)

| File | Responsibility |
|---|---|
| `types.ts` | statuses, run statuses, error codes, admin views |
| `state-machine.ts` | DRAFT / ACTIVE / PAUSED / DISABLED / EXPIRED / REVOKED transitions and human actions |
| `config.ts` | `AGENT_GATEWAY_TRIGGERS_ENABLED` (effective only with `AGENT_GATEWAY_TASKS_ENABLED`) and limits |
| `event-catalog.ts` | the allowlist of platform events and their resource / subject fields; normalization to ids |
| `schedule.ts` | cron parsing (cron-parser, BullMQ's own dependency), timezones, bounded frequency, missed-run planning |
| `secrets.ts` | webhook secret generation, encryption at rest (lib/encryption.ts), canonical HMAC |
| `store.ts` | the only reader/writer of `AgentTrigger` / `AgentTriggerRun` |
| `service.ts` | `TriggerService` — human management (create / update / transition / rotate / revoke), used by Phase 10 |
| `runtime.ts` | `TriggerRuntime` — fire, events, schedule tick, concurrency, task creation |
| `event-intake.ts` | `notifyAgentEventTriggers` — the one hook called by `emitEvent` |
| `webhook-handler.ts` | the webhook endpoint logic |
| `view.ts`, `errors.ts`, `index.ts` | projections, stable errors, factories |

Route: `app/api/agent-webhooks/[ref]/route.ts` (POST only, `force-dynamic`, Node runtime).

## Changes to existing code (all additive)

| File | Change | Why |
|---|---|---|
| `lib/services/event-bus.ts` | `await notifyAgentEventTriggers(event)` as step 5 of `emitEvent` | the single integration point with the existing event system; never throws; no-op when disabled |
| `lib/queue.ts` | `AGENT_TASK_JOBS.TRIGGER_EVENT`, `TRIGGER_TICK` | trigger jobs share the Phase 8 `agent-task` queue |
| `lib/workers.ts` | route `agent-trigger.*` jobs to the runtime; one `* * * * *` repeatable tick | existing worker and repeatable-job mechanism; only when enabled |
| `app/api/admin/agent-connections/[id]/revoke/route.ts` | revoke the connection's triggers | a revoked connection leaves no live trigger |
| `tasks/engine.ts` | optional server-side `origin` (`triggerId`) on `submit`; `taskId` on the internal result; the `trigger.` idempotency prefix is reserved | link tasks to triggers without an agent-reachable parameter |
| `tasks/types.ts`, `tasks/view.ts` | `origin: "AGENT" \| "TRIGGER"` on the task view | the owning agent can tell trigger tasks apart |
| `tasks/ids.ts` | `triggerIdempotencyKey`, `TRIGGER_IDEMPOTENCY_PREFIX` | deterministic task identity per run |
| `prisma/schema.prisma` + migration `20261003000000` | `AgentTrigger`, `AgentTriggerRun`, 5 enums, `AgentTask.triggerId` | durable trigger state |
| `package.json` | `cron-parser` 4.9.0 as an exact direct dependency (already installed as BullMQ's dependency) | the schedule parser BullMQ itself uses |

## One source of truth

- Trigger configuration, schedule position (`nextRunAt`) and every delivery live in Postgres.
- Redis holds only references: one event job per event digest, one repeatable tick, the task jobs. No per-trigger repeatable jobs, so Redis can never drift from the database.
- Webhook replay nonces and rate limits reuse the existing Redis controls.

## Rollout switch

`AGENT_GATEWAY_TRIGGERS_ENABLED` (default off) AND `AGENT_GATEWAY_TASKS_ENABLED`. Off: `emitEvent` does nothing extra, the webhook route answers 404, no tick is scheduled, no trigger job is processed.

## Scope

Not built: trigger management UI/API (Phase 10), workflow chains, conditions beyond resource / actor matching, third-party webhook formats, an audit ledger (Phase 11).
