import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { markOrderPaymentFailed } from "@/lib/services/enterprise-commerce-service"
import { logManualPaymentAudit } from "@/lib/services/manual-payment-verification"
import { createNotification } from "@/lib/notifications"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = await requireSuperAdmin()

    // Parse optional reason from body
    let rejectionReason = "Rejected by admin"
    try {
      const body = await req.json()
      if (body?.reason) rejectionReason = String(body.reason)
    } catch {
      // Body is optional — use default reason
    }

    const verification = await db.paymentVerification.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            items: {
              select: {
                product: { select: { name: true } },
              },
            },
          },
        },
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
          verifiedBy: admin.userId,
          mismatchReason: rejectionReason,
          lastReviewedAt: new Date(),
        },
      })
      await tx.order.update({
        where: { id: verification.orderId },
        data: { status: "PENDING" }, // revert so user can resubmit
      })
    })

    await markOrderPaymentFailed({ orderId: verification.orderId, reason: "Manual UTR Rejected" })

    // Notify the user their payment was denied
    await createNotification({
      userId: verification.userId,
      type: "PAYMENT",
      title: "Payment verification denied",
      body: `Your payment proof for order ${verification.order.orderNumber} was rejected. Reason: ${rejectionReason}. Please resubmit with a valid UTR or contact support.`,
      actionUrl: `/checkout/failure?error=PAYMENT_DENIED&orderId=${verification.orderId}&message=${encodeURIComponent(rejectionReason)}`,
    }).catch((err) => {
      console.error("[REJECT UTR] Failed to notify user", err)
    })

    // Push real-time event to user's Pusher channel so the waiting page reacts immediately
    try {
      const { pusherServer } = await import("@/lib/pusher")
      await pusherServer.trigger(`private-user-${verification.userId}`, "payment.rejected", {
        orderId: verification.orderId,
        orderNumber: verification.order.orderNumber,
        reason: rejectionReason,
        redirectUrl: `/checkout/failure?error=PAYMENT_DENIED&orderId=${verification.orderId}&message=${encodeURIComponent(rejectionReason)}`,
      })
    } catch (pusherErr) {
      console.error("[REJECT UTR] Pusher trigger failed (non-fatal)", pusherErr)
    }

    await logManualPaymentAudit({
      action: "manual_payment.rejected",
      orderId: verification.orderId,
      orderNumber: verification.order.orderNumber,
      userId: verification.userId,
      verificationId: verification.id,
      adminUserId: admin.userId,
      after: { result: "REJECTED", reason: rejectionReason },
      req,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[REJECT UTR]", err)
    return NextResponse.json({ success: false, error: { message: err.message } }, { status: 500 })
  }
}
