/**
 * lib/services/ai-quota-service.ts
 *
 * AI quota enforcement service.
 * - Enforces token/request limits per user's subscription plan
 * - Records every inference call to AIUsageLog
 * - Updates Redis quota cache
 * - Emits events for monitoring and anomaly detection
 * - All quota checks happen server-side BEFORE inference
 */

import { db } from "@/lib/db"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { auditLog } from "@/lib/admin-audit"
import { aiQuotaCacheKey } from "@/lib/services/cache-service"
import type { AIUsageStatus } from "@prisma/client"

// Default quota limits per plan tier (tokens per day)
// These should match the `limits` JSON field on ProductTier
const DEFAULT_DAILY_TOKEN_LIMIT = 100_000
const QUOTA_CACHE_TTL = 3600 // 1 hour cache

interface QuotaCheck {
  allowed: boolean
  remainingTokens: number
  dailyLimit: number
  usedToday: number
  reason?: string
}

interface UsageRecord {
  userId: string
  model: string
  endpoint: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  latencyMs: number
  status: AIUsageStatus
  errorMessage?: string
  metadata?: Record<string, unknown>
}

/**
 * Check if a user is within their AI quota and deduct tokens.
 * Call this BEFORE running any AI inference.
 */
export async function checkAndDeductQuota(
  userId: string,
  estimatedTokens: number
): Promise<QuotaCheck> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isBanned: true, isVerified: true } })
  if (!user?.isVerified || user.isBanned) {
    return {
      allowed: false,
      remainingTokens: 0,
      dailyLimit: 0,
      usedToday: 0,
      reason: "Account is not eligible for AI access",
    }
  }

  // Get user's subscription to determine quota limit
  const activeSub = await db.subscription.findFirst({
    where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    include: { tier: true },
    orderBy: { createdAt: "desc" },
  })
  if (!activeSub) {
    return {
      allowed: false,
      remainingTokens: 0,
      dailyLimit: 0,
      usedToday: 0,
      reason: "No active subscription with AI access",
    }
  }

  const tierLimits = activeSub?.tier.limits as Record<string, number> | null
  const dailyLimit = tierLimits?.dailyTokens ?? DEFAULT_DAILY_TOKEN_LIMIT

  // Get today's usage from Redis cache or DB
  const cacheKey = `${aiQuotaCacheKey(userId)}:daily`
  let usedToday = 0

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey)
      if (cached !== null) {
        usedToday = parseInt(cached, 10) || 0
      } else {
        // Load from DB
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const aggr = await db.aIUsageLog.aggregate({
          where: {
            userId,
            createdAt: { gte: today },
            status: "SUCCESS",
          },
          _sum: { totalTokens: true },
        })
        usedToday = Number(aggr._sum.totalTokens ?? 0)
        // Cache it with TTL until end of day
        const secondsUntilMidnight = Math.floor(
          (new Date().setHours(24, 0, 0, 0) - Date.now()) / 1000
        )
        await redis.set(cacheKey, usedToday.toString(), {
          ex: Math.min(secondsUntilMidnight, QUOTA_CACHE_TTL),
        })
      }
    } catch {
      // Fallback: query DB directly
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const aggr = await db.aIUsageLog.aggregate({
        where: { userId, createdAt: { gte: today }, status: "SUCCESS" },
        _sum: { totalTokens: true },
      })
      usedToday = Number(aggr._sum.totalTokens ?? 0)
    }
  } else {
    // No Redis — always check DB
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const aggr = await db.aIUsageLog.aggregate({
      where: { userId, createdAt: { gte: today }, status: "SUCCESS" },
      _sum: { totalTokens: true },
    })
    usedToday = Number(aggr._sum.totalTokens ?? 0)
  }

  const remainingTokens = Math.max(0, dailyLimit - usedToday)
  const allowed = usedToday + estimatedTokens <= dailyLimit

  if (!allowed) {
    // Emit quota exceeded event
    await emitEvent({
      type: EVENTS.QUOTA_EXCEEDED,
      timestamp: new Date().toISOString(),
      payload: {
        userId,
        usedToday,
        dailyLimit,
        estimatedTokens,
        tierId: activeSub?.tierId,
      },
    })
  }

  return {
    allowed,
    remainingTokens,
    dailyLimit,
    usedToday,
    reason: allowed ? undefined : `Daily token limit of ${dailyLimit.toLocaleString()} exceeded`,
  }
}

/**
 * Record actual AI usage after inference completes.
 * Updates Redis quota cache and emits AI_USAGE_RECORDED event.
 */
