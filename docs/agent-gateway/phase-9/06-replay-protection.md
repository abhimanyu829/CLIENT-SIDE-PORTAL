# Phase 9 — Replay Protection

Three independent layers; each alone prevents a duplicate task.

| Layer | Key | Store | Behaviour on failure |
|---|---|---|---|
| Webhook nonce | `agent-gateway:nonce:webhook:<triggerRef>:<nonce>` | existing Redis nonce store (`auth/replay-protection.ts`, SET NX EX, TTL 600 s) | Redis down -> 503, fail closed |
| Delivery identity | unique `(triggerId, deliveryKey)` on `AgentTriggerRun` | Postgres | the database decides; a second insert is a duplicate |
| Task identity | unique `idempotencyScope` = `<connectionId>:trigger.<run hex>` on `AgentTask` | Postgres (Phase 8) | a re-armed run finds its task instead of creating another |

## Delivery keys

| Source | deliveryKey | Identity of |
|---|---|---|
| EVENT | `event:<sha256 of the canonical event>` | one exact platform event |
| WEBHOOK | `webhook:<x-abhibhi-event-id>` | one sender event (stable across the sender's retries) |
| SCHEDULE | `schedule:<ISO occurrence>` | one occurrence |

## Replay cases

| Case | Result |
|---|---|
| captured webhook replayed byte-for-byte | 409 `REPLAY_DETECTED` (nonce) |
| replay with a new nonce but the old signature | 401 (the nonce is signed) |
| sender retry: same event id, new nonce, new signature | 200 duplicate, original `runRef`, no new task |
| same platform event emitted twice | one BullMQ job (`jobId = evt-<digest>`) and, even if two jobs ran, one run |
| event job redelivered by BullMQ | `DUPLICATE` |
| two ticks / two workers on one occurrence | the conditional `nextRunAt` claim lets one through |
| run failed transiently, then re-delivered | the run is re-armed (FAILED -> PENDING only for `QUEUE_UNAVAILABLE` / `TASK_CREATION_FAILED`) and retried with the same task key |

## Reserved key prefix

Agents cannot submit an idempotency key starting with `trigger.` (`INVALID_INPUT`), so a trigger run's task identity cannot be pre-claimed through `agent_task_submit`.
