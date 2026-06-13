import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { serializePrisma } from "@/lib/serialize-prisma"
import SubscriptionsClient from "./SubscriptionsClient"

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>
}) {
  await requireAdmin()

  const params = await searchParams
  const status = params?.status ?? ""
  const page = Math.max(1, Number(params?.page ?? 1))
  const limit = 20
  const now = new Date()

  const where = status ? { status: status as "ACTIVE" | "TRIALING" | "PAUSED" | "PAST_DUE" | "CANCELLED" } : {}

  const [subscriptions, total] = await Promise.all([
    db.subscription.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, type: true, tiers: { where: { isActive: true } } } },
        tier: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.subscription.count({ where }),
  ])

  // Status counts for tabs
  const statusCounts = await Promise.all(
    ["ACTIVE", "TRIALING", "PAUSED", "PAST_DUE", "CANCELLED"].map((s) =>
      db.subscription.count({ where: { status: s as "ACTIVE" | "TRIALING" | "PAUSED" | "PAST_DUE" | "CANCELLED" } })
    )
  )

  // Upcoming renewals in 30 days
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const upcomingRenewals = await db.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { gte: now, lte: in30 } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      tier: true,
      product: { select: { name: true } },
    },
    orderBy: { currentPeriodEnd: "asc" },
    take: 50,
  })

  // Past due / dunning queue
  const dunningQueue = await db.subscription.findMany({
    where: { status: "PAST_DUE" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      tier: true,
      payments: { where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 5 },
    },
    take: 20,
  })

  const serialize = (s: typeof subscriptions[0]) => ({
    ...s,
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    cancelledAt: s.cancelledAt?.toISOString() ?? null,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    tier: { ...s.tier, price: String(s.tier.price), createdAt: s.tier.createdAt.toISOString() },
    payments: s.payments.map((p) => ({
      ...p,
      amount: String(p.amount),
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    product: {
      ...s.product,
      tiers: (s.product as any).tiers?.map((t: any) => ({
        id: t.id,
        name: t.name,
        price: String(t.price),
        interval: t.interval,
        currency: t.currency
      })) || []
    }
  })

  const serializedSubscriptions = serializePrisma(subscriptions.map(serialize))
  const serializedUpcomingRenewals = serializePrisma(upcomingRenewals.map((r) => ({
    ...r,
    currentPeriodStart: r.currentPeriodStart.toISOString(),
    currentPeriodEnd: r.currentPeriodEnd.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    trialEndsAt: r.trialEndsAt?.toISOString() ?? null,
    tier: { ...r.tier, price: String(r.tier.price), createdAt: r.tier.createdAt.toISOString() },
  })))
  const serializedDunningQueue = serializePrisma(dunningQueue.map((d) => ({
    ...d,
    currentPeriodStart: d.currentPeriodStart.toISOString(),
    currentPeriodEnd: d.currentPeriodEnd.toISOString(),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    cancelledAt: d.cancelledAt?.toISOString() ?? null,
    trialEndsAt: d.trialEndsAt?.toISOString() ?? null,
    tier: { ...d.tier, price: String(d.tier.price), createdAt: d.tier.createdAt.toISOString() },
    payments: d.payments.map((p) => ({ ...p, amount: String(p.amount), createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null })),
  })))

  return (
    <SubscriptionsClient
      subscriptions={serializedSubscriptions as any}
      total={total}
      page={page}
      limit={limit}
      activeStatus={status}
      statusCounts={statusCounts}
      upcomingRenewals={serializedUpcomingRenewals as any}
      dunningQueue={serializedDunningQueue as any}
    />
  )
}
