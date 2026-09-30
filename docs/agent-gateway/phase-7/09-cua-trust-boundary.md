# Phase 7 — Cua Trust Boundary

| Fact | Authority | Can it approve? |
|---|---|---|
| A window is open, a page shows a reference, a button is visible | Cua (desktop) | No |
| An approval request exists, who decided it, whether it is APPROVED, bound, unexpired and unconsumed | Abhibhi backend (Postgres) | Yes, via the human decision service only |
| Whether the underlying business operation succeeded | Existing services via Phase 4 adapters | n/a |

These facts are kept separate. A Cua observation is advisory and has no code path into approval state.

## Anti-bypass

The agent that requests an approval must not be able to grant it, even with desktop control.

| Attack | Defense |
|---|---|
| Agent calls an approval endpoint with its gateway credential | Human routes refuse any `Authorization: Bearer agw_…` or `x-abhibhi-*` signature header before auth (`human-session.ts`) |
| Agent calls an MCP tool to approve or raise autonomy | No such tool or capability exists; structural test asserts no agent-reachable module imports the decision service or writes autonomy policy |
| Agent drives a signed-in admin browser via Cua and clicks Approve | Approve needs a 6-digit SMS code sent to the approver's phone, outside the desktop |
| Agent reads and types an on-screen challenge | The code is never displayed on the desktop by Abhibhi |
| Agent approves A, then executes B | Binding digest mismatch |
| Agent reuses one approval | Atomic single-use consumption |
| Agent races many retries | Conditional `updateMany` — exactly one consumer succeeds |
| Agent submits its own approver id | Strict schema rejects it; approver identity is taken from the session only |

## Residual risk

If the approver's phone itself is compromised or its SMS is mirrored onto the controlled desktop (e.g. a phone-link app showing messages), the out-of-band property weakens. Approvers should not mirror SMS to a machine an agent controls. A hardware key / passkey step-up would remove this dependency and is a reasonable later upgrade.
