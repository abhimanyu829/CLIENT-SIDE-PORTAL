import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { razorpay } from "@/lib/razorpay"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import { PaymentStatus } from "@prisma/client"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

const refundSchema = z.object({
  paymentId: z.string().min(1),                    // internal DB payment ID
  amount: z.number().positive().optional(),         // partial refund amount; omit for full refund
  reason: z.string().max(500).optional(),
})

// POST /api/admin/users/[id]/refund
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await context.params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const parsed = refundSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }
    const { paymentId, amount, reason } = parsed.data

    // Verify the payment belongs to this user
    const payment = await db.payment.findUnique({ where: { id: paymentId } })
    if (!payment || payment.userId !== userId) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Payment not found for this user" } }, { status: 404 })
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Payment already refunded" } }, { status: 409 })
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Only successful payments can be refunded" } }, { status: 400 })
    }

    let gatewayRefundId: string | undefined

    // Issue refund via appropriate gateway
    if (payment.gateway === "STRIPE" && stripe && payment.gatewayPaymentId) {
      const refundAmountCents = amount
        ? Math.round(amount * 100)
        : undefined // undefined = full refund on Stripe

      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.gatewayPaymentId,
        ...(refundAmountCents ? { amount: refundAmountCents } : {}),
        reason: "requested_by_customer",
        metadata: { adminId: session.user.id, reason: reason ?? "Admin manual refund" },
      })
      gatewayRefundId = stripeRefund.id
    } else if (payment.gateway === "RAZORPAY" && payment.gatewayPaymentId) {
      const razorpayRefund = await razorpay.payments.refund(payment.gatewayPaymentId, {
        amount: amount ? Math.round(amount * 100) : Math.round(Number(payment.amount) * 100),
        notes: { reason: reason ?? "Admin manual refund", adminId: session.user.id },
      })
      gatewayRefundId = (razorpayRefund as any).id
    }

    // Mark payment as refunded in DB
    await db.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED },
    })

    await auditLog({
      userId: session.user.id,
      action: "admin.manual_refund",
      entity: "Payment",
      entityId: paymentId,
      after: {
        refundAmount: amount ?? payment.amount,
        currency: payment.currency,
        gateway: payment.gateway,
        gatewayRefundId,
        reason,
      },
    })

    await createNotification({
      userId,
      type: "PAYMENT",
      title: "Refund Processed",
      body: `A refund of ${amount ?? Number(payment.amount)} ${payment.currency} has been issued. It will appear in 5–7 business days.`,
      actionUrl: "/dashboard/invoices",
    })

    return NextResponse.json({
      success: true,
      data: {
        paymentId,
        refundedAmount: amount ?? Number(payment.amount),
        currency: payment.currency,
        gatewayRefundId,
      },
    })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/users/[id]/refund")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
