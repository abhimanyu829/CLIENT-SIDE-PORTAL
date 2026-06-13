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
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const serialized = entitlements.map((e) => ({
    id: e.id,
    productId: e.productId,
    productName: e.product.name,
    productSlug: e.product.slug,
    productThumbnail: e.product.thumbnailUrl,
    productDescription: e.product.description,
    productCategory: e.product.category?.toString() ?? null,
    status: e.status,
    type: e.accessType,
    grantedAt: e.createdAt.toISOString(),
    expiresAt: e.expiresAt?.toISOString() ?? null,
    accessRevokedAt: e.accessRevokedAt?.toISOString() ?? null,
    refundEligibleUntil: e.refundEligibleUntil?.toISOString() ?? null,
    refundRequested: e.refundRequested,
    hasCredentials: !!e.credentialSnapshot,
    orderId: e.orderId,
  }))

  return <MyProductsClient entitlements={serialized} />
}
