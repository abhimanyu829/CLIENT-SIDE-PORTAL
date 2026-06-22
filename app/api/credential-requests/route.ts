import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const requests = await db.credentialRequest.findMany({
    where: { userId: session.user.id },
    include: { product: { select: { name: true, slug: true } } },
    orderBy: { requestedAt: "desc" },
  })
  return NextResponse.json({ success: true, data: requests })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { entitlementId, reason } = await req.json()
    if (!entitlementId) return NextResponse.json({ error: "entitlementId required" }, { status: 400 })

    const entitlement = await db.customerEntitlement.findFirst({
      where: { id: entitlementId, userId: session.user.id },
      include: { product: { select: { id: true, name: true } } },
    })
    if (!entitlement) return NextResponse.json({ error: "Entitlement not found" }, { status: 404 })

    const existing = await db.credentialRequest.findFirst({
      where: { entitlementId, status: "PENDING" },
    })
    if (existing) return NextResponse.json({ error: "A pending request already exists for this product" }, { status: 409 })

    const credReq = await db.credentialRequest.create({
      data: {
        userId: session.user.id,
        productId: entitlement.productId,
        entitlementId,
        email: session.user.email,
        reason: reason?.trim() || null,
        status: "PENDING",
      },
    })

    auditLog({ userId: session.user.id, action: "CREDENTIAL_REQUESTED", entity: "CredentialRequest", entityId: credReq.id })
    return NextResponse.json({ success: true, data: { id: credReq.id, status: credReq.status } })
  } catch (err) {
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
