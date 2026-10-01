# Phase 11 — 05 Metrics

`observability/agent-metrics.ts` adds **labelled** agent metrics next to the existing unlabelled `gateway_*` counters (`observability/metrics.ts`, unchanged). Process-local, like the existing ones.

## Counters

| Metric | Labels |
|---|---|
| `agent_requests_total` | protocol, outcome |
| `agent_authorization_total` | decision, risk_tier |
| `agent_approval_total` | outcome |
| `agent_execution_total` | capability, outcome, risk_tier |
| `agent_task_created_total` / `succeeded_total` / `retry_total` | capability |
| `agent_task_failed_total` | capability, reason |
| `agent_trigger_total` | source, outcome |
| `agent_security_denial_total` | reason |
| `agent_rollback_total` | outcome, recovery_class |
| `agent_audit_append_total` | category, outcome |
| `agent_circuit_transition_total` | scope, state |
| `agent_kill_switch_block_total` / `agent_rollout_block_total` | scope / stage (Phase 15) |

## Histograms (ms; buckets 5 … 10 000 + overflow)

`agent_execution_duration_ms` (capability, outcome), `agent_policy_evaluation_duration_ms` (decision), `agent_task_queue_latency_ms` (capability), `agent_audit_append_duration_ms` (outcome).

## Cardinality is bounded by construction

Every metric declares its label keys; every value is checked:

- `capability` — only ids registered in the capability registry (`setKnownCapabilityIds`, called by the registry singleton), else `other`;
- `reason` — only `UPPER_SNAKE` codes, else `other`;
- every other key — a closed vocabulary (protocol, outcome, decision, risk tier, source, scope, state, stage, recovery class, ledger category), else `other`;
- empty → `none`.

So raw input, resource ids, owner ids, emails, tokens and free text can never become a series (tested with 500 hostile values → one series). Non-finite or negative durations are ignored. Metric code never throws into the measured operation.

`getAgentMetricsSnapshot()` / `counterTotal()` read the registry (diagnostics, tests). There is no metrics HTTP endpoint in this phase; exporting to the platform's metrics backend is a deployment follow-up.
