/**
 * lib/agent-gateway/auth/signature-verifier.ts
 *
 * HMAC-SHA256 request-signature verification for high-trust integrations,
 * per Phase 1 spec §13.
 *
 * Headers:
 *   X-Abhibhi-Timestamp   ISO-8601 or unix-seconds timestamp
 *   X-Abhibhi-Nonce       single-use, per-request random string
 *   X-Abhibhi-Key-Id      identifies which signing secret was used
 *   X-Abhibhi-Signature   hex HMAC-SHA256 of the canonical message
 *
 * Canonical message, version "abhibhi.request.v2" (newline-joined, in this
 * exact order):
 *   abhibhi.request.v2
 *   timestamp (the header value exactly as sent)
 *   nonce     (the header value exactly as sent)
 *   HTTP method (upper-cased)
 *   path (pathname only, no query string, no host)
 *   SHA256(body) hex
 *
 * The nonce is signed so it cannot be swapped on a captured request: v1
 * (timestamp, method, path, body hash) left it out, so anyone holding a
 * captured request could replay it inside the clock-skew window with a
 * fresh nonce. There is deliberately no v1 fallback — accepting v1 would
 * let an attacker downgrade to it. The version line also keeps these
 * messages distinct from the Phase 9 webhook messages ("abhibhi.webhook.v1").
 * No field can contain a newline (header values cannot, the nonce rejects
 * whitespace, the path is percent-encoded, the hash is hex), so the joined
 * message is unambiguous.
 *
 * Verification order (ALL must pass):
 *   1. key exists (resolveSigningKey)
 *   2. timestamp within allowed clock skew
 *   3. nonce is unused (delegated to replay-protection.ts by the caller —
 *      this module only validates the signature itself; nonce state is a
 *      separate concern with its own module and its own tests. The caller,
 *      signed-request-authenticator.ts, consumes the nonce only AFTER this
 *      signature check passes, so a forged request never burns a nonce)
 *   4. signature matches (constant-time compare)
 *   5. connection/key is active (record.status)
 */
import type { GatewaySignatureVerifier, SignatureVerificationResult } from "../shared/types"
import { constantTimeEqual, hmacSha256Hex, sha256Hex } from "../shared/crypto"
import { getCredentialStore } from "./credential-store-provider"
import { getGatewayConfig } from "../config"

export const SIGNATURE_HEADERS = {
  timestamp: "x-abhibhi-timestamp",
  nonce: "x-abhibhi-nonce",
  keyId: "x-abhibhi-key-id",
  signature: "x-abhibhi-signature",
} as const

export interface ParsedSignatureHeaders {
  timestamp: string
  nonce: string
  keyId: string
  signature: string
}

/** Extracts and shape-validates the four signature headers. Null if any are missing/malformed. */
export function parseSignatureHeaders(request: Request): ParsedSignatureHeaders | null {
  const timestamp = request.headers.get(SIGNATURE_HEADERS.timestamp)
  const nonce = request.headers.get(SIGNATURE_HEADERS.nonce)
  const keyId = request.headers.get(SIGNATURE_HEADERS.keyId)
  const signature = request.headers.get(SIGNATURE_HEADERS.signature)

  if (!timestamp || !nonce || !keyId || !signature) return null
  if (nonce.length < 8 || nonce.length > 128 || /\s/.test(nonce)) return null
  if (!/^[0-9a-f]{64}$/i.test(signature)) return null
  if (keyId.length < 1 || keyId.length > 128) return null

  return { timestamp, nonce, keyId, signature }
}

function parseTimestampToEpochSeconds(timestamp: string): number | null {
  // Accept either unix-seconds or ISO-8601.
  if (/^\d+$/.test(timestamp)) {
    const n = Number(timestamp)
    return Number.isFinite(n) ? n : null
  }
  const ms = Date.parse(timestamp)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

/** First line of every signed-request canonical message. */
export const REQUEST_SIGNATURE_VERSION = "abhibhi.request.v2"

/** Everything a signed request's HMAC covers. */
export interface SignedRequestParts {
  timestamp: string
  nonce: string
  method: string
  /** URL pathname only: no host, no query string. */
  path: string
  /** Hex SHA-256 of the raw request body. */
  bodyHash: string
}

/** The exact string a client signs (HMAC-SHA256 with its signing secret, hex). */
export function canonicalMessage(parts: SignedRequestParts): string {
  return [REQUEST_SIGNATURE_VERSION, parts.timestamp, parts.nonce, parts.method.toUpperCase(), parts.path, parts.bodyHash].join("\n")
}

export class HmacSignatureVerifier implements GatewaySignatureVerifier {
  async verify(request: Request, rawBody: string): Promise<SignatureVerificationResult> {
    const headers = parseSignatureHeaders(request)
    if (!headers) return { valid: false, failureCode: "SIGNATURE_INVALID" }

    const epochSeconds = parseTimestampToEpochSeconds(headers.timestamp)
    if (epochSeconds === null) return { valid: false, failureCode: "SIGNATURE_INVALID" }

    const skew = getGatewayConfig().AGENT_GATEWAY_MAX_CLOCK_SKEW_SECONDS
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSeconds - epochSeconds) > skew) {
      return { valid: false, failureCode: "SIGNATURE_EXPIRED" }
    }

    const keyRecord = await getCredentialStore().resolveSigningKey(headers.keyId)
    if (!keyRecord || keyRecord.record.status !== "ACTIVE") {
      return { valid: false, failureCode: "SIGNATURE_INVALID" }
    }

    const url = new URL(request.url)
    const bodyHash = sha256Hex(rawBody)
    const expected = hmacSha256Hex(
      keyRecord.secret,
      canonicalMessage({
        timestamp: headers.timestamp,
        nonce: headers.nonce,
        method: request.method,
        path: url.pathname,
        bodyHash,
      })
    )

    if (!constantTimeEqual(expected, headers.signature)) {
      return { valid: false, failureCode: "SIGNATURE_INVALID" }
    }

    return { valid: true }
  }
}
