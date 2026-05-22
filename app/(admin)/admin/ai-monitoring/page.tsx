import { requireAdmin } from "@/lib/admin-auth"
import { getAIMonitoringStats } from "@/lib/services/ai-quota-service"
import { cacheGet, cacheSet, CACHE_KEYS } from "@/lib/services/cache-service"
import { db } from "@/lib/db"
import AiMonitoringClient from "./AiMonitoringClient"

const CACHE_TTL = 120 // 2 minutes

export default async function AiMonitoringPage() {
  await requireAdmin()

  const cacheKey = `${CACHE_KEYS.ADMIN_AI_MONITORING}:page`
  const cached = await cacheGet<object>(cacheKey)

  let stats: Awaited<ReturnType<typeof getAIMonitoringStats>>
  let enrichedTopUsers: Array<{
    userId: string
    name: string
    email: string
    tokens: number
    costUsd: number
    requests: number
  }>

  if (cached) {
    const c = cached as any
    stats = c.stats
    enrichedTopUsers = c.enrichedTopUsers
  } else {
    stats = await getAIMonitoringStats("7d")

    // Enrich top users with email/name
    const userIds = stats.topUsers.map((u) => u.userId)
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    enrichedTopUsers = stats.topUsers.map((u) => ({
      ...u,
      name: userMap[u.userId]?.name ?? "Unknown",
      email: userMap[u.userId]?.email ?? "unknown@example.com",
    }))

    await cacheSet(cacheKey, { stats, enrichedTopUsers }, CACHE_TTL)
  }

  return (
    <AiMonitoringClient
      totals={stats.totals}
      latency={stats.latency}
      byModel={stats.byModel}
      byStatus={stats.byStatus}
      topUsers={enrichedTopUsers}
      hourlyTrend={stats.hourlyTrend}
    />
  )
}
