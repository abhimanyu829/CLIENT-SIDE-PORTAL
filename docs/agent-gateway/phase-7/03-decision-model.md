# Phase 7 — Decision Model

`resolveAutonomyDecision()` (`autonomy/evaluator.ts`) is pure and deterministic. Each step can only make the result stricter.

1. Autonomy store failed -> `POLICY_UNAVAILABLE`
2. Phase 6 `POLICY_UNAVAILABLE` -> `POLICY_UNAVAILABLE`; Phase 6 DENY -> `AUTHORIZATION_DENIED`
3. Capability not `AGENT_AVAILABLE` / not `ACTIVE` -> deny
4. Stored policy malformed -> `INVALID_AUTONOMY_POLICY`
5. Environment outside scope -> `ENVIRONMENT_BLOCKED`
6. Capability outside allowlist -> `CAPABILITY_OUT_OF_SCOPE`; resource outside scope -> `RESOURCE_OUT_OF_SCOPE`
7. Risk above `maxRiskTier` -> `RISK_ABOVE_AUTONOMY_THRESHOLD`
8. Level matrix -> may deny (`AUTONOMY_DENIED`) or require approval
9. Mandatory gates -> `REQUIRE_APPROVAL`
10. Otherwise -> `ALLOW_AUTONOMOUS`

## Mandatory approval gates

No level removes these (`autonomy/approval-requirements.ts`). They derive only from Phase 3 metadata and Phase 0's risk classification:

- CRITICAL risk tier
- IRREVERSIBLE mutation (`rollback.reversibility`)
- Financial mutation: domain in payments/refunds/billing/payouts, or a side effect matching payment/money/refund/billing/payout/charge
- Production deployment/provisioning mutation
- Capability listed in the connection's `approvalRequiredFor`
- Phase 6 returned `REQUIRES_APPROVAL`

## Outcomes

| Outcome | Gate result |
|---|---|
| `ALLOW_AUTONOMOUS` | adapter runs |
| `DENY` | `AUTHORIZATION_DENIED`, `AUTONOMY_DENIED` or `ENVIRONMENT_BLOCKED` |
| `POLICY_UNAVAILABLE` | `POLICY_UNAVAILABLE` |
| `REQUIRE_APPROVAL` | approval flow (`04-approval-engine.md`) |

Approval policy is expressed as this fixed rule list plus the per-connection list and Phase 6's `REQUIRES_APPROVAL` effect. A third configurable policy store would duplicate Phase 6.
