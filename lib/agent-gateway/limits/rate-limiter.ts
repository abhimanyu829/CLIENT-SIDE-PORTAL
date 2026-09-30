/**
 * lib/agent-gateway/limits/rate-limiter.ts
 *
 * Rate limiting keyed by connectionId once identity is known (post-auth),
 * falling back to IP only BEFORE authentication (per Phase 1 spec §16).
 * Uses the existing Upstash Redis client (lib/redis.ts) and the existing
 * @upstash/ratelimit package already used by proxy.ts — no new
 * dependency, no duplicate Redis client.
 *
 * Two independent windows (per-minute, per-hour) are checked; either one
 * tripping denies the request. Fails CLOSED for authenticated traffic
 * when Redis is unavailable (spec §16) — an attacker should never be able
 * to induce a Redis outage to bypass rate limiting on the gateway.
 */
import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "@/lib/redis"
import type { GatewayRateLimiter, RateLimitResult } from "../shared/types"
import { getGatewayConfig } from "../config"

function buildLimiters() {
  const cfg = getGatewayConfig()
  if (!redis) return null
  return {
    perMinute: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE, "60 s"),
      analytics: true,
      prefix: "rl:agent-gateway:minute",
    }),
    perHour: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.AGENT_GATEWAY_RATE_LIMIT_PER_HOUR, "60 m"),
      analytics: true,
      prefix: "rl:agent-gateway:hour",
    }),
  }
}

let limiters: ReturnType<typeof buildLimiters> | null | undefined

function getLimiters() {
  if (limiters === undefined) limiters = buildLimiters()
  return limiters
}

export class GatewayRedisRateLimiter implements GatewayRateLimiter {
  async check(key: string): Promise<RateLimitResult> {
    const active = getLimiters()

    if (!active) {
      // Redis unavailable/unconfigured: fail closed for gateway traffic.
      // (The gateway is opt-in and security-sensitive by definition — unlike
      // the main app's proxy.ts, which fails open when Redis is absent for
      // general dev-friendliness, the gateway must not silently disable its
      // own rate limiting.)
      return { allowed: false, limit: 0, remaining: 0, resetAt: new Date() }
    }

    const [minute, hour] = await Promise.all([active.perMinute.limit(key), active.perHour.limit(key)])

    if (!minute.success) {
      return { allowed: false, limit: minute.limit, remaining: minute.remaining, resetAt: new Date(minute.reset) }
    }
    if (!hour.success) {
      return { allowed: false, limit: hour.limit, remaining: hour.remaining, resetAt: new Date(hour.reset) }
    }

    return { allowed: true, limit: minute.limit, remaining: minute.remaining, resetAt: new Date(minute.reset) }
  }
}

/** Test-only: force the cached limiter set to rebuild on next check(). */
export function __resetRateLimitersForTests(): void {
  limiters = undefined
}
