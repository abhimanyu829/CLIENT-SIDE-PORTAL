# Phase 8 — Task Security

## Server-derived security context

The agent supplies only `capabilityId`, `input` and an optional `idempotencyKey` (strict schema; any other field is rejected by the MCP layer). Connection, agent, owner, team, environment, capability version, adapter, resource, retry class, deadline, authorization policy reference, autonomy version and approval are derived on the server from the verified identity and the gate's decision. The submit tool accepts bare capability ids only (no `@vN` pinning).

## Same chain as a synchronous call

Submission runs Phase 3 resolution + validation and the Phase 7 `ExecutionGate` (Phase 6 + autonomy + atomic approval consumption) before any task exists. A denial creates nothing.

## Worker-time re-verification (`guard.ts`)

Before every attempt, from live state:

| Check | Failure |
|---|---|
| deadline | EXPIRED `TASK_EXPIRED` |
| connection status / expiry / owner (uncached DB read) | EXPIRED `AUTHORIZATION_REVOKED` |
| task, connection and worker environments agree | EXPIRED `TASK_EXPIRED` |
| exact capability version still ACTIVE, agent-available, async-capable, same adapter | EXPIRED `CAPABILITY_DISABLED` |
| stored input still matches its digest | FAILED `EXECUTION_FAILED` + security event |
| Phase 6 + autonomy, live (gate, evaluation only) | EXPIRED `AUTHORIZATION_REVOKED` (detail = the gate's code) |
| approval now required but none bound | EXPIRED `AUTHORIZATION_REVOKED` |
| bound approval CONSUMED, unexpired, binding matches the stored task | EXPIRED `APPROVAL_EXPIRED` / FAILED (tamper) |
| bound approval's binding matches the CURRENT policy versions | EXPIRED `APPROVAL_EXPIRED / APPROVAL_POLICY_CHANGED` |
| policy / approval store unavailable | transient pre-dispatch failure (retried per class) |

## Approval binding

The consumed approval's id is stored on the task (unique: one approval, one task); the deadline is capped at the approval's expiry; the worker recomputes the Phase 7 binding digest from the stored task and compares it with the approval's. An approved task can only ever execute the exact approved operation.

## Tampering and substitution

- Job payload fields (capability, version, adapter, environment, key) that disagree with the row -> FAILED, security event, never dispatched.
- Unknown task id, extra payload fields, wrong attempt number -> ignored.
- Stored input edited -> FAILED `INPUT_INTEGRITY`.

## Ownership

Status and cancel look the task up by reference and require the caller's connection AND owner. Unknown, malformed and foreign references get the identical `TASK_NOT_FOUND: Task not found.` A stored result is returned only while the caller is still authorized for that operation (re-evaluated on read); otherwise `resultUnavailable: AUTHORIZATION_REVOKED`.

## Data handling

The view never includes the input, digests, internal ids, idempotency scope or approval id. Job payloads carry references only. Task events never include input or results. Error messages are generic; no SQL, stack traces, paths or secrets.

## No new primitives

No SQL/Prisma/HTTP/shell/filesystem/function execution. The worker executes only through the Phase 4 resolver; the agent cannot choose an adapter.
