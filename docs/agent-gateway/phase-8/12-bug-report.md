# Phase 8 — Bug Report

## Found and fixed

| # | Severity | Ownership | Issue | Fix |
|---|---|---|---|---|
| 1 | P2 | PHASE-8 | `agent_task_submit` accepted version-pinned refs (`products.get@v1`), letting a caller target a capability version the MCP tool projection never exposes (e.g. an older still-registered version). Found by the MCP security suite. | Bare capability ids only (`assertValidCapabilityId`); anything else is `CAPABILITY_NOT_FOUND`. Retested: MCP security suite, engine suite, full regression. |
| 2 | P3 | INFRASTRUCTURE (test harness) | The Phase 7 fake DB wrote `undefined` fields literally, stored Prisma's `DbNull` sentinel as an object, compared NULL in range filters, and had no `lte`/`gte`/`deleteMany`. It would have hidden or invented failures in the task store. | Fake now matches Prisma/SQL semantics (undefined ignored, sentinels -> NULL, NULL never satisfies a range, `deleteMany`). All Phase 7 suites re-run green. |

Test-expectation corrections made while writing the suite (the product behaviour was right, the first draft of the test was wrong):

- an irreversible fixture was expected to run without approval; Phase 7's mandatory gate correctly required one;
- a different resource was expected to report `APPROVAL_BINDING_MISMATCH`; Phase 7 correctly requires a new approval for a different resource and reports mismatch only for the same resource with different input;
- an output-contract violation was expected to fail once; the Phase 4 resolver reports it as `INTERNAL_ERROR`, which a SAFE_RETRY read retries (nothing is stored either way).

No P0/P1 defects were found.

## Pre-existing (not changed by Phase 8)

| Issue | Impact | Why not changed |
|---|---|---|
| `lib/queue.ts` `createLazyQueue` silently no-ops when `REDIS_URL` is unset | other queues' jobs can be dropped silently in a misconfigured environment | changing it alters every existing producer; the Task Engine detects it and fails closed instead |
| `lib/redis.ts` builds an Upstash REST client from a plain `REDIS_URL` with an empty token | gateway Redis controls (nonce replay, rate limits, policy cache) only work when `UPSTASH_REDIS_REST_*` is configured | pre-existing infrastructure; BullMQ uses ioredis on `REDIS_URL` separately |
| Phase 4 idempotency cache fails open without Redis | duplicate SYNC mutations are possible if Redis is down | documented Phase 4 choice; the Task Engine uses database uniqueness instead |
| `app/api/feedback/route.ts(128,11)` TS2322 | typecheck baseline | unrelated |
| 122 ESLint problems repo-wide | lint baseline | unrelated |

## Out of scope

Scheduling agent capabilities, triggers, webhooks (Phase 9); a task dashboard (Phase 10); an audit ledger (Phase 11).
