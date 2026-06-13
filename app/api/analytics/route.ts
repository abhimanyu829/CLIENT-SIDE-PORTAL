import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/analytics — admin dashboard KPIs and chart data
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const range = searchParams.get("range") ?? "30d"

    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30
    const since = new Date()
    since.setDate(since.getDate() - days)

    const [
      totalUsers,
      newUsers,
      totalRevenue,
      activeSubscriptions,
      openTickets,
      totalProducts,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: since } } }),
      db.payment.aggregate({
        _sum: { amount: true },
        where: { status: "SUCCESS", paidAt: { gte: since } },
      }),
      db.subscription.count({ where: { status: "ACTIVE" } }),
      db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.product.count({ where: { status: "AVAILABLE" } }),
    ])

    // Revenue by day for chart
    const payments = await db.payment.findMany({
      where: { status: "SUCCESS", paidAt: { gte: since } },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    })

    const revenueByDay = (payments as any[]).reduce((acc: Record<string, number>, p: any) => {
      const day = p.paidAt?.toISOString().split("T")[0] ?? "unknown"
      acc[day] = (acc[day] ?? 0) + Number(p.amount)
      return acc
    }, {})

    return NextResponse.json({
      data: {
        kpis: {
          totalUsers,
          newUsers,
          totalRevenue: Number(totalRevenue._sum.amount ?? 0),
          activeSubscriptions,
          openTickets,
          totalProducts,
        },
        charts: {
          revenueByDay: Object.entries(revenueByDay).map(([date, amount]) => ({
            date,
            amount,
          })),
        },
      },
    })
  } catch (err) {
    console.error("[analytics] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
