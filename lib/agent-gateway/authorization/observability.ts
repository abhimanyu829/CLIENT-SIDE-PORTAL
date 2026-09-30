/**
 * lib/agent-gateway/authorization/observability.ts
 *
 * Authorization-layer observability, reusing the EXISTING Phase 1 pino
 * logger (same `gatewayLogger` Phase 5's mcp/observability.ts already
 * uses) — no new logging library, no new sink.
 *
 * Only safe metadata is ever logged: requestId, connectionId,
 * capabilityId, resourceType, a resourceId (already just an id string,
 * never a full record), policyId, policyVersion, decision, reasonCode,
 * evaluationDurationMs. NEVER: tokens, credentials, secrets, full
 * request/response payloads, other tenants' data, policy condition
 * bodies (which could indirectly describe internal business rules).
 */
import { gatewayLogger } from "../observability/request-log"
import type { AuthorizationDecision } from "./types"

export interface AuthorizationEventFields {
  requestId: string
  connectionId: string
  capabilityId: string
  resourceType?: string
  resourceId?: string
  decision: AuthorizationDecision
}

export function recordAuthorizationEvent(fields: AuthorizationEventFields): void {
  const logFields = {
    requestId: fields.requestId,
    connectionId: fields.connectionId,
    capabilityId: fields.capabilityId,
    resourceType: fields.resourceType,
    resourceId: fields.resourceId,
    policyId: fields.decision.matchedPolicyId,
    policyVersion: fields.decision.matchedPolicyVersion,
    decision: fields.decision.decision,
    reasonCode: fields.decision.reasonCode,
    evaluationDurationMs: fields.decision.evaluationDurationMs,
  }
  if (fields.decision.decision === "ALLOW") {
    gatewayLogger.info(logFields, "authorization_decision")
  } else {
    gatewayLogger.warn(logFields, "authorization_decision")
  }
}
