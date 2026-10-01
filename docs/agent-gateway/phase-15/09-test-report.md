# Phase 15 — 09 Test report

## New suites

| Suite | Tests | Covers |
|---|---|---|
| `p15-release-controls` | 14 | A pure evaluation (scopes, stages, canary bucket stability and spread, kill switch beats rollout, legacy vs enforced); B kill switches at the gate and the tool surface (GLOBAL, CAPABILITY, CONNECTION, RISK_TIER, immediate deactivation); C queued tasks fail terminally and stay failed, resolver re-check before dispatch, fail-closed on unreadable controls; D staged release DISABLED → INTERNAL → CANARY → GENERAL, pause / resume, enforcement off changes nothing |
| `p15-release-service` | 17 | G kill-switch lifecycle (validation, idempotency, evidence, version checks, concurrent deactivation); H rollout guards (cohort, percentage, one step at a time, health gate, production attestation, rollback only downwards); I health verdicts from the ledger; J auto-pause in the maintenance pass; K attestations; L guarded promotion and demotion; M routes, strict bodies, AuditLog, page and navigation |
| `p15-master-scenarios` | 24 | master cross-phase scenarios S01–S24 (below) |
| `p15-final-e2e` | 22 | the final end-to-end acceptance, steps 01–22, through the real MCP route handler with a real bearer credential |
| **Total** | **77** | |

Updated existing test: `p10-governance-access` — the closed route inventory, the SUPER_ADMIN / agent-credential / non-JSON checks and the page list now include the six Phase 15 routes and the release page.

## Master cross-phase scenarios

| # | Phases | Scenario |
|---|---|---|
| S01 | 1, 2, 11 | forged or missing credentials never reach a capability; nothing business-related recorded |
| S02 | 2, 7, 8 | connection revoked mid-flight: queued task expires undispatched |
| S03 | 3, 5, 12, 15 | the tool surface is exactly executable + agent-available + released |
| S04 | 6, 11 | DENY overrides ALLOW, evidenced |
| S05 | 7, 13 | READ-only autonomy refuses writes; ASSISTED turns them into approvals |
| S06 | 7, 13 | an approval binds the exact operation and is single-use |
| S07 | 8, 6 | policy revoked while queued: worker re-verification expires the task |
| S08 | 9, 12 | signed webhook fires the trigger's fixed capability; the body chooses nothing |
| S09 | 10, 15 | a sub-admin cannot operate any release control |
| S10 | 11 | decisions and executions are chained evidence; tampering is detected |
| S11 | 11, 13 | an agent's ticket is compensated exactly once by a recovery |
| S12 | 11, 15 | a kill switch also stops recoveries |
| S13 | 12, 13 | injected instructions in a ticket arrive labelled, with secrets removed |
| S14 | 12, 14 | neither stored secrets nor the agent's own hostile values are reflected |
| S15 | 13, 12 | no new domain read crosses tenants |
| S16 | 8, 13 | durable dedupe of keyed writes on the task path; reserved keys refused |
| S17 | 11, 15 | infrastructure failures open the breaker, fail the health gate, auto-pause the canary |
| S18 | 15, 8, 9 | GLOBAL kill switch stops sync calls, task submission, trigger firings; deactivation restores |
| S19 | 15, 5 | with enforcement on, a staged release reaches only its cohort |
| S20 | 12, 15, 7 | hostile input blocks the connection's autonomy promotion |
| S21 | 15, 11 | health and attestation gates guard general availability |
| S22 | 14, 15 | simulation invariants hold under an active kill switch; every write stopped |
| S23 | 11, 8 | one trace id from the submitting request to the worker's execution |
| S24 | protected systems | no payment / order / checkout / billing / auth import; adapters write only `Ticket` |

## Final end-to-end acceptance (22 steps)

01 connect an agent (bearer shown once, stored hashed) · 02 forged credential refused · 03 nothing released → only task tools · 04 Phase 6 access + ASSISTED autonomy (still nothing visible) · 05 release four capabilities to an INTERNAL cohort · 06 exactly those tools visible · 07 autonomous read, contract fields only · 08 keyed write without key refused before any approval · 09 keyed write needs approval · 10 human approval with step-up and binding digest · 11 identical retry runs once for the customer behind a recorded intent · 12 read back as labelled third-party content · 13 ledger holds the story, chain verifies · 14 guarded promotion one level · 15 recovery needs approval · 16 human approves the recovery · 17 recovery runs once as the original connection, ticket closed · 18 GLOBAL kill switch: no tools, calls refused · 19 deactivation restores exactly the released surface · 20 failing capability auto-paused by its health gate · 21 rollback to DISABLED and demotion · 22 chain intact, every operator change in the AuditLog, no secret anywhere, all nine platform invariants hold over the recorded observations.

## Regression

Full suite and gates: `11-phase-15-exit.md`.
