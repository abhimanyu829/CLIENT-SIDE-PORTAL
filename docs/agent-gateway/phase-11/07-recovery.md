# Phase 11 — 07 Recovery execution

`recovery/service.ts` (`RecoveryService.requestRecovery`), state in `AgentRecovery` (`recovery/store.ts`), surfaced at `/admin/agent-governance/recoveries` and `POST /api/admin/agent-governance/recoveries` (`{ eventId, reason }`, reason mandatory).

## Who

A SUPER_ADMIN with a live session (`requireGovernanceOperator`: sub-admins refused whatever their permissions; agent bearer / signed-request headers refused with 401 even alongside a session; non-JSON 415). There is no agent-callable path: no MCP tool, gateway route or capability (tested).

## Flow

1. **Source** — must be an `execution.succeeded` event of a non-READ capability, with connection, owner and capability version recorded (`VALIDATION_FAILED` otherwise; unknown id `NOT_FOUND`).
2. **Evidence integrity** — the event's digest, its back-link and its successor's link are re-checked (`02`). A failure is refused (`INVALID_STATE`), creates no recovery, runs nothing, and appends `security.input_rejected` (`EVIDENCE_INTEGRITY`).
3. **Classification** — `resolveRecoverySpec` of the exact capability version that ran (a version no longer registered → manual).
4. **One row per execution** — `AgentRecovery.sourceEventId` is unique; IRREVERSIBLE / manual specs are terminal `MANUAL_RECOVERY_REQUIRED` immediately.
5. **Claim** — one conditional update (`status ∈ {REQUESTED, FAILED, APPROVAL_REQUIRED}` and `version`) moves it to `EXECUTING`; concurrent or duplicate requests lose the claim and return the current state.
6. **Recorded identifiers** — the recovery input comes only from `recoveryInput` in the verified event; missing → manual.
7. **Original identity, live** — the connection that performed the operation must still be `ACTIVE`, same owner, same environment as this gateway and as recorded; otherwise manual (`CONNECTION_NOT_ACTIVE`). The recovery acts **as that connection** — no new privileged recovery identity exists.
8. **Recovery capability** — exactly the declared id + version, `ACTIVE`, `AGENT_AVAILABLE`, with an adapter; otherwise manual (`RECOVERY_CAPABILITY_UNAVAILABLE`).
9. **Same chain as any agent operation** — `ExecutionGate.grant` (identity, Phase 6 authorization, Phase 7 autonomy and human approval), then the Phase 4 resolver (schema, environment, idempotency, circuit breakers, strict audit intent). Deterministic idempotency key `recovery.<rcv_ref>` when the capability requires one.
10. **Outcome** — `SUCCEEDED`, `FAILED` (stable code; retryable), `APPROVAL_REQUIRED` (approval ref; retry after a human approves — the retry consumes it once), or `MANUAL_RECOVERY_REQUIRED`. Each transition is a ledger event (ROLLBACK category) and `agent_rollback_total{outcome, recovery_class}`.

## Guarantees (tested, `p11-recovery.test.ts`)

| Property | Evidence |
|---|---|
| Reversible restores the recorded previous state | price 150 → 100 |
| Compensation targets exactly the recorded resource | archives `thing_1`, idempotency key `recovery.<ref>` |
| Irreversible fakes nothing | no dispatch; recommendation recorded |
| Never bypasses authorization / autonomy / approval | DENY → FAILED, OBSERVE_ONLY → AUTONOMY_DENIED, approval → wait, then one consumption, policy store down → POLICY_UNAVAILABLE; adapter never ran |
| Exactly once | 8 concurrent requests → 1 row, 1 dispatch; a completed recovery never re-runs; failed → retry → success = 2 dispatches total |
| Tampered evidence refused | edited, re-digested and forged events refused; decoy resource untouched |
| Inactive / moved connection → manual | suspended, environment changed |
| Recovery capability unavailable → manual | disabled |

The governance action is additionally recorded in `AuditLog` (`AGENT_RECOVERY_REQUESTED`, with the reason).
