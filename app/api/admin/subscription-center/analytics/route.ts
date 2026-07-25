import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const now = new Date()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [
      totalActive,
      totalTrialing,
      totalPastDue,
      totalPaused,
      totalCanceled,
      newThisMonth,
      plansBreakdown,
      upcomingRenewals,
      recentActivity,
      invoiceStats,
    ] = await Promise.all([
      db.userSubscription.count({ where: { status: "ACTIVE" } }),
      db.userSubscription.count({ where: { status: "TRIALING" } }),
      db.userSubscription.count({ where: { status: "PAST_DUE" } }),
      db.userSubscription.count({ where: { status: "PAUSED" } }),
      db.userSubscription.count({ where: { status: "CANCELED" } }),
      db.userSubscription.count({ where: { createdAt: { gte: monthAgo } } }),

      db.subscriptionPlan.findMany({
        select: {
          id: true,
          name: true,
          tier: true,
          _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
        },
        orderBy: { sortOrder: "asc" },
      }),

      db.userSubscription.count({
        where: { status: "ACTIVE", currentPeriodEnd: { gte: now, lte: in30 } },
      }),

      db.userSubscription.findMany({
        where: { createdAt: { gte: monthAgo } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true, email: true } },
          plan: { select: { name: true, tier: true } },
        },
      }),

      db.subscriptionInvoice.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ])

    const totalMRR = await db.userSubscription.aggregate({
      where: { status: "ACTIVE" },
      _sum: { totalAmount: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        counts: {
          active: totalActive,
          trialing: totalTrialing,
          past_due: totalPastDue,
          paused: totalPaused,
          canceled: totalCanceled,
          newThisMonth,
          upcomingRenewals,
        },
        mrr: Number(totalMRR._sum.totalAmount ?? 0),
        plansBreakdown: plansBreakdown.map((p) => ({
          id: p.id,
          name: p.name,
          tier: p.tier,
          activeCount: p._count.subscriptions,
        })),
        recentActivity,
        invoiceStats,
      },
    })
  } catch (err) {
    console.error("[subscription-center analytics GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch analytics" }, { status: 500 })
  }
}
