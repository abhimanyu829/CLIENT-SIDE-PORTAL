/**
 * lib/agent-gateway/auth/signed-request-authenticator.ts
 *
 * Implements GatewayAuthenticator for the signed-request scheme. Composes
 * signature verification (signature-verifier.ts) with nonce-based replay
 * protection (replay-protection.ts) — both must pass.
 *
 * Order matters: signature validity is checked BEFORE the nonce is
 * consumed, so an attacker without a valid signature can never burn a
 * legitimate nonce (which would otherwise be a denial-of-service vector
 * against the real caller).
 */
import type { AuthenticationResult, GatewayAuthenticator } from "../shared/types"
import { HmacSignatureVerifier, parseSignatureHeaders } from "./signature-verifier"
import { checkAndConsumeNonce } from "./replay-protection"
import { getCredentialStore } from "./credential-store-provider"

export class SignedRequestAuthenticator implements GatewayAuthenticator {
  private readonly verifier = new HmacSignatureVerifier()

  async authenticate(request: Request): Promise<AuthenticationResult> {
    const headers = parseSignatureHeaders(request)
    if (!headers) {
      return { authenticated: false, failureCode: "AUTH_REQUIRED" }
    }

    // Body is consumed once by the caller and passed in via a cloned request
    // upstream (see transport/http-boundary.ts) — this authenticator re-reads
    // from a request whose body has already been buffered for signing.
    const rawBody = await request.clone().text()

    const sigResult = await this.verifier.verify(request, rawBody)
    if (!sigResult.valid) {
      return {
        authenticated: false,
        failureCode: sigResult.failureCode === "SIGNATURE_EXPIRED" ? "AUTH_EXPIRED" : "AUTH_INVALID",
      }
    }

    const nonceResult = await checkAndConsumeNonce(headers.keyId, headers.nonce)
    if (!nonceResult.ok) {
      // Both REPLAY_DETECTED and REDIS_UNAVAILABLE deny — fail closed either way.
      return { authenticated: false, failureCode: "AUTH_INVALID" }
    }

    const keyRecord = await getCredentialStore().resolveSigningKey(headers.keyId)
    if (!keyRecord || keyRecord.record.status !== "ACTIVE") {
      return { authenticated: false, failureCode: "CONNECTION_INACTIVE" }
    }

    return {
      authenticated: true,
      connectionId: keyRecord.record.connectionId,
      agentId: keyRecord.record.agentId,
      ownerId: keyRecord.record.ownerId,
      teamId: keyRecord.record.teamId,
      credentialId: keyRecord.record.credentialId,
      connectionStatus: keyRecord.record.connectionStatus,
      authMethod: "SIGNED_REQUEST",
      tokenId: headers.keyId,
      scopes: keyRecord.record.scopes,
    }
  }
}
