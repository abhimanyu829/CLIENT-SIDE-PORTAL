/**
 * lib/agent-gateway/auth/replay-protection.ts
 *
 * Nonce-based replay protection for signed requests, per Phase 1 spec §14.
 * Reuses the EXISTING Redis infrastructure (lib/redis.ts) rather than
 * creating a separate database solely for nonce tracking.
 *
 * Key shape: agent-gateway:nonce:<keyId>:<nonce>  (per spec's suggested convention)
 * TTL: AGENT_GATEWAY_NONCE_TTL_SECONDS (config), independently configurable
 * from the signature's own clock-skew tolerance.
 *
 * A duplicate nonce is REPLAY_DETECTED. A Redis outage fails CLOSED for
 * this check specifically — see checkAndConsumeNonce's `redisUnavailable`
 * branch — because replay protection on signed high-trust requests is a
 * security control, not a convenience feature (spec §16: fail-closed for
 * sensitive authenticated mutation traffic when a rate-limit dependency is
 * unavailable applies equally here).
 */
import { redis } from "@/lib/redis"
import { getGatewayConfig } from "../config"

export type NonceCheckResult =
  | { ok: true }
  | { ok: false; reason: "REPLAY_DETECTED" }
  | { ok: false; reason: "REDIS_UNAVAILABLE" }

function nonceKey(keyId: string, nonce: string): string {
  return `agent-gateway:nonce:${keyId}:${nonce}`
}

/**
 * Atomically checks-and-marks a nonce as used. Uses SET ... NX so the
 * check-then-set is a single atomic Redis operation (no race window
 * between two concurrent requests with the same captured nonce).
 */
export async function checkAndConsumeNonce(keyId: string, nonce: string): Promise<NonceCheckResult> {
  if (!redis) {
    return { ok: false, reason: "REDIS_UNAVAILABLE" }
  }

  const ttl = getGatewayConfig().AGENT_GATEWAY_NONCE_TTL_SECONDS
  const key = nonceKey(keyId, nonce)

  try {
    // "nx" + "ex" performed as one atomic SET NX EX — Upstash Redis client option shape.
    const result = await redis.set(key, "1", { nx: true, ex: ttl })
    if (result === null) {
      // Key already existed — this exact nonce was already consumed.
      return { ok: false, reason: "REPLAY_DETECTED" }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: "REDIS_UNAVAILABLE" }
  }
}
