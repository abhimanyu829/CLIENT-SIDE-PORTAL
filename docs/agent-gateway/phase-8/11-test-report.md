# Phase 8 — Test Report

## Default suite (`npx vitest run`, in-memory fakes)

**68 files, 801 tests, 801 passed.** Phase 7 baseline was 700; Phase 8 adds 101.

| File | Tests | Covers (prompt sections) |
|---|---|---|
| `p8-task-primitives.test.ts` | 23 | A: state machine (all 100 pairs), terminal rules, retry classification (whole manifest + fixtures), backoff, failure decisions, task/job/idempotency ids, time rules with exact boundaries (F), result filter, config defaults, async declaration rules, payload contract |
| `p8-task-engine.test.ts` | 27 | A: creation, server-derived context, view redaction, capability/input rejection; C: idempotency incl. 10-way concurrency and restart; H: queue unavailable (before gate / after create); approval binding; G: owner-scoped status, lazy expiry, result withheld after revocation; E: cancellation matrix and cancel-vs-claim races |
| `p8-task-worker.test.ts` | 34 | worker happy path, duplicate delivery; G: revoked/suspended/expired/owner-changed connection, authz revoked, autonomy downgraded, approval newly required, capability disabled, environment changed, stored-input tamper, payload substitution, forged jobs; approval-bound tasks (Scenario 7 and policy change); D: SAFE / CONDITIONAL / NO_RETRY, backoff, exhaustion; F: execution timeout + late result discarded, queue timeout, exact deadline, after-completion; A.15 result size/contract; H: store down, STARTING/RUNNING redelivery, stale jobs |
| `p8-task-maintenance.test.ts` | 7 | sweep, Redis job loss -> requeue, stale STARTING recovery, lost retry step, queue down during reconcile, retention |
| `p8-task-mcp.test.ts` | 10 | through the real MCP server + real Phase 6 policy engine: tool listing, Scenario 1 (async end to end), SYNC path unchanged, default deny, Scenario 2 (approval + async), Scenario 6 (authz revoked while queued), Scenario 8 (connection revoked while pending), cross-tenant, forged arguments, FORBIDDEN/INTERNAL/pinned refs |

## Opt-in integration suite (`npx vitest run -c vitest.integration.config.ts`)

Real BullMQ 5 Queue + Worker against local **Memurai** at `127.0.0.1:6379`, unique key prefix per run, all keys deleted afterwards (asserted). **1 file, 6 tests, 6 passed.**

| Test | Result |
|---|---|
| task -> BullMQ job -> worker -> Phase 4 adapter -> data -> SUCCEEDED; payload has no input | pass |
| same attempt enqueued twice = one job | pass |
| retry through a real delayed job (≥ 1 s backoff) then success | pass |
| job queued with no worker survives until a worker starts | pass |
| worker force-closed mid-run: stalled job recovered; read re-runs once, write marked FAILED and never executed twice | pass |
| unreachable Redis: `QUEUE_UNAVAILABLE`, task FAILED, never reported QUEUED | pass |

## Quality gates

| Check | Result |
|---|---|
| `npx tsc --noEmit` | only the pre-existing `app/api/feedback/route.ts(128,11)` error |
| `eslint . --ext .ts,.tsx` | 122 problems — identical to baseline; scoped lint of every Phase 8 file: 0 |
| `npm run build` | compiled; 244 pages; `/api/agent-gateway/mcp` present |
| `prisma validate` / `generate` | valid / generated |
| security grep of Phase 8 code (eval, Function, child_process, exec/spawn, raw SQL, console, secret env reads) | 0 hits |

## Regression

All pre-existing suites (Phases 1–7: gateway, auth, identity, registry, adapters, MCP, authorization, autonomy, approvals, Cua boundary, admin routes) pass unchanged. One Phase 7 test utility (`approval-fake-db.ts`) was extended; its own suites were re-run green.

The prompt's business regression list (checkout, payments, orders, invoices, subscriptions, deployment, storage, customer portal, UI) has no automated test suite in this repository outside `lib/agent-gateway`; those systems are not touched by the Phase 8 diff (verified in the diff audit) and the production build compiles every route.

## Limitations

- Postgres is an in-memory fake that reproduces unique constraints and single-statement conditional updates; the migration is not applied, so no test ran against real Postgres.
- The BullMQ suite uses the fake database too; only the queue layer is real.
- Latency: submit + in-memory worker round trip is a few ms; with real BullMQ on Memurai a READ task completed end to end in ~1.2 s including worker start-up (see the integration run). Not a load test.
