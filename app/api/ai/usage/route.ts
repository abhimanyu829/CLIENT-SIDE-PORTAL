import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [aggregate, recentLogs] = await Promise.all([
      db.aIUsageLog.aggregate({
        where: { userId, createdAt: { gte: monthStart } },
        _sum: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true,
          costUsd: true,
        },
        _count: { id: true },
      }),
      db.aIUsageLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          model: true,
          totalTokens: true,
          status: true,
          createdAt: true,
          latencyMs: true,
        },
      }),
    ])

    return NextResponse.json({
      data: {
        tokensUsed: Number(aggregate._sum.totalTokens ?? 0),
        promptTokens: Number(aggregate._sum.promptTokens ?? 0),
        completionTokens: Number(aggregate._sum.completionTokens ?? 0),
        estimatedCostUsd: Number(aggregate._sum.costUsd ?? 0),
        requestCount: aggregate._count.id,
        recentLogs,
        monthStart: monthStart.toISOString(),
      },
    })
  } catch (err) {
    console.error("[ai/usage]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
