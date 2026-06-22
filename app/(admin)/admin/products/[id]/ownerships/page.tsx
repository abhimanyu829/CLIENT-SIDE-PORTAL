import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import OwnershipsClient from "./OwnershipsClient"

export const metadata = { title: "Product Ownerships — Admin" }

export default async function ProductOwnershipsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) redirect("/dashboard")

  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, productAccessUrl: true, productLoginUrl: true, productDashboardUrl: true, productAccessNotes: true },
  })
  if (!product) notFound()

  const entitlements = await db.customerEntitlement.findMany({
    where: { productId: id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  })

  const entitlementIds = entitlements.map((e) => e.id)
  const auditLogs = entitlementIds.length
    ? await db.auditLog.findMany({
        where: { entity: "CustomerEntitlement", entityId: { in: entitlementIds } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : []

  const serialized = {
    product,
    entitlements: entitlements.map((e) => ({
      id: e.id,
      userName: e.user.name,
      userEmail: e.user.email,
      status: e.status,
      grantedAt: e.createdAt.toISOString(),
      expiresAt: e.expiresAt?.toISOString() ?? null,
      accessRevokedAt: e.accessRevokedAt?.toISOString() ?? null,
      revocationReason: e.revocationReason ?? null,
      orderId: e.orderId ?? null,
    })),
    auditLogs: auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityId: l.entityId,
      createdAt: l.createdAt.toISOString(),
    })),
  }

  return <OwnershipsClient data={serialized} />
}
