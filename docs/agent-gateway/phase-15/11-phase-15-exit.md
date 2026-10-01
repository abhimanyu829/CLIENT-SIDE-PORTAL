# Phase 15 — 11 Exit report

✅ done and verified · ⚠️ done with the stated limit · ⛔ deferred by plan

| Exit criterion | Status | Evidence |
|---|---|---|
| Rollout architecture inside the existing chokepoints | ✅ | gate step 1b, resolver re-check, tool-surface filter (`01`) |
| Release stages DISABLED / INTERNAL / CANARY / GENERAL / PAUSED | ✅ | `02`, `p15-release-controls` D, `p15-release-service` H |
| Canary by stable hash bucket | ✅ | `03` |
| Guarded autonomy activation (one level, health + security + kill-switch guards) | ✅ | `04`, `p15-release-service` L |
| Kill switches (GLOBAL / CAPABILITY / CONNECTION / RISK_TIER), immediate, fail closed | ✅ | `05`, `p15-release-controls` B–C |
| Rollback of releases, autonomy and executions | ✅ | `06` |
| Health gates from the ledger; auto-pause in the maintenance pass | ✅ | `07`, `p15-release-service` I–J |
| Attestations as ledger evidence; production GA requires one | ✅ | `p15-release-service` H, K |
| Governance routes and page, SUPER_ADMIN only | ✅ | six routes, `/admin/agent-governance/release`, p10 inventory |
| Master cross-phase scenarios 1–24 | ✅ | `p15-master-scenarios` (24 / 24) |
| Final end-to-end acceptance (22 steps) | ✅ | `p15-final-e2e` (22 / 22) |
| Regression | ✅ | 1453 / 1453 (106 files) + 9 / 9 integration |
| Typecheck / lint / build | ✅ | baseline / baseline (changed files 0) / pass (241) |
| Migrations applied; Twilio and verified phones; live approval drill; browser check | ⛔ | deferred by the owner until after Phase 15 (`08`) |

## 1. Architecture

`01`. No new request path or subsystem: the release controls are read by the existing gate and resolver and filter the existing MCP tool projection; the evidence is the Phase 11 ledger; the operator surface is the Phase 10 governance pattern.

## 2. Files changed

New: `lib/agent-gateway/rollout/{types,store,controls,health-gates,release-service,attestations,promotion}.ts`; `lib/agent-gateway/governance/release.ts`; routes `app/api/admin/agent-governance/{kill-switches,kill-switches/[ref]/deactivate,rollouts,rollouts/transition,attestations,connections/[id]/autonomy}/route.ts`; page `app/(admin)/admin/agent-governance/release/page.tsx`; `components/admin/agent-governance/ReleaseActionForm.tsx`; migration `20261005000000_agent_gateway_phase15_release_controls`; tests `p15-{release-controls,release-service,master-scenarios,final-e2e}.test.ts`; docs `phase-15/01–11`.

Modified: `prisma/schema.prisma`; `config.ts` (`AGENT_GATEWAY_ROLLOUT_ENFORCED`); `execution-gate/gate.ts` (step 1b, two gate codes); `execution/resolver/adapter-resolver.ts` (re-check before dispatch); `execution/contracts/execution-error.ts` (two codes); `mcp/server.ts` (visible-capability filter, empty-surface handlers); `mcp/route-handler.ts` (computes visibility); `tasks/maintenance.ts` (auto-pause step); `observability/agent-metrics.ts` (label vocabulary); `governance/{audit,schemas,routes}.ts`; `GovernanceNav.tsx`; test fakes (`approval-fake-db.ts`, `execution-fake-db.ts`, `governance-test-kit.ts`) and the p10 inventory test.

## 3. Database changes

Additive: enums `AgentRolloutStage`, `AgentKillSwitchScope`; tables `AgentRollout` (unique `capabilityId + environment`, indexes on `environment, stage`) and `AgentKillSwitch` (unique `publicRef`, indexes on `environment, active` and `scope, target`). The migration SQL is exactly the output of `prisma migrate diff` from the previous commit's schema; `prisma validate` passes. Not applied (deferred).

## 4. APIs / services

`POST /api/admin/agent-governance/kill-switches`, `…/kill-switches/[ref]/deactivate`, `…/rollouts`, `…/rollouts/transition`, `…/attestations`, `…/connections/[id]/autonomy`. Services: `checkRuntimeControls`, `visibleCapabilities`, `ReleaseService`, `evaluateHealth`, `recordReleaseAttestation`, `promoteAutonomy` / `demoteAutonomy`. New agent-visible codes: `KILL_SWITCH_ACTIVE`, `ROLLOUT_BLOCKED`.

## 5. Workers

The task maintenance pass (every 5 minutes, existing schedule) gains the `release-health` step (auto-pause). Queued tasks hit by a kill switch or rollout block expire terminally.

