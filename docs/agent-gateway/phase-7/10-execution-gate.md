# Phase 7 — Execution Gate

`ExecutionGate` (`execution-gate/gate.ts`) implements Phase 5's `CapabilityAuthorizer`. It is the last check before a Phase 4 adapter and re-evaluates everything from live state on every call. Nothing is cached.

## Steps

1. Identity: `connectionId`, `ownerId` present and `connectionStatus === "ACTIVE"`, else `IDENTITY_INVALID`.
2. Phase 6: `PolicyEngineAuthorizer.decide()` (added in Phase 7; `authorize()` now delegates to it with identical behavior).
3. Autonomy policy: fresh read. A thrown read is `POLICY_UNAVAILABLE`, never "no policy".
4. `resolveAutonomyDecision()`.
5. ALLOW -> return. DENY -> throw. POLICY_UNAVAILABLE -> throw.
6. REQUIRE_APPROVAL:
   - compute input digest and binding digest
   - live APPROVED for this binding: expired -> `APPROVAL_EXPIRED`; else atomic consume -> return, or the precise consume failure code
   - recent REJECTED for this binding -> `APPROVAL_REJECTED`
   - sibling (same connection, capability, resource; different binding): same input -> cancel it (`POLICY_CHANGED`) and, if it was APPROVED, report `APPROVAL_POLICY_CHANGED`; different input and APPROVED -> `APPROVAL_BINDING_MISMATCH`
   - find-or-create PENDING request -> `APPROVAL_REQUIRED` with reference, surface path and expiry

## Fail closed

`authorize()` wraps the whole evaluation. Any exception that is not already a denial (context building, canonicalization, storage, Phase 6 throwing) becomes `POLICY_UNAVAILABLE`. There is no path from an error to execution.

## Denial transport

`ExecutionGateDeniedError extends AuthorizationDeniedError(message, code)`. Phase 5's `server.ts` returns `errorResult(err.code, err.message)`, so the agent sees `CODE: message` as an `isError` tool result. Messages never include digests, internal ids, policy ids, DB errors or stack traces (tested).

## Observability

`recordGateEvent` logs through the existing Phase 1 pino `gatewayLogger` (`agent_gateway_execution_gate`): request, connection, capability, risk, level, outcome, reason code, approval ref and state, duration. No tokens, codes, inputs or digests.

## Connection lifecycle

- Suspend / revoke routes call `cancelApprovalsForConnection` (best-effort; a suspended or revoked connection cannot execute anyway because step 1 refuses it).
- Reactivate cancels all live approvals before reactivating (mandatory; a failure leaves the connection suspended), so an approval granted before a suspension never survives into the new lifecycle.
