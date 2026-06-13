import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redis } from "@/lib/redis"

function normalizeCachedStats(cached: unknown) {
  if (!cached) return null
  if (typeof cached === "string") {
    try {
      return JSON.parse(cached)
    } catch {
      return null
    }
  }
  if (typeof cached === "object") {
    return cached
  }
  return null
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    // Try cache first
    if (redis) {
      const cached = await redis.get(`dash:stats:${userId}`).catch(() => null)
      const parsed = normalizeCachedStats(cached)
      if (parsed) return NextResponse.json({ data: parsed })
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      activeSubs,
      openTickets,
      monthlySpendResult,
      aiUsageResult,
      projectsCount,
      resolvedTickets,
      totalInvoices,
    ] = await Promise.all([
      db.subscription.count({ where: { userId, status: "ACTIVE" } }),
      db.ticket.count({ where: { clientId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.invoice.aggregate({
        where: { userId, status: "PAID", issuedAt: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      db.aIUsageLog.aggregate({
        where: { userId, createdAt: { gte: monthStart } },
        _sum: { totalTokens: true },
      }),
      db.project.count({ where: { clientId: userId } }),
      db.ticket.count({
        where: { clientId: userId, status: "RESOLVED", updatedAt: { gte: monthStart } },
      }),
      db.invoice.count({ where: { userId } }),
    ])

    const stats = {
      activeSubs,
      openTickets,
      monthlySpend: Number(monthlySpendResult._sum.totalAmount ?? 0),
      aiTokensUsed: Number(aiUsageResult._sum.totalTokens ?? 0),
      aiTokensLimit: 100000,
      projectsCount,
      resolvedTickets,
      totalInvoices,
    }

    if (redis) {
      await redis.setex(`dash:stats:${userId}`, 60, JSON.stringify(stats)).catch(() => {})
    }

    return NextResponse.json({ data: stats })
  } catch (err) {
    console.error("[dashboard/stats]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
