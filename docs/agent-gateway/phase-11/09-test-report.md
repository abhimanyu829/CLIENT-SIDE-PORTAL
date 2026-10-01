# Phase 11 — 09 Test report

All tests run against the REAL Phase 1–11 modules over the in-memory fakes (no live Postgres in this environment; the Phase 7 fake reproduces the migration's unique constraints and conditional updates). Redis-backed integration tests run against Memurai on 127.0.0.1:6379.

## New suites (90 tests)

| File | Tests | Covers |
|---|---|---|
| `p11-ledger.test.ts` | 29 | A: creation, category derivation (= Prisma enum), digest covers every field, output digests, correlation from the trace scope, trace-id validation, redaction (allowlist, secret scrubbing, identifier / digest / code shapes, bounds, NUL), append-only by construction (no export, no code path, migration triggers). B: clean chain + external anchor, empty ledger, edit, metadata edit, recomputed digest, forged back-link, deletion, substitution, replay / duplicate, unknown schema, partial verification and truncation, unreadable store; 50 concurrent appends, cross-process race, persistent contention; strict vs best-effort vs throttled recording. |
| `p11-recovery.test.ts` | 21 | D: evidence captures exactly the mapped identifiers; 9 malformed specs rejected at registration; writes without a mapping are manual; COMPENSATABLE and REVERSIBLE recovery restore real state through gate + resolver with a deterministic idempotency key; the recovery is evidenced and the chain still verifies; IRREVERSIBLE / no mapping / missing identifiers / inactive or moved connection / unavailable recovery capability → manual, nothing runs; failed → retry → success, never a third run; 8 concurrent requests → one row, one dispatch; Phase 6 denial, autonomy denial, approval required → approve → single consumption, policy store down; tampered, re-digested (forward link) and forged evidence refused; reads / non-executions / unknown ids refused. |
| `p11-failures.test.ts` | 14 | E: ledger down blocks writes before dispatch but not reads; adapters cannot forge `dispatched: false`; a queued write refused pre-dispatch is retried and runs once; a dispatched transient failure is still not blindly retried; throwing observer / tracer before or after the operation changes nothing; breakers open → refuse without dispatch → half-open → close; failed probe re-opens; caller errors never count; connection breaker needs failures across capabilities and other connections are unaffected; default thresholds; metric labels bounded against 500 hostile values; real executions produce counters and histograms; no `execution.started` for unattempted mutations. |
| `p11-observability.test.ts` | 8 | C: request / authorization / execution / business-service spans share the request trace and ledger rows carry it; allowlisted span attributes; error spans carry only the code; inbound `traceparent` ignored; task submission → stored trace → worker spans and ledger rows (same trace, request id, task ref); webhook → trigger → task → execution on one trace; throttled authentication-failure evidence; the real MCP route handler opens the trace and records the failure. |
| `p11-governance.test.ts` | 18 | F: ledger and recoveries pages (SUPER_ADMIN; digests not data; recovery action only on successful writes; allowlisted filters; distinct error state); sub-admin with every permission / user / banned admin → `/unauthorized`, anonymous → `/login`; navigation; verification route (result, audit in AuditLog + ledger, tamper report, strict schema, 503 when unreadable); recovery route (manual for a write without mapping, idempotent, audited; refusals with stable codes; redirects record nothing; agent credentials 401 even with a session; form posts 415); no agent-callable path. |

The Phase 10 closed route inventory test was extended with the two Phase 11 routes.

## Results

| Run | Result |
|---|---|
| Full unit / scenario suite | **86 files, 1092 / 1092 passed** (1002 before Phase 11 + 90) |
| Integration (Redis) | **9 / 9 passed** |
| `tsc --noEmit` | only the pre-existing `app/api/feedback/route.ts(128,11)` TS2322 |
| ESLint on the 57 changed / new files | **0 problems** |
| `npm run build` | pass, 244 static pages; `/admin/agent-governance/ledger`, `/recoveries` and both API routes dynamic |

## Not verified here

- The migration against a live Postgres (append-only trigger behaviour, `jsonb` round trip of digested metadata) — deferred with all migrations until after Phase 15.
- Spans exported to a real Sentry project.
- Browser rendering of the new pages (static markup and accessibility attributes are asserted; no screen-reader test).
