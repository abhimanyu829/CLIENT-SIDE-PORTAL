import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { processRefund } from "@/lib/services/refund-service"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { logger } from "@/lib/logger"

/**
 * POST /api/admin/refunds/[refundId]/approve
 *
 * Approves a pending refund request:
 * - Processes gateway refund if not already done
 * - Marks RefundRequest as PROCESSED
 * - Deactivates entitlement
 * - Sends confirmation email
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const { refundId } = await params

  const session = await auth()
  if (!session?.user?.role || !["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const adminId = session.user.id

  const refund = await db.refundRequest.findUnique({
    where: { id: refundId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  })

  if (!refund) {
    return NextResponse.json({ error: "Refund request not found" }, { status: 404 })
  }

  const payment = await db.payment.findUnique({ where: { id: refund.paymentId } })

  if (refund.status !== "PENDING") {
    return NextResponse.json({ error: `Refund already ${refund.status}` }, { status: 409 })
  }

  let gatewayRefundId: string | undefined

  // Attempt gateway refund if not already processed
  if (payment?.id && !refund.gatewayRefundId) {
    try {
      const result = await processRefund(
        payment.id,
        Number(refund.refundAmount ?? payment.amount),
        refund.reason,
        adminId
      )
      gatewayRefundId = result?.gatewayRefundId
    } catch (refundErr) {
      logger.error({ refundErr, refundId }, "Admin approve: gateway refund failed")
      // Continue — mark as approved manually
    }
  }

  await db.$transaction(async (tx) => {
    await tx.refundRequest.update({
      where: { id: refundId },
      data: {
        status: "PROCESSED",
        gatewayRefundId: gatewayRefundId ?? refund.gatewayRefundId ?? undefined,
        resolvedAt: new Date(),
        resolvedBy: adminId,
        auditTrail: [
          ...(Array.isArray(refund.auditTrail) ? refund.auditTrail : []),
          { action: "APPROVED", by: adminId, at: new Date().toISOString() },
        ],
      },
    })

    // Revoke entitlement
    if (refund.entitlementId) {
      await tx.customerEntitlement.update({
        where: { id: refund.entitlementId },
        data: {
          status: "REVOKED",
          accessRevokedAt: new Date(),
          revocationReason: "Refund approved by admin",
        },
      }).catch(() => {})
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "REFUND_APPROVED",
        entity: "RefundRequest",
        entityId: refundId,
        afterJson: {
          refundId,
          approvedBy: adminId,
          gatewayRefundId,
          approvedAt: new Date().toISOString(),
        },
      },
    })
  })

  // Send confirmation email
  await emailQueue.add(EMAIL_JOBS.SEND_REFUND_CONFIRMATION, {
    to: (refund as any).user?.email,
    name: (refund as any).user?.name,
    userId: refund.userId,
    productName: "Your product",
    refundAmount: String(refund.refundAmount ?? "0"),
    currency: "USD",
    gateway: refund.gateway ?? "Payment Gateway",
    gatewayRefundId: gatewayRefundId ?? refund.gatewayRefundId ?? undefined,
    estimatedDays: "5-7",
  })

  logger.info({ refundId, adminId, gatewayRefundId }, "Refund approved by admin")

  return NextResponse.json({
    success: true,
    refundId,
    status: "PROCESSED",
    gatewayRefundId: gatewayRefundId ?? refund.gatewayRefundId,
  })
}
