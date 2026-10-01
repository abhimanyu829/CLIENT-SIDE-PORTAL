# Phase 15 — 01 Rollout architecture

Phase 15 adds release controls to the agent platform without a new request path: they are evaluated inside the existing chokepoints.

```
agent ─► MCP route ─► tools/list  ──► visibleCapabilities()           (hide what the connection cannot use)
                 └─► tools/call  ──► ExecutionGate.evaluate
                                      1  identity
                                      1b release controls  ◄── kill switches + rollout (DB, no cache)
                                      2  Phase 6 authorization
                                      3  Phase 7 autonomy / approval
                                  ──► AdapterResolver.execute
                                      environment check
                                      release controls again (immediately before dispatch)
                                      idempotency, breakers, audit intent, adapter
task worker ─► gate.evaluatePolicy (1b included) ─► resolver (re-check) ─► adapter
trigger firing / recovery ─► gate.grant (1b included) ─► resolver (re-check)
maintenance pass (5 min) ─► health gates ─► auto-pause INTERNAL / CANARY rollouts
```

## Components

| Module | Role |
|---|---|
| `rollout/types.ts` | stages, scopes, rows, verdicts |
| `rollout/store.ts` | `AgentRollout` / `AgentKillSwitch` persistence, conditional updates |
| `rollout/controls.ts` | pure evaluation, `checkRuntimeControls`, `visibleCapabilities`, refusal evidence |
| `rollout/health-gates.ts` | health verdicts from the audit ledger |
| `rollout/release-service.ts` | operator actions (kill switches, rollout transitions) and auto-pause |
| `rollout/attestations.ts` | release attestations as ledger events |
| `rollout/promotion.ts` | guarded autonomy promotion / demotion |
| `governance/release.ts`, `governance/routes.ts` | SUPER_ADMIN actions and routes |
| `app/(admin)/admin/agent-governance/release` | the operator page |

## Data

Migration `20261005000000_agent_gateway_phase15_release_controls` (additive): enums `AgentRolloutStage`, `AgentKillSwitchScope`; tables `AgentRollout` (unique `capabilityId + environment`, optimistic `version`) and `AgentKillSwitch` (unique `publicRef` `ksw_…`, never deleted). Attestations and every change are audit-ledger events (category `CONFIGURATION`), so the history of releases is as tamper-evident as the rest of the evidence.

## Rejected alternatives

- Reusing `FeatureFlag`: not environment-scoped, editable by sub-admins, no versioning or evidence.
- Caching the controls: a kill switch must apply on the very next call (the autonomy store made the same choice).
- An attestation table: the append-only ledger already provides immutability and ordering.

## Compatibility

`AGENT_GATEWAY_ROLLOUT_ENFORCED` (default off): a capability without a rollout row keeps its pre-Phase-15 behaviour, so deploying Phase 15 changes nothing until an operator configures a rollout. Kill switches apply either way. With the flag on, a missing row means DISABLED.
