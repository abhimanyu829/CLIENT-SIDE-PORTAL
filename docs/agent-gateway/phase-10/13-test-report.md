# Phase 10 — Test Report

## Default suite (`npx vitest run`, in-memory fakes)

**79 files, 983 tests, 983 passed.** Phase 9 baseline was 909 (73 files); Phase 10 adds 74 tests in 6 files.

The Phase 10 suites run the REAL `lib/admin-auth.ts`, Phase 7 human-session check, Phase 2 connection service, Phase 6 policy engine and store, Phase 7 gate and autonomy store, Phase 8 engine / worker, Phase 9 trigger service / runtime / webhook handler, MCP server, every governance route module and every governance page module (rendered to HTML with `react-dom/server`). Only the session sources (who is signed in), Redis (absent), SMS and the sub-admin credential session (which grants the sub-admin **every** permission) are mocked.

Sections: A access · B connections · C capabilities · D policies · E autonomy · F approvals · G tasks · H triggers / schedules / webhooks · I runtime · J UI and API hygiene.

| File | Tests | Covers |
|---|---|---|
| `p10-governance-access.test.ts` | 16 | A: a super admin opens all 15 pages + layout; sub-admin (every permission), user, banned admin redirected to `/unauthorized`, anonymous to `/login`, on every page and every route, with no state change and no audit entry; agent bearer / signed-request headers refused with a super-admin session; no Clerk session refused; form-encoded bodies 415; existing connection / autonomy routes keep their gate; governance absent from the sub-admin policy and `requireAdmin()` refuses sub-admins there; sidebar entry super-admin only · J: the exact 14-route inventory, one mutating method each, no catch-all, no agent-callable governance surface |
| `p10-governance-routes.test.ts` | 18 | B: create (credential once, hashed, authenticates, absent from views / audit), suspend → reactivate → rotate (old credential dead) → revoke (trigger cascade, then 409) · D: create, strict body (5 forged fields), 8 invalid configurations, publish + stale CONFLICT + racing admins (one winner), rollback (+ stale / invalid / missing), kill switch effective on the next request and idempotent · E: expectedVersion 0 → v1, stale CONFLICT, DELETE with version, back-compat without it, racing admins, effect on the next request · G: cancel queued → never executed, audited with reason; stale / finished / unknown / malformed / forged · H: create with secret once (not stored, viewed or audited), forged fields, bounded schedule, lifecycle + stale + race + illegal transitions, edit rules, rotation (old secret 401, new 202), 413 / malformed JSON |
| `p10-governance-views.test.ts` | 14 | pagination / filter primitives · C: catalog = registry, derived metadata, filters, live references, trigger options · F: 25 approvals over 2 pages, filters, display-time expiry, no binding material, no decide operation · G: 47 tasks over 3 pages, origin / capability / connection filters, redaction · H: 23 runs over 2 pages with task links, webhook stats, schedule occurrences in `Asia/Kolkata` · I: queue not configured / unreachable / ok, no connection strings, stuck tasks, overdue schedules, overview counts |
| `p10-governance-ui.test.ts` | 11 | J: captioned tables with `scope="col"` headers, labelled filters and form controls, search and pagination landmarks, `aria-current` on exactly one section; empty vs `role="alert"` unavailable (no internals) vs not found vs `role="note"` feature off; unknown filter values never reach the query; server-side page links keep filters; no credential hash / token / webhook secret / ciphertext in any of 8 pages; every `ActionButton` confirmed, destructive actions require a reason, forms confirm; cancel button only while cancellable; connection actions follow state |
| `p10-cross-phase.test.ts` | 12 | Scenarios 1–12 (below) |
| `p10-master.test.ts` | 3 | the 19-step master end-to-end scenario, the master security test (14 probes), the master performance test |

### Cross-phase scenarios

