import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * POST /api/admin/refunds/[refundId]/deny
 *
 * Denies a pending refund request:
 * - Marks RefundRequest as DENIED
 * - Restores entitlement to ACTIVE
 * - Audit logs the decision
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const { refundId } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.role || !["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const adminId = session.user.id
  let body: { reason?: string } = {}
  try { body = await req.json() } catch {}
  const reason = body.reason?.trim() || "Denied by admin"

  const refund = await db.refundRequest.findUnique({
    where: { id: refundId },
  })

  if (!refund) {
    return NextResponse.json({ error: "Refund request not found" }, { status: 404 })
  }

  if (refund.status !== "PENDING") {
    return NextResponse.json({ error: `Refund already ${refund.status}` }, { status: 409 })
  }

  await db.$transaction(async (tx) => {
    await tx.refundRequest.update({
      where: { id: refundId },
      data: {
        status: "DENIED",
        resolvedAt: new Date(),
        resolvedBy: adminId,
        auditTrail: [
          ...(Array.isArray(refund.auditTrail) ? refund.auditTrail : []),
          { action: "DENIED", by: adminId, at: new Date().toISOString(), reason },
        ],
      },
    })

    // Restore entitlement to ACTIVE
    if (refund.entitlementId) {
      await tx.customerEntitlement.update({
        where: { id: refund.entitlementId },
        data: {
          status: "ACTIVE",
          accessRevokedAt: null,
          revocationReason: null,
          refundRequested: false,
        },
      }).catch(() => {})
    }

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "REFUND_DENIED",
        entity: "RefundRequest",
        entityId: refundId,
        afterJson: {
          refundId,
          deniedBy: adminId,
          reason,
          deniedAt: new Date().toISOString(),
        },
      },
    })
  })

  logger.info({ refundId, adminId, reason }, "Refund denied by admin")

  return NextResponse.json({ success: true, refundId, status: "DENIED" })
}
