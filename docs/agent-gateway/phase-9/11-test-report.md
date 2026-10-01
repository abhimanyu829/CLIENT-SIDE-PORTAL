# Phase 9 — Test Report

## Default suite (`npx vitest run`, in-memory fakes)

**73 files, 909 tests, 909 passed.** Phase 8 baseline was 801 (68 files); Phase 9 adds 108 tests in 5 files.

Sections: A lifecycle · B event triggers · C webhook triggers · D schedules · E concurrency · F authorization at firing / task integration / cross-phase · G failure handling.

| File | Tests | Covers |
|---|---|---|
| `p9-trigger-primitives.test.ts` | 28 | A: all 36 state pairs, terminal states, human actions, error statuses · D: cron syntax allow/deny list, timezones, UTC / Asia/Kolkata / America/New_York, spring-forward and fall-back, skipped and repeated local times, bounded frequency, missed-run policy at exact boundaries (on time, +2 min, +2 min +1 ms, 24 h window), one-time and expiry finish, activation never replays · B: allowlist, ids-only normalization, id validation, digest identity · C: secret format, encryption at rest, every signed part, constant-format signature, timestamps · config: off by default, both switches required, invalid value fails closed |
| `p9-trigger-service.test.ts` | 18 | A: server-derived owner/team/environment, pinned version, 9 forged fields rejected, async-only capabilities, input schema, resource binding rules, allowlisted events, OWNER-only user events, schedule rules, unusable connections, past expiry, full lifecycle incl. pause-without-replay, stale version CONFLICT, two admins racing (one wins), edit only while not firing, activation re-checks connection and current version, expiry, connection revocation cascade, not-found refs · C: secret once / encrypted / never in a view, rotation |
| `p9-trigger-runtime.test.ts` | 35 | B: match creates one authorized task with the bound resource and no payload leakage, resource / actor / environment / status mismatches, ANY vs OWNER, user events, duplicate event, unbindable resource · E: DROP_WHILE_RUNNING (incl. 10-way race), QUEUE_ONE (run / wait / coalesce / promote), ALLOW_PARALLEL, stale slot recovery · F: Phase 6 deny, Scenario 9 (autonomy downgraded; allowlist narrowed), approval required -> approved -> consumed once, suspended / revoked / expired / owner- or environment-drifted connection, capability version superseded, expired trigger · G: queue down (no gate call, re-delivery creates one task), enqueue failure after row write, policy store down, trigger store down · D: exact-time firing, 3 concurrent ticks, SKIP / CATCH_UP_ONCE after an outage, one-time, pause/resume, expiry, corrupted schedule disabled, job routing · B: intake hook no-op, ids-only job, never throws, intake job -> task |
| `p9-webhook.test.ts` | 21 | C: 202 accepted with body digest only, hostile body cannot choose anything, duplicate event id -> 200, resourceId binding validation, disabled -> 404, unknown / paused / non-webhook refs share one 404 body, 415, 413 (declared and streamed), 401 header matrix, ±skew boundary, tampered body / path / method / secret / event id, replay -> 409, nonce store down -> 503, nonce not burnable, 429 / limiter down -> 503, non-object JSON -> 400, unreadable secret -> 503, rotation, retry after 503 -> one task, denied run still 202, no secrets in responses, real route module (disabled -> 404; enabled without Redis -> 503) |
| `p9-cross-phase.test.ts` | 6 | F: Scenario 3 (event -> task -> Phase 4 adapter -> owner-scoped result), Scenario 4 (webhook), Scenario 5 (schedule, once per occurrence), Scenario 11 (replays and duplicates execute once), worker re-verification of a trigger task, `emitEvent` calls the hook once and keeps its own behaviour |

## Opt-in integration suite (`npx vitest run -c vitest.integration.config.ts`)

Real BullMQ 5 Queue + Worker against local **Memurai** at `127.0.0.1:6379`, unique prefix per run, all keys deleted afterwards (asserted). **2 files, 9 tests, 9 passed** (Phase 8: 6, Phase 9: 3).

| Phase 9 test | Result |
|---|---|
| event intake -> reference job -> worker -> trigger runtime -> task job -> adapter -> SUCCEEDED; a re-emitted event is one job | pass |
| a real repeatable tick fires a due schedule once and keeps ticking | pass |
| signed webhook -> task -> real worker -> SUCCEEDED | pass |

## Quality gates

| Check | Result |
|---|---|
| `npx tsc --noEmit` | only the pre-existing `app/api/feedback/route.ts(128,11)` error |
| `eslint . --ext .ts,.tsx` | 122 problems (64 errors, 58 warnings) — identical to baseline; scoped lint of every Phase 9 new/modified file: 0 |
| `npm run build` | compiled; 244 static pages; `/api/agent-webhooks/[ref]` present |
| `prisma validate` / `generate` | valid / generated |
| security grep of Phase 9 code (eval, Function, child_process, exec/spawn, raw SQL, console, secret env reads, innerHTML) | 0 hits in 15 files |
| log review | 16 log calls; none carries a secret, body, payload, nonce or signature value |

## Regression

All Phase 1–8 suites pass unchanged. Shared test utility changed: `approval-fake-db.ts` (trigger tables, compound unique selectors). Phase 8 behaviour changes are additive (`origin`, `taskId`, reserved `trigger.` key prefix) and the Phase 8 suites pass unchanged.

The business regression list (checkout, payments, orders, invoices, subscriptions, deployment, storage, portal, UI) has no automated suite in this repository outside `lib/agent-gateway`. The only business-facing change is one awaited call at the end of `emitEvent`, which is a no-op while triggers are disabled (default) and is covered by the cross-phase test; the production build compiles every route.

## Limitations

- Postgres is the in-memory fake (unique constraints and single-statement conditional updates reproduced); the migration is not applied.
- The BullMQ suite uses the fake database too; only the queue layer is real.
- No load test. The 10-way and 3-tick races exercise contention, not throughput.
