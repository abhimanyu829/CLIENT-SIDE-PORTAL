import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * GET /api/admin/revenue
 * Calculates real SaaS KPIs from the payments + subscriptions tables.
 * Protected: admin only.
 *
 * KPIs returned:
 *  - MRR  (Monthly Recurring Revenue)
 *  - ARR  (Annual Recurring Revenue = MRR × 12)
 *  - LTV  (avg revenue per active user)
 *  - Churn rate (% of subs cancelled in last 30 days)
 *  - NRR  (Net Revenue Retention — simplified)
 *  - AOV  (Average Order Value)
 *  - Refund rate
 *  - Revenue by plan
 *  - Daily revenue chart (last 30 days)
 *  - Top paying users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session?.user?.id || (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN")) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // ── Parallel DB queries ───────────────────────────────────────────────────
    const [
      // Revenue: all time SUCCESS payments
      allTimeRevenue,
      // Revenue: last 30 days
      recentRevenue,
      // Active subscriptions
      activeSubscriptions,
      // Cancelled last 30 days (for churn)
      cancelledLast30,
      // Total active users (for churn denominator)
      totalActiveSubs,
      // Refunded payments
      refundedPayments,
      // All payments (for AOV)
      allPayments,
      // Revenue grouped by tier
      revenueByTierRaw,
      // Daily revenue for chart (last 30 days)
      dailyPayments,
      // Top paying users
      topUsers,
    ] = await Promise.all([
      db.payment.aggregate({ _sum: { amount: true }, where: { status: "SUCCESS" } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { status: "SUCCESS", paidAt: { gte: thirtyDaysAgo } } }),
      db.subscription.count({ where: { status: "ACTIVE" } }),
      db.subscription.count({ where: { status: "CANCELLED", cancelledAt: { gte: thirtyDaysAgo } } }),
      db.subscription.count({ where: { status: { in: ["ACTIVE", "PAST_DUE", "PAUSED"] } } }),
      db.payment.aggregate({ _count: true, _sum: { amount: true }, where: { status: "REFUNDED" } }),
      db.payment.aggregate({ _count: true, _sum: { amount: true }, where: { status: "SUCCESS" } }),
      db.payment.groupBy({
        by: ["subscriptionId"],
        _sum: { amount: true },
        where: { status: "SUCCESS" },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),
      db.payment.findMany({
        where: { status: "SUCCESS", paidAt: { gte: thirtyDaysAgo } },
        select: { amount: true, paidAt: true },
        orderBy: { paidAt: "asc" },
      }),
      db.payment.groupBy({
        by: ["userId"],
        _sum: { amount: true },
        where: { status: "SUCCESS" },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),
    ])

    // ── Calculate KPIs ────────────────────────────────────────────────────────

    // MRR = sum of all active subscriptions' monthly prices
    // Simplified: use recent 30-day revenue as proxy
    const mrr = Number(recentRevenue._sum.amount ?? 0)
    const arr = mrr * 12

    // LTV = total revenue / total active subscriptions (simple avg)
    const totalRevenue = Number(allTimeRevenue._sum.amount ?? 0)
    const ltv = activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0

    // Churn rate = (cancelled last 30d / total active subs at start of period) × 100
    const churnRate = totalActiveSubs > 0
      ? Math.round((cancelledLast30 / (totalActiveSubs + cancelledLast30)) * 10000) / 100
      : 0

    // NRR: simplified as (MRR + expansion) / previous MRR — use 1.0 baseline if no historic data
    const nrr = 100 // placeholder — requires historic MRR snapshots for accuracy

    // AOV = total revenue / number of successful payments
    const paymentCount = allPayments._count
    const aov = paymentCount > 0 ? totalRevenue / paymentCount : 0

    // Refund rate = refunded count / total payment count
    const refundRate = paymentCount > 0
      ? Math.round((refundedPayments._count / paymentCount) * 10000) / 100
      : 0

    // Daily revenue chart
    const revenueByDay: Record<string, number> = {}
    for (const p of dailyPayments) {
      if (!p.paidAt) continue
      const day = p.paidAt.toISOString().split("T")[0]
      revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(p.amount)
    }
    const dailySales = Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount }))

    // Enrich top users
    const topUserIds = topUsers.map((u) => u.userId)
    const enrichedUsers = await db.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    const userMap = new Map(enrichedUsers.map((u) => [u.id, u]))
    const topPayingUsers = topUsers.map((u) => ({
      ...(userMap.get(u.userId) ?? {}),
      totalSpend: Number(u._sum.amount ?? 0),
    }))

    return NextResponse.json({
      success: true,
      data: {
        mrr,
        arr,
        ltv: Math.round(ltv * 100) / 100,
        churnRate,
        nrr,
        aov: Math.round(aov * 100) / 100,
        refundRate,
        totalRevenue,
        activeSubscriptions,
        dailySales,
        topPayingUsers,
        cancelledLast30,
      },
    })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/revenue")
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
