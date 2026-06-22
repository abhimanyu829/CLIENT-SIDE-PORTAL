import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const entitlement = await db.customerEntitlement.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true, slug: true } },
    },
  })
  if (!entitlement) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ success: true, data: entitlement })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  try {
    const { action, reason } = await req.json()

    const before = await db.customerEntitlement.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 })

    let updateData: Record<string, unknown> = {}
    if (action === "REVOKE") {
      updateData = { status: "REVOKED", accessRevokedAt: new Date(), revocationReason: reason ?? "Admin revoked" }
    } else if (action === "SUSPEND") {
      updateData = { status: "SUSPENDED" }
    } else if (action === "REACTIVATE") {
      updateData = { status: "ACTIVE", accessRevokedAt: null, revocationReason: null }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const updated = await db.customerEntitlement.update({ where: { id }, data: updateData })

    auditLog({
      userId: session.user.id,
      action: `ENTITLEMENT_${action}`,
      entity: "CustomerEntitlement",
      entityId: id,
      before: before,
      after: updated,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
