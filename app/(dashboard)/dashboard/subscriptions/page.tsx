import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import SubscriptionsClient from "@/components/dashboard/SubscriptionsClient"

export const dynamic = "force-dynamic"

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const [subscriptions, products] = await Promise.all([
    // Fetch user's subscriptions with full tier data
    db.subscription.findMany({
      where: { userId: session.user.id },
      include: {
        product: { select: { id: true, name: true, type: true } },
        tier: { select: { id: true, name: true, price: true, interval: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Fetch available products with their active tiers for checkout
    db.product.findMany({
      where: { status: "PUBLISHED" },
      include: {
        tiers: {
          where: { isActive: true },
          orderBy: { price: "asc" },
          select: {
            id: true,
            name: true,
            price: true,
            interval: true,
            currency: true,
            isActive: true,
          },
        },
      },
      orderBy: { type: "asc" },
    }),
  ])

  // Serialize Decimal fields for Next.js server-to-client boundary
  const serializedSubs = subscriptions.map(s => ({
    ...s,
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    cancelledAt: s.cancelledAt?.toISOString() ?? null,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    tier: s.tier ? { ...s.tier, price: String(s.tier.price) } : null,
  }))

  const serializedProducts = products.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    tiers: p.tiers.map(t => ({ ...t, price: String(t.price) })),
  }))

  return (
    <SubscriptionsClient
      initialSubscriptions={serializedSubs as any}
      availableProducts={serializedProducts as any}
    />
  )
}
