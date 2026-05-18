import { db } from "@/lib/db"

/**
 * Feature Flag helper — server-side only.
 *
 * Usage:
 *   const enabled = await isFeatureEnabled("enable_ai_chat", userId)
 *   if (!enabled) return notFound()
 *
 * Resolution order:
 *  1. Flag disabled globally → false
 *  2. userId in targetUserIds allowlist → true (bypass rollout %)
 *  3. rolloutPercent < 100 → deterministic bucket check (userId hash)
 *  4. rolloutPercent >= 100 → true
 */

/**
 * Deterministic user bucketing for percentage rollouts.
 * Returns a stable 0-99 integer for a given userId+flagName combination.
 */
function getUserBucket(userId: string, flagName: string): number {
  let hash = 5381
  const str = `${flagName}:${userId}`
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return Math.abs(hash) % 100
}

/**
 * Check whether a feature flag is enabled for a specific user.
 * Returns false if the flag doesn't exist (safe default = off).
 */
export async function isFeatureEnabled(
  flagName: string,
  userId?: string
): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({ where: { name: flagName } })
  if (!flag || !flag.isEnabled) return false

  // Explicit allowlist always wins
  if (userId && flag.targetUserIds.includes(userId)) return true

  // Percentage rollout
  if (flag.rolloutPercent >= 100) return true
  if (flag.rolloutPercent <= 0) return false
  if (!userId) return false

  const bucket = getUserBucket(userId, flagName)
  return bucket < flag.rolloutPercent
}

/**
 * Batch-check multiple flags for a single user.
 * More efficient than multiple isFeatureEnabled calls.
 */
export async function getFeatureFlags(
  flagNames: string[],
  userId?: string
): Promise<Record<string, boolean>> {
  const flags = await db.featureFlag.findMany({
    where: { name: { in: flagNames } },
  })

  const result: Record<string, boolean> = {}

  for (const name of flagNames) {
    const flag = flags.find((f) => f.name === name)
    if (!flag || !flag.isEnabled) {
      result[name] = false
      continue
    }

    if (userId && flag.targetUserIds.includes(userId)) {
      result[name] = true
      continue
    }

    if (flag.rolloutPercent >= 100) {
      result[name] = true
      continue
    }

    if (!userId || flag.rolloutPercent <= 0) {
      result[name] = false
      continue
    }

    result[name] = getUserBucket(userId, name) < flag.rolloutPercent
  }

  return result
}
