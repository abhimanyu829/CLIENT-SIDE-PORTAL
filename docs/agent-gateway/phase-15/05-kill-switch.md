# Phase 15 — 05 Kill switch

| Scope | Stops |
|---|---|
| `GLOBAL` | every agent operation in the environment |
| `CAPABILITY` | one capability id |
| `CONNECTION` | one agent connection |
| `RISK_TIER` | every capability of one tier (e.g. freeze all `LOW_RISK_WRITE`) |

## Enforcement

- Gate step 1b, before Phase 6, autonomy and any approval is created or consumed: sync calls, task submission, worker re-verification, trigger firings and recoveries are refused (`KILL_SWITCH_ACTIVE`).
- Resolver, immediately before dispatch (a switch flipped after the gate decision still stops the call).
- `tools/list`: affected capabilities are hidden; with nothing left, the agent gets an empty list and a stable `CAPABILITY_NOT_FOUND` (P15-B2).
- Queued tasks fail terminally (`EXPIRED`, detail `KILL_SWITCH_ACTIVE`) and do not resume after deactivation.
- No cache: activation and deactivation apply on the next call.
- Fail closed: unreadable controls refuse (`POLICY_UNAVAILABLE` at the gate, transient for queued tasks; `EXECUTION_UNAVAILABLE` at the resolver).

## Operation

`POST /api/admin/agent-governance/kill-switches` `{ scope, target?, reason }` (idempotent per scope + target: an identical active switch is returned, `created: false`); `POST …/kill-switches/[ref]/deactivate` `{ expectedVersion, reason }`. Validation: GLOBAL takes no target; CAPABILITY must be a registered id; CONNECTION an existing connection; RISK_TIER a known tier. Rows are never deleted. Evidence: `kill_switch.activated / deactivated` (human actor, scope, target, reason), AuditLog, `security.kill_switch_blocked` for each refused operation (throttled), `agent_kill_switch_block_total{scope}`.

The ledger write is best effort: an emergency stop never fails because the evidence store is down (the AuditLog row is the primary record of the human action, as for every governance change).

Proof: `p15-release-controls` A–C, `p15-release-service` G, master S03, S12, S18, S22, final E2E steps 18–19.
