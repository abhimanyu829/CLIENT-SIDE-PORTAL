# Phase 9 — Event Triggers

## Allowlist

Only these existing platform events (`lib/services/event-bus.ts`) can drive a trigger:

| Event | Resource | Resource id field | About a user |
|---|---|---|---|
| `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_SOLD_OUT`, `INVENTORY_UPDATED` | Product | `productId` | no |
| `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_CANCELLED` | Subscription | `subscriptionId` | yes (`userId`) |

Payment, refund, user, fraud, credential and webhook events are excluded by design: money movement and identity changes are not agent automation inputs. An event not in the catalog never reaches the queue.

## Intake (`event-intake.ts`)

`emitEvent` calls `notifyAgentEventTriggers(event)` after its own work. The hook:

1. returns immediately unless triggers are enabled and the event type is allowlisted;
2. reduces the event to ids: `eventType`, `digest`, `resourceType`, `resourceId`, `actorId`, `subjectUserId`, `occurredAt`. Ids must match `^[A-Za-z0-9_-]{1,128}$`, anything else becomes `null`. The payload never leaves;
3. enqueues ONE `agent-trigger.event` job on the `agent-task` queue with `jobId = evt-<digest>`, bounded to 2 s;
4. never throws. A lazy-queue no-op (no Redis) is logged as `agent_gateway_trigger_event_not_enqueued`, not treated as success.

The digest is `sha256("abhibhi.trigger-event.v1\n" + canonicalJson({type, timestamp, actorId, payload}))`: an exact re-emission has the same identity; two distinct events do not.

## Matching (`TriggerRuntime.dispatchEvent`)

For each ACTIVE event trigger of that type:

- environment equals this process's environment;
- `eventResourceId`, when set, equals the event's resource id;
- actor scope:
  - events about a user fire **only** OWNER-scoped triggers whose owner is that user (`ANY` is rejected at creation);
  - otherwise `OWNER` requires the event's actor to be the trigger owner; `ANY` matches any actor.

## Input

The capability input is fixed at configuration. With `bindResource`, the resource id is written into the capability's `resourceLocator` (for example `products.get.id`) at fire time; the locator may not be preset, and the event's resource type must equal the capability's. A missing or invalid id is recorded as `FAILED CONDITION_ERROR`, never a task.

## Dedup

`deliveryKey = event:<digest>` is unique per trigger. The same event processed twice (queue redelivery, concurrent workers) is one run and one task (`DUPLICATE`).

## Tests

`p9-trigger-runtime.test.ts` (B), `p9-trigger-primitives.test.ts` (allowlist, normalization, digest), `p9-cross-phase.test.ts` Scenario 3, `p9-bullmq.integration.ts` (real queue, re-emitted event = one job).
