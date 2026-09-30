/**
 * lib/agent-gateway/authorization/errors.ts
 *
 * External-facing error normalization for the authorization layer.
 * Internally, every decision carries a specific `AuthorizationReasonCode`
 * (types.ts) for logging/tracing. Externally, per the spec's "Error
 * Semantics" section, callers must never learn:
 *   - policy names
 *   - hidden capabilities
 *   - resource existence
 *   - owner existence
 *   - other tenants
 *
 * So every non-ALLOW decision collapses to the SAME external shape
 * (`AuthorizationDeniedError`, reused from Phase 5's mcp/errors.ts — this
 * module does not invent a second denial error type) with a generic,
 * capability-scoped message. The specific reason code stays internal
 * (observability.ts logs it; it is never included in the thrown error's
 * message).
 */
import { AuthorizationDeniedError } from "../mcp/errors"
import type { AuthorizationDecision } from "./types"

/**
 * Converts a non-ALLOW `AuthorizationDecision` into the throw-to-deny
 * error Phase 5's `CapabilityAuthorizer` contract expects. Never includes
 * `decision.message` verbatim in a way that could leak policy internals —
 * uses a fixed, generic, capability-scoped sentence instead.
 */
export function toAuthorizationError(capabilityId: string, decision: AuthorizationDecision): AuthorizationDeniedError {
  if (decision.decision === "REQUIRES_APPROVAL") {
    return new AuthorizationDeniedError(
      `Capability "${capabilityId}" requires an approval decision that is not yet available. Failing closed.`
    )
  }
  if (decision.decision === "POLICY_UNAVAILABLE") {
    return new AuthorizationDeniedError(
      `Capability "${capabilityId}" could not be authorized because the policy subsystem is unavailable. Failing closed.`
    )
  }
  return new AuthorizationDeniedError(`Capability "${capabilityId}" is not authorized for this connection.`)
}
