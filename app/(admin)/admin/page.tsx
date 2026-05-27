import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { cacheGet, cacheSet, CACHE_KEYS } from "@/lib/services/cache-service"
import RevenueDashboardClient, { type DashboardData } from "./RevenueDashboardClient"

const CACHE_TTL = 300 // 5 minutes

export const dynamic = "force-dynamic"

function linearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length
  if (n === 0) return { slope: 0, intercept: 0 }
  const xMean = (n - 1) / 2
  const yMean = data.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  data.forEach((y, x) => {
    num += (x - xMean) * (y - yMean)
    den += (x - xMean) ** 2
  })
  const slope = den !== 0 ? num / den : 0
  const intercept = yMean - slope * xMean
  return { slope, intercept }
}

export default async function AdminOverviewPage() {
  await requireAdmin()

  const cached = await cacheGet<DashboardData>(CACHE_KEYS.ADMIN_REVENUE_DASHBOARD)
  if (cached) {
    return <RevenueDashboardClient data={cached} />
  }

  // --- Compute metrics ---
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [
    activeSubs,
    cancelledThisMonth,
    activeLastMonth,
    allInvoices,
    refundedPayments,
    totalPayments,
    last90DaysInvoices,
  ] = await Promise.all([
    db.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { tier: true, product: true },
    }),
    db.subscription.count({
      where: { status: "CANCELLED", cancelledAt: { gte: startOfMonth } },
    }),
    db.subscription.count({
      where: { status: "ACTIVE", createdAt: { lte: endLastMonth } },
    }),
    db.invoice.findMany({
      where: { status: "PAID" },
      include: { user: { select: { id: true, name: true, email: true } }, subscription: { include: { product: true, tier: true } } },
      orderBy: { issuedAt: "desc" },
    }),
    db.payment.count({ where: { status: "REFUNDED" } }),
    db.payment.count(),
    db.invoice.findMany({
      where: { status: "PAID", issuedAt: { gte: last90Days } },
      orderBy: { issuedAt: "asc" },
    }),
  ])

  // MRR calculation
  const mrr = activeSubs.reduce((sum, sub) => {
    let price = Number(sub.tier.price)
    if (sub.tier.interval === "YEARLY") price = price / 12
    return sum + price
  }, 0)

  const arr = mrr * 12
  const totalRevenue = allInvoices.reduce((s, inv) => s + Number(inv.totalAmount), 0)
  const aov = allInvoices.length > 0 ? totalRevenue / allInvoices.length : 0
  const ltv = mrr > 0 ? mrr * 24 : 0
  const churnRate = activeLastMonth > 0 ? (cancelledThisMonth / activeLastMonth) * 100 : 0
  const refundRate = totalPayments > 0 ? (refundedPayments / totalPayments) * 100 : 0

  // Revenue by plan
  const revenueByPlanMap: Record<string, number> = {}
  activeSubs.forEach((sub) => {
    const key = `${sub.product.name} – ${sub.tier.name}`
    revenueByPlanMap[key] = (revenueByPlanMap[key] ?? 0) + Number(sub.tier.price)
  })
  const revenueByPlan = Object.entries(revenueByPlanMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Daily revenue (last 30 days)
  const dailyMap: Record<string, number> = {}
  last90DaysInvoices.forEach((inv) => {
    const day = inv.issuedAt.toISOString().slice(0, 10)
    dailyMap[day] = (dailyMap[day] ?? 0) + Number(inv.totalAmount)
  })
  const last30DaysRevenue = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    return { date: key, revenue: dailyMap[key] ?? 0 }
  })

  // Linear regression forecast
  const revenueArr = last30DaysRevenue.map((d) => d.revenue)
  const { slope, intercept } = linearRegression(revenueArr)
  const forecast30 = Math.max(0, (intercept + slope * (revenueArr.length + 30)) * 30)
  const forecast90 = Math.max(0, (intercept + slope * (revenueArr.length + 90)) * 90)

  // Top users by LTV
  const userRevMap: Record<string, { name: string; email: string; ltv: number }> = {}
  allInvoices.forEach((inv) => {
    const uid = inv.user.id
    if (!userRevMap[uid]) userRevMap[uid] = { name: inv.user.name, email: inv.user.email, ltv: 0 }
    userRevMap[uid].ltv += Number(inv.totalAmount)
  })
  const topUsers = Object.entries(userRevMap).map(([id, val]) => ({ id, ...val })).sort((a, b) => b.ltv - a.ltv).slice(0, 10)

  // Top products by revenue
  const prodRevMap: Record<string, { name: string; revenue: number; subs: number }> = {}
  activeSubs.forEach((sub) => {
    const pid = sub.product.id
    if (!prodRevMap[pid]) prodRevMap[pid] = { name: sub.product.name, revenue: 0, subs: 0 }
    prodRevMap[pid].revenue += Number(sub.tier.price)
    prodRevMap[pid].subs += 1
  })
  const topProducts = Object.entries(prodRevMap).map(([id, val]) => ({ id, ...val })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // Expansion vs Contraction (mock monthly data)
  const expansionContraction = Array.from({ length: 6 }, (_, i) => ({
    month: new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      .toLocaleString("default", { month: "short" }),
    expansion: Math.round(mrr * (0.05 + Math.random() * 0.1)),
    contraction: Math.round(mrr * (0.01 + Math.random() * 0.05)),
  }))

  const data: DashboardData = {
    mrr: Math.round(mrr),
    arr: Math.round(arr),
    aov: Math.round(aov * 100) / 100,
    ltv: Math.round(ltv),
    cac: 50,
    churnRate: Math.round(churnRate * 10) / 10,
    nrr: 105,
    refundRate: Math.round(refundRate * 10) / 10,
    totalRevenue: Math.round(totalRevenue),
    last30DaysRevenue,
    revenueByPlan,
    topUsers,
    topProducts,
    expansionContraction,
    forecast30: Math.round(forecast30),
    forecast90: Math.round(forecast90),
  }

  await cacheSet(CACHE_KEYS.ADMIN_REVENUE_DASHBOARD, data, CACHE_TTL)

  return <RevenueDashboardClient data={data} />
}
