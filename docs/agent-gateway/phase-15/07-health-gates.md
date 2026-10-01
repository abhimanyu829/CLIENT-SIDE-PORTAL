# Phase 15 — 07 Health gates

Computed from the audit ledger (`rollout/health-gates.ts`), over a trailing window of 60 minutes, per capability (rollouts, attestations) or per connection (promotion):

| Input | Ledger source |
|---|---|
| successes | `execution.succeeded` |
| service failures | `execution.failed` with `EXECUTION_UNAVAILABLE`, `INTERNAL_ERROR` or `TIMEOUT` (the breaker vocabulary). Agent mistakes (`RESOURCE_NOT_FOUND`, `INVALID_INPUT`, …) do not count |
| circuit openings | `failure.circuit_opened` for the capability / connection |
| security events (connection gates) | `security.task_violation`, `security.input_rejected`, `security.injection_suspected`, `security.outbound_blocked` |

| Verdict | Rule |
|---|---|
| `UNHEALTHY` | a circuit opened, or failure rate > 25 % with ≥ 20 samples, or (connection gates) security events above the limit (0) |
| `INSUFFICIENT_DATA` | fewer than 20 samples and nothing unhealthy |
| `HEALTHY` | ≥ 20 samples, failure rate ≤ 25 %, no circuit opening |
| `UNAVAILABLE` | the ledger cannot be read; never treated as healthy |

## Where they gate

| Decision | Requires |
|---|---|
| advance to GENERAL, resume | not UNHEALTHY / UNAVAILABLE |
| attestation | UNHEALTHY / UNAVAILABLE adds a failed check |
| promotion | not UNHEALTHY / UNAVAILABLE; HEALTHY for LIMITED_AUTONOMY and above |
| auto-pause (maintenance, every 5 minutes) | INTERNAL / CANARY rollouts that are UNHEALTHY → PAUSED (`rollout.auto_paused`, actor SYSTEM). GENERAL is never auto-paused: removing a capability from everyone is an operator decision (kill switch) |

Proof: `p15-release-service` I, J, master S17, S21, final E2E step 20.
