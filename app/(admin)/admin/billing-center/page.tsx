import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { serializePrisma } from "@/lib/serialize-prisma"
import BillingCenterClient from "./BillingCenterClient"

export const dynamic = "force-dynamic"

export default async function BillingCenterPage() {
  await requireAdmin()

  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    plans,
    premiumServices,
    addonServices,
    activeCount,
    trialingCount,
    pastDueCount,
    pausedCount,
    canceledCount,
    newThisMonth,
    upcomingRenewals,
    recentSubscriptions,
    invoiceSummary,
    serviceCategories,
  ] = await Promise.all([
    db.subscriptionPlan.findMany({
      include: {
        benefits: { orderBy: { sortOrder: "asc" } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),

    db.premiumService.findMany({
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { addonServices: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

    db.addonService.findMany({
      include: {
        premiumService: { select: { id: true, name: true } },
        _count: { select: { userAddons: { where: { isActive: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

    db.userSubscription.count({ where: { status: "ACTIVE" } }),
    db.userSubscription.count({ where: { status: "TRIALING" } }),
    db.userSubscription.count({ where: { status: "PAST_DUE" } }),
    db.userSubscription.count({ where: { status: "PAUSED" } }),
    db.userSubscription.count({ where: { status: "CANCELED" } }),
    db.userSubscription.count({ where: { createdAt: { gte: monthAgo } } }),

    db.userSubscription.count({
      where: { status: "ACTIVE", currentPeriodEnd: { gte: now, lte: in30 } },
    }),

    db.userSubscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, tier: true, billingCycle: true } },
      },
    }),

    db.subscriptionInvoice.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { totalAmount: true },
    }),

    db.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ])

  const mrrAgg = await db.userSubscription.aggregate({
    where: { status: "ACTIVE" },
    _sum: { totalAmount: true },
  })
  const mrr = Number(mrrAgg._sum.totalAmount ?? 0)

  return (
    <BillingCenterClient
      plans={serializePrisma(plans) as any}
      premiumServices={serializePrisma(premiumServices) as any}
      addonServices={serializePrisma(addonServices) as any}
      analytics={{
        active: activeCount,
        trialing: trialingCount,
        pastDue: pastDueCount,
        paused: pausedCount,
        canceled: canceledCount,
        newThisMonth,
        upcomingRenewals,
        mrr,
        invoiceSummary: serializePrisma(invoiceSummary) as any,
      }}
      recentSubscriptions={serializePrisma(recentSubscriptions) as any}
      serviceCategories={serviceCategories}
    />
  )
}
