import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getAIMonitoringStats } from "@/lib/services/ai-quota-service"
import { cacheGet, cacheSet, CACHE_KEYS } from "@/lib/services/cache-service"

const CACHE_TTL = 60 // 1 minute for real-time feel

export async function GET(req: NextRequest) {
  await requireAdmin()

  const { searchParams } = req.nextUrl
  const range = (searchParams.get("range") ?? "7d") as "today" | "7d" | "30d"

  const cacheKey = `${CACHE_KEYS.ADMIN_AI_MONITORING}:${range}`

  // Try cache
  const cached = await cacheGet<object>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    const stats = await getAIMonitoringStats(range)

    // Enrich top users with email/name from DB
    const { db } = await import("@/lib/db")
    const userIds = stats.topUsers.map((u) => u.userId)
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const enrichedTopUsers = stats.topUsers.map((u) => ({
      ...u,
      name: userMap[u.userId]?.name ?? "Unknown",
      email: userMap[u.userId]?.email ?? "unknown@example.com",
    }))

    const result = { ...stats, topUsers: enrichedTopUsers }

    await cacheSet(cacheKey, result, CACHE_TTL)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to fetch AI stats" },
      { status: 500 }
    )
  }
}
