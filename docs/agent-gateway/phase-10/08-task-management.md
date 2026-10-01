# Phase 10 — Task Management

## Views

- `/tasks`: filters status, origin (`AGENT` / `TRIGGER`), capability, connection; newest first; pages of 20.
- `/tasks/[ref]`: status, attempts / max and retry class, error code + detail code, connection, owner, environment, adapter, resource, trigger and approval links, whether an idempotency key was given, whether a result is stored or was removed by retention, timestamps and deadline.
- **Never shown**: the task input, the result, digests, the idempotency scope or operation key. Results remain readable only by the owning agent (Phase 8), and only while it is still authorized.

## Cancel

`POST /api/admin/agent-governance/tasks/[ref]/cancel` with `{ expectedStatus, reason? }`.

1. The task must still be in `expectedStatus` (the state the administrator saw); otherwise `409 CONFLICT`.
2. The cancellation runs through the **Phase 8 engine** on behalf of the task's own connection and owner, with its honest semantics:

| State | Outcome |
|---|---|
| `QUEUED`, `STARTING`, `RETRY_QUEUED`, `FAILED` with a retry scheduled | `CANCELLED` (never dispatched / never retried) |
| `RUNNING`, cooperatively cancellable capability | `CANCELLATION_REQUESTED` |
| `RUNNING`, otherwise | `CANCELLATION_UNAVAILABLE` (the attempt finishes) |
| finished | `409 TASK_ALREADY_COMPLETED` / `TASK_CANCELLED` / `TASK_EXPIRED` / `TASK_TIMEOUT` |

3. The outcome and reason are audited (`AGENT_TASK_CANCELLED_BY_ADMIN`). The button is shown only while cancellation is possible and is always confirmed with a reason.

## Tests

`p10-governance-routes.test.ts` G (queued cancel then the worker never executes; stale status, finished task, unknown / malformed refs, invalid and forged bodies), `p10-governance-views.test.ts` G (filters, 47 tasks over 3 pages, out-of-range page, redaction), UI (button visibility), cross-phase Scenario 10.
