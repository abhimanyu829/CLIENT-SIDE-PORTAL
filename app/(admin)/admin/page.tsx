import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminOverviewClient from "./AdminOverviewClient"

export default async function AdminOverviewPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard")

  const [totalUsers, newSignups, totalRevenueSumRaw, recentLogs] = await Promise.all([
    db.user.count(),
    db.user.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    }),
    db.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmount: true }
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } }
    })
  ])

  const totalRevenue = Number(totalRevenueSumRaw._sum.totalAmount ?? 0)
  const mrr = totalRevenue / 12
  const arr = totalRevenue

  const kpis = {
    mrr,
    arr,
    newSignups,
    churnRate: 2.1,
    totalUsers,
    totalRevenue,
    recentActivity: recentLogs.map(log => ({
      action: log.action,
      actor: log.user?.name ?? log.user?.email ?? "System",
      time: new Date(log.createdAt).toLocaleString()
    }))
  }

  return <AdminOverviewClient kpis={kpis} />
}
