/**
 * lib/agent-gateway/authorization/context-builder.ts
 *
 * Builds an `AuthorizationContext` from Phase 4's already-trusted
 * `AgentExecutionContext` plus the Phase 3 `CapabilityDefinition` being
 * invoked. This is the ONLY place an `AuthorizationContext` is
 * constructed — mirrors Phase 4's own
 * `execution/resolver/build-execution-context.ts` convention of a single,
 * explicit "trusted context builder" function per boundary.
 *
 * `resourceId` extraction (spec: resource access must be validated
 * against trusted identity, never "productId came from client, so
 * authorize it") — this module DOES read a value out of the raw
 * tool-call `input`, but only ever uses it for POLICY MATCHING (does a
 * RESOURCE-scoped policy exist for this exact id), never as an ownership
 * proof. Phase 4's adapters remain the sole authority that verifies a
 * resource is actually owned by this caller (see
 * docs/agent-gateway/phase-6/03-resource-scope-boundary.md).
 */
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AuthorizationContext } from "./types"

/**
 * Extracts a best-effort resource identifier from raw capability input,
 * using ONLY the field name the capability itself declares via
 * `resource.resourceLocator` (Phase 3 metadata, never client-controlled
 * naming). If the capability declares no locator, or the input doesn't
 * have that field, or the field isn't a primitive, no resourceId is
 * extracted at all — this is a best-effort convenience for RESOURCE-scope
 * policy matching, never a required value.
 */
function extractResourceId(capability: CapabilityDefinition, input: unknown): string | undefined {
  const locator = capability.resource.resourceLocator
  if (!locator) return undefined
  if (typeof input !== "object" || input === null) return undefined
  const value = (input as Record<string, unknown>)[locator]
  if (typeof value === "string" || typeof value === "number") return String(value)
  return undefined
}

/**
 * `authenticationStrength` defaults to "BEARER" when not supplied. This is
 * a known, documented limitation, not an assumption dressed up as fact:
 * `AgentExecutionContext` (Phase 4's own contract, which this module must
 * not modify) does not carry the auth method used for the request, only
 * `AgentGatewayRequestContext` does (Phase 1/5). Since Phase 5's
 * `mcp/server.ts` call site (`authorizer.authorize(execContext, ...)`)
 * only ever passes the narrower `AgentExecutionContext` — and Phase 6 must
 * not modify Phase 5's tool-registration code — this module cannot derive
 * the true value without a Phase 5 change that is out of scope here. No
 * currently-registered policy uses `request.authenticationStrength` as a
 * condition attribute, so this default has no live behavioral effect
 * today; it is documented here and in
 * docs/agent-gateway/phase-6/03-resource-scope-boundary.md as a clean
 * seam for Phase 5 to close later (e.g. by having `buildExecutionContext()`
 * carry `authMethod` through, the same way it already carries every other
 * trusted field) rather than something Phase 6 papers over silently.
 */
export function buildAuthorizationContext(
  execContext: AgentExecutionContext,
  capability: CapabilityDefinition,
  input: unknown,
  authenticationStrength: "BEARER" | "SIGNED_REQUEST" = "BEARER"
): AuthorizationContext {
  return {
    requestId: execContext.requestId,
    connectionId: execContext.connectionId,
    agentId: execContext.agentId,
    ownerId: execContext.ownerId,
    teamId: execContext.teamId,
    connectionStatus: execContext.connectionStatus,

    environment: execContext.environment,

    capabilityId: capability.id,
    capabilityVersion: capability.version,
    capabilityRiskTier: capability.operationType,
    capabilityResourceType: capability.resource.resourceType,

    resourceId: extractResourceId(capability, input),

    existingPermission: capability.permission.permission,

    authenticationStrength,

    timestamp: execContext.timestamp,
  }
}