| # | Scenario | Phases | Result |
|---|---|---|---|
| 1 | MCP submit → queue → worker → adapter → agent reads the result; governance shows state only | 2–8, 10 | pass |
| 2 | approval required → human approves (step-up) → one bound task → executes once; reuse needs a new approval | 6–8, 10 | pass |
| 3 | platform event → governance-created trigger → authorized task → adapter; payload never queued | 6–10 | pass |
| 4 | signed webhook → task → adapter; response carries no task data | 6–10 | pass |
| 5 | schedule occurrence → exactly one task under two concurrent ticks | 6–10 | pass |
| 6 | governance kill switch while queued → never executes | 6, 8, 10 | pass |
| 7 | approval-bound task invalidated by an autonomy change made through the route | 7, 8, 10 | pass |
| 8 | connection revoked while pending → task never runs, triggers revoked, webhooks 404 | 2, 8–10 | pass |
| 9 | autonomy narrowed → queued task expires, new firing denied | 7–10 | pass |
| 10 | governance cancels the queued task, pauses the trigger, kills the policy → nothing executes | 6, 8–10 | pass |
| 11 | webhook replay, duplicate event id, repeated idempotency key → each operation executes once | 8, 9 | pass |
| 12 | isolation: other tenant's agent gets `TASK_NOT_FOUND`; sub-admin and agent credential cannot govern | 2, 8, 10 | pass |

Scenarios 10 and 12 are the Phase 10 scenarios of the series (governance acting on in-flight automation; isolation of the governance surface).

### Master end-to-end scenario (19 steps, one test)

1 register a connection (credential once) · 2 agent authenticates · 3 default deny · 4 publish two allows · 5 autonomy v1 · 6 MCP tool discovery · 7 async task over MCP → SUCCEEDED · 8 governance shows it without the result · 9 create + activate a webhook trigger · 10 signed delivery → task · 11 event trigger → task · 12 schedule trigger → task · 13 autonomy v2 requires approval · 14 next firing files an approval · 15 human approves, next firing consumes it once · 16 stale edit by a second admin → CONFLICT · 17 kill switch → next request denied · 18 revoke → credential dead, 3 triggers revoked, webhook 404 · 19 all 12 governance pages render the final state; no token, credential hash, webhook secret or ciphertext in any page, governance response or audit entry.

### Master security test

14 probes, all fail closed with no state change: sub-admin page and route access, agent bearer token on a governance route, cross-site form post, forged owner, stale version, path traversal, cross-tenant status and cancel, reserved `trigger.` idempotency key, version-pinned capability, forged webhook signature, webhook body choosing the capability, webhook replay.

### Master performance test (in-memory fakes; not a load test)

| Operation | Isolated run | Under full-suite parallel load | Ceiling |
|---|---|---|---|
| 200 task submissions (gate + task + enqueue) | 55 ms | 253 ms | 20 s |
| 200 executions (worker + guard + adapter) | 119 ms | 556 ms | 20 s |
| 200 signed webhook deliveries (verify + fire + task) | 180 ms | 520 ms | 20 s |
| 150 due schedules (2 ticks of 100) | 532 ms | 441 ms | 20 s |
| governance tasks page over 550 tasks (page 3, `take 20`) | 9 ms | 8 ms | 5 s |
| governance overview + runtime pages | 17 ms | 16 ms | 5 s |

## Opt-in integration suite (`npx vitest run -c vitest.integration.config.ts`)

Real BullMQ against local Memurai (Phases 8–9): **2 files, 9 tests, 9 passed** after the Phase 10 changes (no queue code changed in Phase 10).

## Quality gates

| Check | Result |
|---|---|
| `npx tsc --noEmit` | only the pre-existing `app/api/feedback/route.ts(128,11)` error |
| `eslint . --ext .ts,.tsx` | 122 problems (64 errors, 58 warnings) — identical to baseline; scoped lint of every Phase 10 new / modified file: 0 |
| `npm run build` | compiled; 15 `/admin/agent-governance/*` pages and 14 `/api/admin/agent-governance/*` routes present (dynamic); 244 static pages unchanged |
| security grep of 54 Phase 10 files (eval, Function, child_process, exec/spawn, raw SQL, console, secret env reads, innerHTML, web storage, secret columns) | 0 hits |

## Limitations

- Postgres is the in-memory fake (constraints and conditional updates reproduced); migrations are not applied.
- UI behaviour is verified by server rendering and source checks; there is no DOM / browser runner (no jsdom or Testing Library in the repository). A real browser check is deferred with the other deployment items.
- Performance numbers are in-memory and indicative only.
