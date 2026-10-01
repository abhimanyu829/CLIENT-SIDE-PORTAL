# Phase 15 — 08 Production readiness

## Status by area

| Area | State | Notes |
|---|---|---|
| Code (Phases 0–15) | ready | all suites green, typecheck / lint / build at baseline (`11`) |
| Database | **pending** | the agent-gateway migrations (`20260929000000_agent_gateway_phase2_identity` … `20261005000000_agent_gateway_phase15_release_controls`) are written and each was checked against `prisma migrate diff`; applying them to a live database is deferred (owner's instruction: after Phase 15) |
| Human approval with SMS step-up | **pending** | needs Twilio credentials and verified approver phone numbers (owner's instruction: after Phase 15) |
| Live human approval drill / browser check of the governance UI | **pending** | owner's instruction: after Phase 15 |
| Redis | required | rate limits, nonces, webhook replay protection and (since the post-Phase-15 fix) sync-path idempotency fail closed without it |
| Release controls | ready | default `AGENT_GATEWAY_ROLLOUT_ENFORCED` off = no behaviour change on deploy |

## Go-live sequence (recommended)

1. Apply the pending migrations to staging; run `verifyAuditChain` from the ledger page.
2. Configure Twilio; verify every SUPER_ADMIN approver's phone; run one real approval end to end.
3. Turn on `AGENT_GATEWAY_ROLLOUT_ENFORCED` in staging; configure rollouts (all DISABLED), release reads to an INTERNAL cohort.
4. Exercise the kill-switch drill: activate GLOBAL, confirm empty tool list, deactivate.
5. Record attestations; advance to CANARY, then GENERAL after the health gate is HEALTHY.
6. Repeat 1–5 in production; promote autonomy one level at a time per connection.

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `AGENT_GATEWAY_ENABLED` | master switch | off |
| `AGENT_GATEWAY_MCP_ENABLED` | MCP endpoint | off |
| `AGENT_GATEWAY_TASKS_ENABLED` | task tools / worker | off |
| `AGENT_GATEWAY_ENVIRONMENT` | `development` / `production` / `test` | development |
| `AGENT_GATEWAY_CREDENTIAL_STORE` | `db` in production | — |
| `AGENT_GATEWAY_ROLLOUT_ENFORCED` | missing rollout = DISABLED | off |

## Monitoring

Counters (closed label sets): `agent_security_denial_total{reason}` (includes `KILL_SWITCH_ACTIVE`, `ROLLOUT_BLOCKED`, `RELEASE_CONTROLS_UNAVAILABLE`), `agent_kill_switch_block_total{scope}`, `agent_rollout_block_total{stage}`, `agent_execution_total`, `agent_circuit_transition_total`, `agent_content_findings_total`. Ledger: `security.*`, `rollout.auto_paused`, `failure.circuit_opened`. The release page shows each rollout's health verdict.

## Open items carried into operation

Resolved after Phase 15 (`../known-issues-resolution.md`): P14-F2, P14-F3, PRE-12-1, PRE-13-1..3, and the sync-path idempotency gap (the sync path now fails closed when Redis errors and reserves keys atomically; the task path is unchanged). The broken catalog migration that blocked `prisma migrate deploy` is fixed. Remaining steps that need a person (applying the migrations, the SMS approval drill, the browser check) are in `../deployment-runbook.md`.
