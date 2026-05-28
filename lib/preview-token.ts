import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"

const PREVIEW_SECRET = process.env.PREVIEW_TOKEN_SECRET ?? randomBytes(32).toString("hex")

if (process.env.NODE_ENV === "production" && !process.env.PREVIEW_TOKEN_SECRET) {
  console.warn("⚠️  PREVIEW_TOKEN_SECRET not set in production — preview tokens are insecure")
}

export interface PreviewTokenPayload {
  sessionId: string
  userId: string
  productId: string
  expiresAt: number // Unix timestamp ms
}

/**
 * Issues a signed preview token (base64url-encoded JSON + HMAC signature).
 * Token format: base64url(payload).base64url(signature)
 */
export function issueSignedPreviewToken(
  sessionId: string,
  userId: string,
  productId: string,
  expiresAt: Date
): string {
  const payload: PreviewTokenPayload = {
    sessionId,
    userId,
    productId,
    expiresAt: expiresAt.getTime(),
  }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", PREVIEW_SECRET).update(payloadStr).digest("base64url")
  return `${payloadStr}.${sig}`
}

/**
 * Validates a signed preview token.
 * Throws a descriptive error if invalid, expired, or revoked.
 */
export async function validateSignedPreviewToken(token: string): Promise<PreviewTokenPayload> {
  const parts = token.split(".")
  if (parts.length !== 2) throw new Error("INVALID_TOKEN")

  const [payloadStr, sig] = parts
  const expectedSig = createHmac("sha256", PREVIEW_SECRET).update(payloadStr).digest("base64url")

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(sig, "base64url")
  const expectedBuf = Buffer.from(expectedSig, "base64url")
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error("INVALID_TOKEN")
  }

  let payload: PreviewTokenPayload
  try {
    payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"))
  } catch {
    throw new Error("INVALID_TOKEN")
  }

  if (!payload.sessionId || !payload.userId || !payload.productId || !payload.expiresAt) {
    throw new Error("INVALID_TOKEN")
  }

  if (Date.now() > payload.expiresAt) {
    throw new Error("EXPIRED")
  }

  // Check Redis revocation blacklist
  if (redis) {
    try {
      const revoked = await redis.get(`preview:revoked:${payload.sessionId}`)
      if (revoked) throw new Error("REVOKED")
    } catch (err) {
      if ((err as Error).message === "REVOKED") throw err
      logger.warn({ err }, "preview-token: Redis check failed, proceeding without blacklist check")
    }
  }

  return payload
}

/**
 * Revokes a preview token by blacklisting the sessionId in Redis.
 * Also sets isRevoked=true in DB (DB update should be done by the caller).
 */
export async function revokePreviewToken(
  sessionId: string,
  expiresAt: Date,
  reason?: string
): Promise<void> {
  if (!redis) {
    logger.warn({ sessionId }, "preview-token: Redis not available, cannot blacklist token")
    return
  }
  const ttlSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
  try {
    await redis.set(`preview:revoked:${sessionId}`, reason ?? "revoked", { ex: ttlSeconds })
    logger.info({ sessionId, ttlSeconds }, "Preview token revoked")
  } catch (err) {
    logger.error({ err, sessionId }, "preview-token: Failed to blacklist token in Redis")
  }
}
