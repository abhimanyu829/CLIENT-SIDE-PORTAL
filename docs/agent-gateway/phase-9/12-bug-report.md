# Phase 9 — Bug Report

## Found and fixed

| # | Severity | Ownership | Issue | Found by | Fix |
|---|---|---|---|---|---|
| 1 | P2 | PHASE-9 | A schedule whose **stored** state was corrupted (e.g. `cronExpression` NULL) was planned as "on time, no next occurrence": it fired one task and was then marked `EXPIRED`, instead of stopping. | runtime suite (`a schedule that cannot be evaluated is disabled`) | `planDueOccurrence` re-validates stored state (cron syntax, timezone, kind) and throws; the tick disables the trigger with a `FAILED SCHEDULE_ERROR` run. Nothing fires. |
| 2 | P2 | PHASE-9 | Stale active-slot detection measured age from the run's `receivedAt`. A `QUEUE_ONE` run that waited a long time before promotion would look stale the moment it took the slot, so a concurrent delivery could release it and start a second live task. | design review before the concurrency tests | New column `AgentTriggerRun.activeSince`, set atomically when the slot is claimed or promoted; staleness is measured from it. |
| 3 | P3 | PHASE-9 | Activation checked that the pinned capability version still existed (`getVersion`), not that it was still the **current** version: an old version kept registered alongside a newer one would have been activatable. | review of `assertActivatable` | Activation and every firing require `registry.get(id).version === capabilityVersion` (ACTIVE, AGENT_AVAILABLE, async). |
| 4 | P3 | PHASE-9 | Approval-required and concurrency-dropped runs incremented `failureCount`, which would make healthy triggers look failing in the Phase 10 dashboard. | review | `recordTriggerOutcome(SUCCESS \| FAILURE \| NEUTRAL)`; only real failures count. |
| 5 | P3 | INFRASTRUCTURE (test harness) | The Phase 7 fake DB had no `AgentTrigger` / `AgentTriggerRun` tables and no Prisma compound-unique selectors (`triggerId_deliveryKey`). | writing the suite | Tables added with the migration's unique constraints; compound selectors supported. Every earlier suite re-run green (909/909). |

Test-expectation corrections (the product behaviour was right, the first draft of the test was wrong):

- editing an ACTIVE trigger with settings for another trigger type was expected to be a validation error; the state check correctly answers `TRIGGER_INVALID_TRANSITION` first (pause before editing);
- "Scenario 9" first used a READ trigger with `OBSERVE_ONLY`; Phase 7 correctly still allows READ at that level. The test now downgrades a write fixture and narrows the capability allowlist for the READ trigger — both are denied at firing;
- two runtime tests expected trigger tasks to succeed without the Phase 4 data fake wired in; the adapter correctly failed. The runtime suite now runs over the execution fake.

No P0/P1 defects were found.

## Pre-existing (not changed by Phase 9)

| Issue | Severity | Owner | Impact | Why not changed |
|---|---|---|---|---|
| The Phase 1 signed-request canonical message (`auth/signature-verifier.ts`) is `timestamp, METHOD, path, sha256(body)` — the nonce is **not** signed | P2 | PHASE-1 | a captured signed request can be replayed within the 300 s skew window by swapping in a fresh nonce | **FIXED after Phase 10**: canonical message v2 `abhibhi.request.v2, timestamp, nonce, METHOD, path, sha256(body)`, no v1 fallback (no downgrade). Breaking for SIGNED_REQUEST clients, which must sign v2; signing is opt-in and off by default. See `phase-1/PHASE-1-ARCHITECTURE.md` §6 |
| `lib/queue.ts` lazy queues silently no-op without `REDIS_URL` | P3 | INFRASTRUCTURE | events would not reach triggers in a misconfigured environment | changing it alters every producer; the intake detects the no-op and logs `agent_gateway_trigger_event_not_enqueued` |
| `lib/redis.ts` builds an Upstash REST client from a plain `REDIS_URL` | P3 | INFRASTRUCTURE | webhook nonces and rate limits need `UPSTASH_REDIS_REST_*`; without it webhooks answer 503 (fail closed) | pre-existing infrastructure |
| `app/api/feedback/route.ts(128,11)` TS2322 | P3 | APP | typecheck baseline | unrelated |
| 122 ESLint problems repo-wide | P3 | APP | lint baseline | unrelated |

## Dependency note

`cron-parser` is pinned to exactly **4.9.0** — the version BullMQ 5.76.8 itself declares, so the repository keeps a single hoisted copy (verified: no nested copy under `node_modules/bullmq`). npm marks the 4.x line as no longer maintained upstream. Moving to 5.x would put two parser versions in the tree (BullMQ's and ours) and change the API (`parseExpression` -> `CronExpressionParser.parse`); it should be done together with a BullMQ upgrade. Severity P3, owner INFRASTRUCTURE.

## Known limits (by design, documented)

- `emitEvent` now awaits the intake hook; with triggers enabled and a hanging Redis it adds at most 2 s to the emitting request (bounded, never throws). With triggers disabled it adds nothing measurable.
- Schedule precision is one tick (≤ 60 s) plus queue latency.
- `QUEUE_ONE` promotion latency is up to one tick after the running task finishes.

## Out of scope

Trigger management UI and API (Phase 10), audit ledger (Phase 11), third-party webhook formats, workflow chains.
