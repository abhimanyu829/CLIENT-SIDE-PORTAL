/**
 * lib/agent-gateway/identity/connection-cache.ts
 *
 * Connection-status cache (Phase 2 spec §25). Reuses the EXISTING Redis
 * client (lib/redis.ts) — no new cache infrastructure.
 *
 * Design (documented per spec's requirement to define key/TTL/invalidation
 * explicitly):
 *   - Cache key:    agent-gateway:conn-status:<connectionId>
 *   - TTL:          30 seconds (short and fixed — not configurable, since
 *                   making this configurable invites accidentally setting
 *                   it too high for a security-sensitive cache)
 *   - Invalidation: explicit — every lifecycle mutation (suspend, reactivate,
 *                   revoke, rotate) calls invalidate() for the affected
 *                   connectionId BEFORE returning, so a revoked connection
 *                   is never served from a stale cache entry after its
 *                   admin action completes. The 30s TTL is a bound on how
 *                   long a cache entry can be stale if invalidation itself
 *                   were ever skipped (defense in depth, not the primary
 *                   mechanism).
 *   - Fail-open on cache MISS or Redis unavailable: falls through to a
 *     real DB read (cache is a performance optimization only — it is never
 *     the sole source of truth for a security decision. Contrast this with
 *     rate-limiting/replay-protection in Phase 1, which fail CLOSED when
 *     Redis is unavailable, because those have no fallback source of
 *     truth; connection status always does — the database).
 */
import { redis } from "@/lib/redis"
import type { AgentConnectionStatusValue } from "../shared/types"

const TTL_SECONDS = 30

function cacheKey(connectionId: string): string {
  return `agent-gateway:conn-status:${connectionId}`
}

export async function getCachedStatus(connectionId: string): Promise<AgentConnectionStatusValue | null> {
  if (!redis) return null
  try {
    const value = await redis.get<string>(cacheKey(connectionId))
    return (value as AgentConnectionStatusValue) ?? null
  } catch {
    return null
  }
}

export async function setCachedStatus(connectionId: string, status: AgentConnectionStatusValue): Promise<void> {
  if (!redis) return
  try {
    await redis.set(cacheKey(connectionId), status, { ex: TTL_SECONDS })
  } catch {
    // Best-effort — a cache write failure must never block the caller.
  }
}

/** MUST be called by every lifecycle mutation for the affected connectionId. */
export async function invalidateConnectionStatus(connectionId: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(cacheKey(connectionId))
  } catch {
    // Best-effort — see module docstring: TTL bounds the staleness window
    // even if this delete fails.
  }
}
