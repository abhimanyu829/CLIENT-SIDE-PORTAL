# Phase 15 — 02 Release stages

One rollout per capability and environment.

| Stage | Who may use the capability |
|---|---|
| `DISABLED` | nobody |
| `INTERNAL` | the named cohort (≤ 50 connections) |
| `CANARY` | the cohort plus connections whose stable bucket `sha256(connection ‖ capability) mod 100 < canaryPercent` (1–50 %) |
| `GENERAL` | every connection that Phase 6 / 7 allow |
| `PAUSED` | nobody; remembers the stage it was paused from |

A stage only narrows: Phase 6 authorization, Phase 7 autonomy and approvals still decide every call.

## Transitions (`ReleaseService.transitionRollout`)

| Action | From → to | Guard |
|---|---|---|
| configure | (none) → `DISABLED`; any stage keeps its stage | capability agent-available; cohort of existing connections; 0–100 % (≤ 50 % while CANARY); INTERNAL needs a cohort |
| advance | DISABLED → INTERNAL → CANARY → GENERAL, one step | INTERNAL needs a cohort; CANARY needs 1–50 %; GENERAL needs a health gate that is not UNHEALTHY / UNAVAILABLE, and in production a passed attestation from the last 7 days |
| pause | INTERNAL / CANARY / GENERAL → PAUSED | — |
| resume | PAUSED → paused-from stage | health gate not UNHEALTHY / UNAVAILABLE |
| rollback | any → a lower active stage (incl. DISABLED) | target strictly below the current (or paused-from) stage |

Every change is conditional on the expected version (and current stage), records `rollout.configured / advanced / paused / resumed / rolled_back` in the ledger (stage, previous stage, percentage, cohort size, reason, measured health) and an `AGENT_ROLLOUT_*` AuditLog row.

## Effect on agents

Hidden from `tools/list` for connections outside the audience; `agent_task_submit` and any direct reach are refused by the gate with `ROLLOUT_BLOCKED`; refusals are evidenced (`security.rollout_blocked`, throttled) and counted (`agent_rollout_block_total{stage}`).

Proof: `p15-release-controls` D, `p15-release-service` H, master S19, final E2E steps 03–06, 21.
