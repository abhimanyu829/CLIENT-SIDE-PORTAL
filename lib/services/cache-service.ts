/**
 * lib/services/cache-service.ts
 *
 * Centralized Redis cache key registry and invalidation service.
 * All cache keys are defined here as typed constants to prevent typos
 * and enable cross-module coordination.
 */

import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"

// ── Typed cache key registry ───────────────────────────────────────────────────

export const CACHE_KEYS = {
  ADMIN_REVENUE_DASHBOARD: "admin:revenue:dashboard:v2",
  ADMIN_USERS:             "admin:users:list",
  ADMIN_SUBSCRIPTIONS:     "admin:subscriptions:list",
  ADMIN_ORDERS:            "admin:orders:list",
  ADMIN_PRODUCTS:          "admin:products:list",
  ADMIN_COUPONS:           "admin:coupons:list",
  ADMIN_ANALYTICS:         "admin:analytics:v1",
  ADMIN_AI_MONITORING:     "admin:ai-monitoring:v1",
  ADMIN_WEBHOOKS:          "admin:webhooks:list",
  FEATURE_FLAGS:           "feature-flags:all",
  AI_QUOTA_PREFIX:         "ai:quota:",  // + userId
} as const

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS]

/**
 * Invalidate one or more Redis cache keys atomically.
 * Never throws — failures are logged.
 */
export async function invalidateCache(keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return
  try {
    await Promise.all(keys.map((k) => redis!.del(k)))
    logger.debug({ keys }, "Cache invalidated")
  } catch (err) {
    logger.warn({ err, keys }, "Cache invalidation failed (non-fatal)")
  }
}

/**
 * Invalidate all admin dashboard caches at once.
 * Call this after any bulk operation that affects multiple panels.
 */
export async function invalidateAdminDashboard(): Promise<void> {
  const allAdminKeys = Object.values(CACHE_KEYS).filter(
    (k) => k.startsWith("admin:")
  )
  await invalidateCache(allAdminKeys)
}

/**
 * Get per-user AI quota cache key.
 */
export function aiQuotaCacheKey(userId: string): string {
  return `${CACHE_KEYS.AI_QUOTA_PREFIX}${userId}`
}

/**
 * Set a value with TTL. Returns false if Redis unavailable.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<boolean> {
  if (!redis) return false
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds })
    return true
  } catch (err) {
    logger.warn({ err, key }, "cacheSet failed (non-fatal)")
    return false
  }
}

/**
 * Get a cached value. Returns null if not found or Redis unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    const raw = await redis.get<T | string>(key)
    if (!raw) return null
    return typeof raw === "string" ? (JSON.parse(raw) as T) : raw
  } catch {
    return null
  }
}
