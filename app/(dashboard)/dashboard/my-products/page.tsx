import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import MyProductsClient from "./MyProductsClient"

export const metadata = { title: "My Products — NexusAI" }

export default async function MyProductsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const entitlements = await db.customerEntitlement.findMany({
    where: { userId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          thumbnailUrl: true,
          description: true,
          category: true,
          status: true,
          productAccessUrl: true,
          productLoginUrl: true,
          productDashboardUrl: true,
          productAccessNotes: true,
        },
      },
      credentialRequests: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Fetch subscriptions separately for entitlements that have a subscriptionId
  const subscriptionIds = entitlements
    .map((e) => e.subscriptionId)
    .filter(Boolean) as string[]

  const subscriptions = subscriptionIds.length
    ? await db.subscription.findMany({
        where: { id: { in: subscriptionIds } },
        include: { tier: { select: { name: true, interval: true } } },
      })
    : []

  const subMap = Object.fromEntries(subscriptions.map((s) => [s.id, s]))

  const now = Date.now()

  const serialized = entitlements.map((e) => {
    const sub = e.subscriptionId ? subMap[e.subscriptionId] : null
    const isActive = e.status === "ACTIVE"
    const expiresInDays = e.expiresAt
      ? Math.ceil((new Date(e.expiresAt).getTime() - now) / 86_400_000)
      : null

    return {
      id: e.id,
      productId: e.productId,
      productName: e.product.name,
      productSlug: e.product.slug,
      productThumbnail: e.product.thumbnailUrl,
      productDescription: e.product.description,
      productCategory: e.product.category?.toString() ?? null,
      productStatus: e.product.status,
      // Access URLs — ONLY exposed when entitlement is ACTIVE
      productAccessUrl: isActive ? (e.product.productAccessUrl ?? null) : null,
      productLoginUrl: isActive ? (e.product.productLoginUrl ?? null) : null,
      productDashboardUrl: isActive ? (e.product.productDashboardUrl ?? null) : null,
      productAccessNotes: isActive ? (e.product.productAccessNotes ?? null) : null,
      status: e.status,
      type: e.accessType,
      grantedAt: e.createdAt.toISOString(),
      expiresAt: e.expiresAt?.toISOString() ?? null,
      remainingDays: expiresInDays,
      accessRevokedAt: e.accessRevokedAt?.toISOString() ?? null,
      refundEligibleUntil: e.refundEligibleUntil?.toISOString() ?? null,
      refundRequested: e.refundRequested,
      hasCredentials: !!e.credentialSnapshot,
      orderId: e.orderId,
      subscriptionPlan: sub ? `${sub.tier.name} / ${sub.tier.interval}` : null,
      subscriptionStatus: sub?.status ?? null,
      subscriptionExpiry: sub?.currentPeriodEnd?.toISOString() ?? null,
      hasPendingCredentialRequest: e.credentialRequests.length > 0,
    }
  })

  return <MyProductsClient entitlements={serialized} />
}
