import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { markOrderPaymentFailed } from "@/lib/services/enterprise-commerce-service"
import { logManualPaymentAudit } from "@/lib/services/manual-payment-verification"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = await requireSuperAdmin()
    const verification = await db.paymentVerification.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNumber: true } },
      },
    })
    if (!verification) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 })

    if (verification.verificationStatus !== "AWAITING_VERIFICATION") {
      return NextResponse.json({ success: false, error: { message: "Already processed" } }, { status: 400 })
    }

    await db.$transaction(async (tx) => {
      await tx.paymentVerification.update({
        where: { id: verification.id },
        data: {
          verificationStatus: "REJECTED",
          verifiedAt: new Date(),
          mismatchReason: "Rejected by admin",
          lastReviewedAt: new Date(),
        }
      })
      await tx.order.update({
        where: { id: verification.orderId },
        data: { status: "PENDING" } // revert back so user can try again
      })
    })

    await markOrderPaymentFailed({ orderId: verification.orderId, reason: "Manual UTR Rejected" })
    await logManualPaymentAudit({
      action: "manual_payment.rejected",
      orderId: verification.orderId,
      orderNumber: verification.order.orderNumber,
      userId: verification.userId,
      verificationId: verification.id,
      adminUserId: admin.userId,
      after: { result: "REJECTED" },
      req,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[REJECT UTR]", err)
    return NextResponse.json({ success: false, error: { message: err.message } }, { status: 500 })
  }
}
