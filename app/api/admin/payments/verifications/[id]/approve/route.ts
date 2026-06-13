import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { markOrderPaid, markOrderPaymentFailed, fulfillOrder } from "@/lib/services/enterprise-commerce-service"
import {
  compareManualPaymentReview,
  logManualPaymentAudit,
  formatMoney,
} from "@/lib/services/manual-payment-verification"
import { z } from "zod"

const reviewSchema = z.object({
  actualTransactionId: z.string().min(4),
  actualAmount: z.number().positive(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = await requireSuperAdmin()
    const body = reviewSchema.parse(await req.json())
    const verification = await db.paymentVerification.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, slug: true } },
                tier: { select: { id: true, name: true, interval: true } },
              },
            },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    })
    if (!verification) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 })

    if (verification.verificationStatus !== "AWAITING_VERIFICATION") {
      return NextResponse.json({ success: false, error: { message: "Already processed" } }, { status: 400 })
    }

    const orderSnapshot = {
      id: verification.order.id,
      orderNumber: verification.order.orderNumber,
      status: verification.order.status,
      grandTotal: Number(verification.order.grandTotal),
      currency: verification.order.currency,
      user: verification.order.user,
      items: verification.order.items,
    }

    const verificationSnapshot = {
      id: verification.id,
      orderId: verification.orderId,
      userId: verification.userId,
      utrNumber: verification.utrNumber,
      claimedAmount: verification.claimedAmount ? Number(verification.claimedAmount) : null,
      screenshotUrl: verification.screenshotUrl,
      reviewAttemptCount: verification.reviewAttemptCount,
      mismatchReason: verification.mismatchReason,
      verificationStatus: verification.verificationStatus,
    }

    const comparison = compareManualPaymentReview(orderSnapshot, verificationSnapshot, body)

    if (!comparison.matched) {
      const attemptCount = verification.reviewAttemptCount + 1
      const mismatchReason = comparison.issues.join(" ")
      const nextState = {
        adminTransactionId: body.actualTransactionId,
        adminActualAmount: body.actualAmount,
        mismatchReason,
        lastReviewedAt: new Date(),
        reviewAttemptCount: attemptCount,
      }

      if (attemptCount < 2) {
        await db.paymentVerification.update({
          where: { id: verification.id },
          data: nextState,
        })

        await logManualPaymentAudit({
          action: "manual_payment.recheck_requested",
          orderId: verification.orderId,
          orderNumber: verification.order.orderNumber,
          userId: verification.userId,
          verificationId: verification.id,
          adminUserId: admin.userId,
          before: {
            reviewAttemptCount: verification.reviewAttemptCount,
          },
          after: {
            reviewAttemptCount: attemptCount,
            mismatchReason,
            adminTransactionId: body.actualTransactionId,
            adminActualAmount: formatMoney(body.actualAmount),
          },
          req,
        }).catch(() => {})

        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RECHECK_REQUIRED",
              message: "Recheck and refill the transaction details, then submit once more.",
              details: comparison.issues,
            },
            data: {
              verification: {
                ...verification,
                ...nextState,
              },
            },
          },
          { status: 409 }
        )
      }

      await db.$transaction(async (tx) => {
        await tx.paymentVerification.update({
          where: { id: verification.id },
          data: {
            verificationStatus: "REJECTED",
            verifiedAt: new Date(),
            verifiedBy: admin.userId,
            ...nextState,
          },
        })
        await tx.order.update({
          where: { id: verification.orderId },
          data: {
            status: "CANCELLED",
          },
        })
      })

      await markOrderPaymentFailed({
        orderId: verification.orderId,
        reason: mismatchReason,
      }).catch(() => {})
      await logManualPaymentAudit({
        action: "manual_payment.failed",
        orderId: verification.orderId,
        orderNumber: verification.order.orderNumber,
        userId: verification.userId,
        verificationId: verification.id,
        adminUserId: admin.userId,
        before: {
          reviewAttemptCount: verification.reviewAttemptCount,
        },
        after: {
          reviewAttemptCount: attemptCount,
          mismatchReason,
          adminTransactionId: body.actualTransactionId,
          adminActualAmount: formatMoney(body.actualAmount),
          result: "FAILED",
        },
        req,
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        data: {
          status: "FAILED",
          message: "Payment failed after revalidation. Activation was denied.",
          details: comparison.issues,
        },
      })
    }

    await db.paymentVerification.update({
      where: { id: verification.id },
      data: {
        verificationStatus: "APPROVED",
        verifiedAt: new Date(),
        verifiedBy: admin.userId,
        adminTransactionId: body.actualTransactionId,
        adminActualAmount: body.actualAmount,
        mismatchReason: null,
        lastReviewedAt: new Date(),
      }
    })

    await logManualPaymentAudit({
      action: "manual_payment.approved",
      orderId: verification.orderId,
      orderNumber: verification.order.orderNumber,
      userId: verification.userId,
      verificationId: verification.id,
      adminUserId: admin.userId,
      before: {
        reviewAttemptCount: verification.reviewAttemptCount,
      },
        after: {
          verificationStatus: "APPROVED",
          adminTransactionId: body.actualTransactionId,
          adminActualAmount: formatMoney(body.actualAmount),
          claimedAmount: formatMoney(verification.claimedAmount ? Number(verification.claimedAmount) : 0),
        },
        req,
      }).catch(() => {})

    // Mark paid and fulfill
    await markOrderPaid(verification.orderId, `manual_${verification.utrNumber}`, `manual_${verification.orderId}`)
    await fulfillOrder(verification.orderId).catch(err => console.error("Fulfill error:", err))

    return NextResponse.json({
      success: true,
      data: {
        status: "APPROVED",
      },
    })
  } catch (err: any) {
    console.error("[APPROVE UTR]", err)
    return NextResponse.json({ success: false, error: { message: err.message } }, { status: 500 })
  }
}
