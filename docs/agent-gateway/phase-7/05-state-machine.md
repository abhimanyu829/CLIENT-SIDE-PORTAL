# Phase 7 — Approval State Machine

```
PENDING  -> APPROVED | REJECTED | EXPIRED | CANCELLED
APPROVED -> CONSUMED | EXPIRED | CANCELLED
CONSUMED, REJECTED, EXPIRED, CANCELLED are terminal
```

The table lives in `approvals/state-machine.ts`. Every transition in the services is also a conditional `updateMany` whose `WHERE` includes the source status, so the check and the change are one statement and two writers can never both leave the same state.

| Transition | Where | Extra WHERE conditions |
|---|---|---|
| PENDING -> APPROVED | `decideApproval` (transaction) | `expiresAt > now`, binding digest, exact step-up hash just verified |
| PENDING -> REJECTED | `decideApproval` (transaction) | `expiresAt > now`, binding digest |
| APPROVED -> CONSUMED | `consumeApproval` | binding digest, `expiresAt > now` |
| live -> EXPIRED | `expireApproval` | status in (PENDING, APPROVED) |
| live -> CANCELLED | `cancelApproval`, `cancelApprovalByHuman`, `cancelApprovalsForConnection` | status in (PENDING, APPROVED) |

Every terminal transition clears `activeBindingKey` and the step-up hash. A PENDING request cannot jump to CONSUMED; a terminal request cannot be revived.

Expiry is applied lazily: the next gate call, decision, or view that touches an expired live row moves it to EXPIRED. Expired rows can never be approved or consumed regardless, because every write path checks `expiresAt > now`.
