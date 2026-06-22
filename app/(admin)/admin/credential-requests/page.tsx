import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import CredentialRequestsClient from "./CredentialRequestsClient"

export const metadata = { title: "Credential Requests — Admin" }

export default async function CredentialRequestsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) redirect("/dashboard")

  const requests = await db.credentialRequest.findMany({
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true, slug: true, productLoginUrl: true } },
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  })

  const serialized = requests.map((r) => ({
    id: r.id,
    userName: r.user.name,
    userEmail: r.user.email,
    productName: r.product.name,
    productSlug: r.product.slug,
    productLoginUrl: r.product.productLoginUrl,
    email: r.email,
    reason: r.reason,
    status: r.status,
    adminNotes: r.adminNotes,
    allowDashboard: r.allowDashboard,
    requestedAt: r.requestedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    resolvedBy: r.resolvedBy,
  }))

  return <CredentialRequestsClient requests={serialized} />
}