export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    // Write to DB
    await db.aIUsageLog.create({
      data: {
        userId: record.userId,
        model: record.model,
        endpoint: record.endpoint,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        totalTokens: record.totalTokens,
        costUsd: record.costUsd,
        latencyMs: record.latencyMs,
        status: record.status,
        errorMessage: record.errorMessage ?? null,
        metadata: record.metadata ?? null,
      },
    })

    // Update Redis quota cache
    if (redis && record.status === "SUCCESS") {
      const cacheKey = `${aiQuotaCacheKey(record.userId)}:daily`
      try {
        await redis.incrby(cacheKey, record.totalTokens)
      } catch {
        // Non-fatal
      }
    }

    // Emit event
    await emitEvent({
      type: EVENTS.AI_USAGE_RECORDED,
      timestamp: new Date().toISOString(),
      payload: {
        userId: record.userId,
        model: record.model,
        totalTokens: record.totalTokens,
        costUsd: record.costUsd,
        latencyMs: record.latencyMs,
        status: record.status,
      },
    })
  } catch (err) {
    logger.error({ err, userId: record.userId }, "recordUsage: Failed to record AI usage")
  }
}

/**
 * Admin: Override quota limit for a specific user.
 * Clears Redis quota cache to force fresh calculation.
 */
export async function overrideQuota(
  userId: string,
  newDailyLimit: number,
  adminId: string,
  reason: string
): Promise<{ success: boolean }> {
  // Clear quota cache
  if (redis) {
    try {
      await redis.del(`${aiQuotaCacheKey(userId)}:daily`)
    } catch { /* non-fatal */ }
  }

  await auditLog({
    userId: adminId,
    action: "AI_QUOTA_OVERRIDDEN",
    entity: "User",
    entityId: userId,
    before: { note: "Previous quota from tier limits" },
    after: { newDailyLimit, reason, overriddenBy: adminId },
  })

  await emitEvent({
    type: EVENTS.QUOTA_OVERRIDDEN,
    timestamp: new Date().toISOString(),
    actorId: adminId,
    payload: { userId, newDailyLimit, reason },
  })

  return { success: true }
}

/**
 * Get aggregated AI monitoring stats for admin dashboard.
 */
export async function getAIMonitoringStats(range: "today" | "7d" | "30d") {
  const now = new Date()
  const from =
    range === "today"
      ? new Date(now.setHours(0, 0, 0, 0))
      : range === "7d"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totals,
    byModel,
    byStatus,
    latencies,
    topUsers,
    hourlyTrend,
  ] = await Promise.all([
    // Total tokens and cost
    db.aIUsageLog.aggregate({
      where: { createdAt: { gte: from } },
      _sum: { totalTokens: true, costUsd: true },
      _count: true,
      _avg: { latencyMs: true },
    }),

    // Per-model breakdown
    db.aIUsageLog.groupBy({
      by: ["model"],
      where: { createdAt: { gte: from } },
      _sum: { totalTokens: true, costUsd: true },
      _count: true,
      _avg: { latencyMs: true },
    }),

    // By status
    db.aIUsageLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from } },
      _count: true,
    }),

    // Latency percentiles (approximation via sorted sample)
    db.aIUsageLog.findMany({
      where: { createdAt: { gte: from }, status: "SUCCESS" },
      select: { latencyMs: true },
      orderBy: { latencyMs: "asc" },
    }),

    // Top 10 users by cost
    db.aIUsageLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: from } },
      _sum: { totalTokens: true, costUsd: true },
      _count: true,
      orderBy: { _sum: { costUsd: "desc" } },
      take: 10,
    }),

    // Hourly trend (last 24h)
    db.aIUsageLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { createdAt: true, totalTokens: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  // Calculate latency percentiles
  const latencyValues = latencies.map((l) => l.latencyMs)
  const p50 = percentile(latencyValues, 50)
  const p95 = percentile(latencyValues, 95)
  const p99 = percentile(latencyValues, 99)

  // Hourly aggregation
  const hourlyMap: Record<string, { tokens: number; requests: number; errors: number }> = {}
  for (const entry of hourlyTrend) {
    const hour = new Date(entry.createdAt).toISOString().slice(0, 13) + ":00"
    if (!hourlyMap[hour]) hourlyMap[hour] = { tokens: 0, requests: 0, errors: 0 }
    hourlyMap[hour].tokens += entry.totalTokens
    hourlyMap[hour].requests++
    if (entry.status !== "SUCCESS") hourlyMap[hour].errors++
  }

  return {
    totals: {
      totalTokens: Number(totals._sum.totalTokens ?? 0),
      totalCostUsd: Number(totals._sum.costUsd ?? 0),
      totalRequests: totals._count,
      avgLatencyMs: Math.round(totals._avg.latencyMs ?? 0),
    },
    latency: { p50, p95, p99 },
    byModel: byModel.map((m) => ({
      model: m.model,
      tokens: Number(m._sum.totalTokens ?? 0),
      costUsd: Number(m._sum.costUsd ?? 0),
      requests: m._count,
      avgLatencyMs: Math.round(m._avg.latencyMs ?? 0),
    })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    topUsers: topUsers.map((u) => ({
      userId: u.userId,
      tokens: Number(u._sum.totalTokens ?? 0),
      costUsd: Number(u._sum.costUsd ?? 0),
      requests: u._count,
    })),
    hourlyTrend: Object.entries(hourlyMap)
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour.localeCompare(b.hour)),
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
}
