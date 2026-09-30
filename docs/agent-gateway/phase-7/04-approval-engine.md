# Phase 7 — Approval Engine

## Agent flow

1. The agent calls a tool. The gate decides `REQUIRE_APPROVAL`.
2. The gate computes the binding digest of this exact operation and looks up the live approval by `activeBindingKey = connectionId:bindingDigest`.
3. If one is APPROVED and unexpired, it is consumed atomically and the adapter runs.
4. Otherwise the gate returns a tool error:

```
APPROVAL_REQUIRED: Capability "coupons.create" requires human approval. Approval reference: apr_<32 hex>.
A SUPER_ADMIN must approve it at /admin/agent-approvals/apr_<...> (approval requires an SMS code sent to
the approver's verified phone), then retry the identical call before <ISO expiry>.
```

5. The agent retries the identical call after approval. It never passes an approval id: the gate re-derives the digest, so an approval can only ever match the operation it was granted for. Phase 3 input schemas stay `.strict()` and unchanged.

## Idempotent creation

`findOrCreateApprovalRequest` returns the existing live request for the same binding. `activeBindingKey` is unique while PENDING/APPROVED and cleared on every terminal transition, so concurrent identical calls collapse onto one row (P2002 -> re-read the winner).

## Other outcomes the agent can see

| Code | Meaning |
|---|---|
| `APPROVAL_REJECTED` | A human rejected this exact operation; retrying unchanged is refused until the rejected request's window passes |
| `APPROVAL_EXPIRED` | The approval expired before execution; the next retry opens a new request |
| `APPROVAL_BINDING_MISMATCH` | An approval exists for the same capability+resource but different input; a new request is opened |
| `APPROVAL_POLICY_CHANGED` | Same input, but policy/identity context changed; the old approval is cancelled and a new request opened |
| `APPROVAL_ALREADY_CONSUMED` | Lost a race to consume |

## Stored request (`AgentApprovalRequest`)

Principal (connection, agent, owner, team), capability + version, resource, environment, risk tier, autonomy level + version, authorization policy ref, input digest, binding digest, redacted `displaySummary`, required approver scope, approval method, timestamps per state, step-up hash/expiry/attempts, `publicRef` (random, never the DB id). Raw input is never stored — only its digest and the redacted summary.

## Decision record (`AgentApprovalDecision`)

Exactly one per request (unique `approvalRequestId`): decision, approver user id and role, hashed session reference, method, scope digest, optional reason code.
