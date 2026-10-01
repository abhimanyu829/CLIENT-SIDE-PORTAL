/**
 * lib/agent-gateway/identity/request-identity.ts
 *
 * Builds the normalized AgentGatewayRequestContext from an
 * AuthenticationResult plus request-level metadata. This is the ONLY
 * place a request context is constructed — every field traces back to
 * either a verified credential (identity fields) or trusted server-side
 * derivation (requestId, receivedAt, clientIp). Never populated from
 * client-supplied identity headers (Phase 1 spec §15/§32).
 */
import type { AgentGatewayRequestContext, AgentMachineIdentity, AuthenticationResult } from "../shared/types"
import { generateRequestId } from "../shared/crypto"
import { resolveClientIp } from "../security/headers"

export function buildRequestContext(
  request: Request,
  authResult: AuthenticationResult,
  signal: AbortSignal,
  /**
   * Phase 11: the entry point's own (server-generated) request id, so one
   * request has ONE id end to end. Omitted = a fresh id, as before.
   */
  requestId?: string
): AgentGatewayRequestContext {
  // Phase 2: only construct the full `machine` identity when the
  // authenticator resolved a credentialId/connectionStatus (i.e. it went
  // through the DB-backed identity resolution path, not a bare
  // CredentialRecord-only result). Never fabricated for partial results.
  const machine: AgentMachineIdentity | undefined =
    authResult.authenticated && authResult.connectionId && authResult.credentialId && authResult.connectionStatus
      ? {
          agentId: authResult.agentId,
          connectionId: authResult.connectionId,
          credentialId: authResult.credentialId,
          ownerId: authResult.ownerId ?? "",
          teamId: authResult.teamId,
          externalAgentId: authResult.agentId,
          connectionStatus: authResult.connectionStatus,
          authenticatedAt: new Date(),
        }
      : undefined

  return {
    requestId: requestId && /^req_[0-9a-f]{32}$/.test(requestId) ? requestId : generateRequestId(),
    receivedAt: new Date(),
    authenticated: authResult.authenticated,
    machine,
    connectionId: authResult.connectionId,
    agentId: authResult.agentId,
    ownerId: authResult.ownerId,
    teamId: authResult.teamId,
    authMethod: authResult.authMethod,
    tokenId: authResult.tokenId,
    clientIp: resolveClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    protocol: "HTTP",
    policyVersion: undefined, // Reserved for Phase 3+ (AgentPolicy) — never fabricated here.
    signal,
  }
}

/**
 * Derives the rate-limit key for a request context per Phase 1 spec §16:
 * connectionId once known, otherwise the caller must have already denied
 * the request (unauthenticated traffic never reaches business routing in
 * this gateway — see transport/http-boundary.ts's pipeline order).
 */
export function rateLimitKeyFor(context: AgentGatewayRequestContext): string {
  return context.connectionId ? `conn:${context.connectionId}` : `ip:${context.clientIp ?? "unknown"}`
}
