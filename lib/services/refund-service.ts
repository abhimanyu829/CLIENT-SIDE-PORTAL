import { PaymentStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { getRazorpay } from "@/lib/razorpay"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { logger } from "@/lib/logger"
import { revokeUserAccessForOrder } from "@/lib/services/subscription-service"

export interface RefundResult {
  success: boolean
  refundId?: string
  amount: number
  error?: string
}

export async function processRefund(
  paymentId: string,
  refundAmount: number,
  reason: string,
  adminId: string
): Promise<RefundResult> {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { invoice: true, subscription: { include: { product: true } } },
  })

  if (payment.status === PaymentStatus.REFUNDED) {
    return { success: false, amount: 0, error: "Payment already refunded" }
  }
  if (payment.status !== PaymentStatus.SUCCESS) {
    return { success: false, amount: 0, error: "Only successful payments can be refunded" }
  }

  const actualRefund = Math.min(refundAmount, Number(payment.amount))
  let gatewayRefundId: string | undefined

  try {
    if (payment.gateway === "STRIPE" && payment.gatewayPaymentId && stripe) {
      const refund = await stripe.refunds.create({
        payment_intent: payment.gatewayPaymentId,
        amount: Math.round(actualRefund * 100),
        reason: "requested_by_customer",
        metadata: { adminId, reason, adminPaymentId: paymentId },
      })
      gatewayRefundId = refund.id
    } else if (payment.gateway === "RAZORPAY" && payment.gatewayPaymentId) {
      const razorpay = getRazorpay()
      if (!razorpay) return { success: false, amount: 0, error: "Razorpay is not configured" }
      const refund = await (razorpay as any).payments.refund(payment.gatewayPaymentId, {
        amount: Math.round(actualRefund * 100),
        speed: "normal",
        notes: { adminId, reason, adminPaymentId: paymentId },
      })
      gatewayRefundId = refund.id
    }
  } catch (err) {
    logger.error({ err, paymentId }, "Gateway refund failed")
    return { success: false, amount: 0, error: `Gateway refund failed: ${(err as Error).message}` }
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        failureReason: `Refunded by admin ${adminId}: ${reason}`,
      },
    })

    if (payment.invoice) {
      await tx.invoice.update({
        where: { id: payment.invoice.id },
        data: { status: "REFUNDED" },
      })
    }

    if (payment.orderId) {
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: "REFUNDED" },
      })
    }

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "REFUND_PROCESSED",
        entity: "Payment",
        entityId: paymentId,
        beforeJson: { status: payment.status, amount: String(payment.amount) },
        afterJson: {
          status: "REFUNDED",
          refundAmount: actualRefund,
          gatewayRefundId,
          reason,
          adminId,
        },
      },
    })
  })

  await emitEvent({
    type: EVENTS.REFUND_PROCESSED,
    timestamp: new Date().toISOString(),
    actorId: adminId,
    payload: {
      paymentId,
      userId: payment.userId,
      amount: actualRefund,
      gatewayRefundId,
      gateway: payment.gateway,
      reason,
    },
  })

  if (payment.orderId) {
    await revokeUserAccessForOrder(payment.orderId, adminId, `Refund processed: ${reason}`)
  }

  logger.info({ paymentId, gatewayRefundId, amount: actualRefund, adminId }, "Refund processed")
  return { success: true, refundId: gatewayRefundId, amount: actualRefund }
}