## 6. Tests

77 new (`09`); full suite 1453 / 1453 (106 files); integration 9 / 9.

## 7. Security

Controls only ever narrow; every refusal is evidenced; unreadable controls refuse; no cache; operator actions are SUPER_ADMIN with a live session, JSON-only, versioned and audited; no agent-callable path changes a control (closed route inventory, p10 J). Platform security invariants:

| # | Invariant | Evidence |
|---|---|---|
| 1 | Agent identity comes only from a verified credential | P2 suites, S01, E2E 02 |
| 2 | Credentials are stored hashed / encrypted and shown once | `p12-secrets`, E2E 01 |
| 3 | Replayed signed requests and webhooks are refused | P1, P9 suites |
| 4 | Revoked / suspended / expired connections cannot act, now or later | S02, `p8-task-worker` |
| 5 | Every operation passes Phase 6 authorization, freshly evaluated | S04, S07 |
| 6 | Autonomy never exceeds the connection's level and risk ceiling | S05, P7 suites |
| 7 | Mandatory approvals (critical, irreversible, financial, production deployment) cannot be removed | P7 suites |
| 8 | An approval binds one exact operation and is consumed once | S06, RT-2, I8 |
| 9 | Approvers see redacted, warned input | `p12-injection` B5 |
| 10 | Queued work is re-verified before every attempt | S07, P8 suites |
| 11 | Webhook bodies cannot choose capability, input, owner or connection | S08, P9 suites |
| 12 | Only executable, agent-available, released capabilities are tools | S03, S19, `p12-tool-security` |
| 13 | Forbidden / internal / described-only capabilities never execute | ADV-4, I7 |
| 14 | Hostile input is refused before the gate and before any approval | ADV-5, `p12-injection` B4 |
| 15 | Tenants never see each other's data, tasks or approvals | S15, ADV-1, `p12-isolation` |
| 16 | Identity / ownership fields in arguments are refused | ADV-2, P13 suites |
| 17 | Third-party text is labelled data, never instructions | S13, RT-1 |
| 18 | No secret reaches an agent, log, span, metric or ledger row | S13, S14, `p12-secrets`, I2 |
| 19 | Errors are stable codes and never reflect input or internals | `p14-findings`, I3 |
| 20 | No agent-reachable outbound request exists; the outbound guard refuses internal targets | `p12-ssrf` |
| 21 | Every mutation has a recorded intent before it runs; a ledger outage refuses writes | S10, `p13-support-writes`, I4 |
| 22 | Every execution follows a gate grant for the same request | I5 (all simulations, E2E 22) |
| 23 | Writes only affect the acting owner's resources | I6, S24 |
| 24 | The audit ledger is append-only and tamper-evident | S10, `p11-ledger`, I9 |
| 25 | Recovery runs only declared compensations, as the original connection, through the gate, once | S11, E2E 15–17 |
| 26 | Duplicate requests never duplicate effects on the durable path | S16, RT-5 |
| 27 | Circuit breakers stop calls to failing dependencies, narrowly | S17, `p11-failures` |
| 28 | A kill switch stops every matching operation immediately, including queued tasks and recoveries | S12, S18, `p15-release-controls` B–C |
| 29 | Release stages only narrow access, and unreleased capabilities are invisible | S19, `p15-release-controls` D |
| 30 | Autonomy rises one guarded level at a time and falls instantly | S20, `p15-release-service` L |
| 31 | Governance is SUPER_ADMIN-only with a live session; agent credentials and forms are refused | S09, `p10-governance-access` |
| 32 | The capability surface and dependencies are pinned and statically scanned | `p12-supply-chain` |

## 8–11. Failures, bugs, pre-existing

Bugs discovered 3, fixed 3 (`10`). Pre-existing not fixed: PRE-12-1, PRE-13-1..3, feedback-route TS error, ESLint baseline. Open findings: P14-F2, P14-F3.

## 12. Out of scope

Applying migrations, SMS provider setup, live approval and browser checks (deferred by the owner); automatic promotion to GENERAL (always an operator decision); multi-region release coordination.

## 13–16. Quality gates

Typecheck: baseline only (`app/api/feedback/route.ts(128,11)`). Lint: 122 problems = baseline; the 36 changed / new code files have 0. Build: pass (241 static-generation entries; `/admin/agent-governance/release` dynamic). DB: `prisma validate` passes; migration = `prisma migrate diff` output; not applied.

## 17. Git diff

As in 2; `graphify-out/` regenerated; `.kiro/specs/` not committed.

## 18. Protected systems

Human auth, RBAC, sub-admin policy, payments, orders, invoices, subscriptions, products, pricing, cart, checkout, deployment, provisioning, storage, portal: not changed (S24 scans the gateway's imports and adapter writes). The cua contract was not used or extended.

## 19. Exit criteria

Met, with the owner-deferred operational steps listed above.
