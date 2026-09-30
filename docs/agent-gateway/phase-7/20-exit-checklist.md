# Phase 7 — Exit Checklist

Legend: ✅ done and verified · ⚠️ done, with the stated limit · ⛔ not done (needs you)

| # | Criterion | Status |
|---|---|---|
| 1 | Five autonomy levels defined and enforced | ✅ |
| 2 | Default posture is OBSERVE_ONLY / read-only | ✅ |
| 3 | Autonomy never overrides Phase 6 DENY | ✅ |
| 4 | Mandatory approval gates no level can remove | ✅ |
| 5 | Autonomy policy versioned, human-only, no cache | ✅ |
| 6 | Environment scope | ✅ |
| 7 | Resource scope | ✅ |
| 8 | Capability allowlist and risk ceiling | ✅ |
| 9 | Approval request model with principal, capability, resource, env, risk, digests, summary | ✅ |
| 10 | Unpredictable public reference | ✅ |
| 11 | Idempotent request creation | ✅ |
| 12 | State machine with terminal states | ✅ |
| 13 | Atomic conditional transitions | ✅ (fake DB) |
| 14 | Deterministic canonicalization | ✅ |
| 15 | Binding covers identity, capability+version, resource, env, input, policy versions | ✅ |
| 16 | Approval for A never authorizes B | ✅ |
| 17 | Bounded expiry by risk/env/reversibility | ✅ |
| 18 | Expiry enforced at approve and consume time | ✅ |
| 19 | Single-use consumption | ✅ |
| 20 | Replay refused | ✅ |
| 21 | Concurrent consumption: exactly one | ✅ (fake DB) |
| 22 | Rejection is final for that operation | ✅ |
| 23 | Cancellation by human | ✅ |
| 24 | Policy change invalidates approvals | ✅ |
| 25 | Authorization revocation after approval blocks execution | ✅ |
| 26 | Connection suspend/revoke/reactivate retires approvals | ✅ |
| 27 | Execution gate before Phase 4, re-evaluated every call | ✅ |
| 28 | Fail closed on every error | ✅ |
| 29 | Existing human auth reused (Clerk + requireSuperAdmin) | ✅ |
| 30 | Approver authorization (SUPER_ADMIN) | ✅ |
| 31 | Approver identity from session only | ✅ |
| 32 | Agent credentials rejected as human approval | ✅ |
| 33 | Anti-self-approval with desktop control (out-of-band SMS step-up) | ✅ design + tests; ⚠️ live SMS not exercised |
| 34 | Human confirms exact binding | ✅ |
| 35 | Exactly one decision record per request | ✅ |
| 36 | Redacted, human-readable summary; no raw input stored | ✅ |
| 37 | No agent-reachable approval or autonomy write path | ✅ |
| 38 | Cua not built, replaced or reconfigured | ✅ |
| 39 | Cua permissions not widened | ✅ |
| 40 | Cua observation never equals backend approval | ✅ |
| 41 | Cua failures are environment signals, not decisions | ✅ |
| 42 | Live Cua readiness verified | ✅ (read-only) |
| 43 | Stable error codes, no internal leakage | ✅ |
| 44 | Observability through the existing logger | ✅ |
| 45 | Test sections A–U | ✅ 162 new tests, 700/700 total |
| 46 | Typecheck at baseline | ✅ |
| 47 | Lint at baseline | ✅ |
| 48 | Build succeeds with new routes | ✅ |
| 49 | Migration written and validated | ✅ written/validated; ⛔ not applied |
| 50 | No Phase 8+ work, no business/payment/deployment changes | ✅ |

## Needs you

- Apply Phase 6 then Phase 7 migrations (after reviewing drift).
- Make sure Twilio (or MSG91) is configured and each approving SUPER_ADMIN has a verified phone; otherwise approvals fail closed.
- Run one real human approval end to end.
- Commit/push when you are ready (Phase 6 and 7 are uncommitted).
