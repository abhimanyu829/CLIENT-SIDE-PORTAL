/**
 * lib/agent-gateway/shared/crypto.ts
 *
 * Cryptographic primitives for the gateway. Reuses Node's `crypto` module
 * directly (the same primitive the existing app already relies on via
 * lib/encryption.ts) rather than inventing a new dependency.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto"

/** Collision-resistant request ID. Never derived from client input. */
export function generateRequestId(): string {
  return `req_${randomBytes(16).toString("hex")}`
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex")
}

export function hmacSha256Hex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex")
}

/**
 * Constant-time string comparison. MUST be used for any secret/signature
 * comparison — never `===`. Returns false (not throw) on length mismatch
 * or malformed hex, since callers should treat "can't compare" the same
 * as "doesn't match".
 */
export function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8")
    const bufB = Buffer.from(b, "utf8")
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

/** Masks a credential for logging — never log raw tokens/secrets. */
export function maskCredential(value: string): string {
  if (value.length <= 8) return "***"
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

// ── Phase 2: credential generation / fingerprinting ─────────────────────────

/** Generates a new, cryptographically secure bearer token. Never logged. */
export function generateBearerToken(): string {
  return `agw_${randomBytes(32).toString("hex")}`
}

/** Generates a new HMAC signing secret for a SIGNED_REQUEST credential. */
export function generateSigningSecret(): string {
  return randomBytes(32).toString("hex")
}

/** Generates a public key id (safe to store/display) for a signed credential. */
export function generateKeyId(): string {
  return `key_${randomBytes(12).toString("hex")}`
}

/**
 * One-way hash used ONLY to look up a presented secret — never reversible,
 * never itself usable as a credential. This is the SAME hash used for
 * lookup, applied identically at issuance and at verification time, so
 * comparison at verification is a simple equality check on hashes (the
 * secret itself is never retained for direct comparison).
 */
export function hashSecret(secret: string): string {
  return sha256Hex(secret)
}

/**
 * Non-secret identification fingerprint for display/logging. Deterministic
 * from the secret (so re-deriving it later — e.g. to display "which
 * credential is this" — is possible) but NEVER usable to authenticate:
 * it is a truncated hash of a hash, one further derivation removed from
 * the lookup hash itself, specifically so it cannot be used interchangeably
 * with secretHash for authentication even if someone tried.
 */
export function fingerprintSecret(secret: string): string {
  return sha256Hex(`fingerprint:${sha256Hex(secret)}`).slice(0, 16)
}
