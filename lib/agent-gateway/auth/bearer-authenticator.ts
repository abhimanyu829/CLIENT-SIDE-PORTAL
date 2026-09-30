/**
 * lib/agent-gateway/auth/bearer-authenticator.ts
 *
 * Implements GatewayAuthenticator for the Bearer token scheme.
 *
 * Flow (per Phase 1 spec §12):
 *   Authorization header → format validation → hash lookup → identity
 *   resolution → authenticated context.
 *
 * Never logs the raw token. Never returns the raw token in any result.
 */
import type { AuthenticationResult, GatewayAuthenticator } from "../shared/types"
import { parseBearerAuthorizationHeader } from "./token-parser"
import { getCredentialStore } from "./credential-store-provider"
import { sha256Hex } from "../shared/crypto"

export class BearerTokenAuthenticator implements GatewayAuthenticator {
  async authenticate(request: Request): Promise<AuthenticationResult> {
    const parsed = parseBearerAuthorizationHeader(request)
    if (!parsed) {
      return { authenticated: false, failureCode: "AUTH_REQUIRED" }
    }

    const tokenHash = sha256Hex(parsed.token)
    const record = await getCredentialStore().resolveBearerTokenHash(tokenHash)

    if (!record) {
      return { authenticated: false, failureCode: "AUTH_INVALID" }
    }
    if (record.status !== "ACTIVE") {
      return { authenticated: false, failureCode: "CONNECTION_INACTIVE" }
    }

    return {
      authenticated: true,
      connectionId: record.connectionId,
      agentId: record.agentId,
      ownerId: record.ownerId,
      teamId: record.teamId,
      credentialId: record.credentialId,
      connectionStatus: record.connectionStatus,
      authMethod: "BEARER",
      tokenId: tokenHash.slice(0, 16), // opaque correlation id, not the token itself
      scopes: record.scopes,
    }
  }
}
