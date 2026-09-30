/**
 * lib/agent-gateway/auth/composite-authenticator.ts
 *
 * Selects between authentication methods without hard-coding the gateway
 * around one credential mechanism (Phase 1 spec §11). Signed-request auth
 * is only attempted if AGENT_GATEWAY_SIGNING_ENABLED and the signature
 * headers are present; otherwise Bearer is attempted. Exactly one method
 * runs per request — never both, and never a silent fallback from a
 * failed signature check to bearer (that would let an attacker downgrade
 * a high-trust integration to a weaker scheme).
 */
import type { AuthenticationResult, GatewayAuthenticator } from "../shared/types"
import { BearerTokenAuthenticator } from "./bearer-authenticator"
import { SignedRequestAuthenticator } from "./signed-request-authenticator"
import { SIGNATURE_HEADERS } from "./signature-verifier"
import { getGatewayConfig } from "../config"

export class CompositeAuthenticator implements GatewayAuthenticator {
  private readonly bearer = new BearerTokenAuthenticator()
  private readonly signed = new SignedRequestAuthenticator()

  async authenticate(request: Request): Promise<AuthenticationResult> {
    const signingEnabled = getGatewayConfig().AGENT_GATEWAY_SIGNING_ENABLED
    const hasSignatureHeaders = request.headers.has(SIGNATURE_HEADERS.signature)

    if (signingEnabled && hasSignatureHeaders) {
      return this.signed.authenticate(request)
    }
    return this.bearer.authenticate(request)
  }
}
