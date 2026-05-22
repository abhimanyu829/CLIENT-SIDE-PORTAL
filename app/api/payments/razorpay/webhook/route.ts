import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import crypto from "crypto"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { SubStatus, PaymentStatus } from "@prisma/client"
import { invoiceQueue, notifQueue } from "@/lib/queue"
import { createNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"

// ── Signature verification ────────────────────────────────────────────────────
function verifyRazorpayWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex")
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))
}

// ── Handler: payment.captured ─────────────────────────────────────────────────
async function handlePaymentCaptured(payload: any) {
  const payment = payload.payload?.payment?.entity
  if (!payment) return

  const { id: gatewayPaymentId, order_id, amount, currency, notes } = payment
  const userId = notes?.userId as string | undefined
  const tierId = notes?.tierId as string | undefined

  if (!userId || !tierId) {
    logger.warn({ gatewayPaymentId }, "Missing notes on Razorpay payment")
    return
  }

  // Idempotency: skip if payment already recorded
  const existing = await db.payment.findUnique({ where: { gatewayPaymentId } })
  if (existing) return

  const tier = await db.productTier.findUnique({ where: { id: tierId }, select: { productId: true } })
  if (!tier) return

  // Record payment
  const dbPayment = await db.payment.create({
    data: {
      userId,
      amount: amount / 100,
      currency: currency.toUpperCase(),
      status: PaymentStatus.SUCCESS,
      gateway: "RAZORPAY",
      gatewayPaymentId,
      gatewayOrderId: order_id,
      paidAt: new Date(),
    },
  })

  // Create or update subscription
  const existingSub = await db.subscription.findFirst({ where: { userId, tierId } })
  if (!existingSub) {
    await db.subscription.create({
      data: {
        userId,
        tierId,
        productId: tier.productId,
        status: SubStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  } else {
    await db.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: SubStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  // Queue invoice generation
  await invoiceQueue.add("generate.invoice", { paymentId: dbPayment.id, userId })

  await createNotification({
    userId,
    type: "PAYMENT",
    title: "Payment Successful 🎉",
    body: `Your payment of ₹${(amount / 100).toFixed(2)} was captured. Your subscription is now active.`,
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: payment.failed ───────────────────────────────────────────────────
async function handlePaymentFailed(payload: any) {
  const payment = payload.payload?.payment?.entity
  if (!payment) return

  const { id: gatewayPaymentId, order_id, amount, currency, notes, error_description } = payment
  const userId = notes?.userId as string | undefined
  if (!userId) return

  await db.payment.create({
    data: {
      userId,
      amount: amount / 100,
      currency: currency.toUpperCase(),
      status: PaymentStatus.FAILED,
      gateway: "RAZORPAY",
      gatewayPaymentId,
      gatewayOrderId: order_id,
      failureReason: error_description ?? "Payment failed",
    },
  })

  // Trigger dunning if there's an active subscription for this user
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAST_DUE"] } },
  })
  if (sub) {
    await db.subscription.update({ where: { id: sub.id }, data: { status: SubStatus.PAST_DUE } })
    await notifQueue.add("dunning.start", { subscriptionId: sub.id, userId }, { delay: 0 })
  }

  await createNotification({
    userId,
    type: "PAYMENT",
    title: "Payment Failed",
    body: `Your payment of ₹${(amount / 100).toFixed(2)} failed. ${error_description ?? "Please try again."}`,
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: subscription.charged ────────────────────────────────────────────
async function handleSubscriptionCharged(payload: any) {
  const sub = payload.payload?.subscription?.entity
  const payment = payload.payload?.payment?.entity
  if (!sub || !payment) return

  const localSub = await db.subscription.findUnique({ where: { razorpaySubId: sub.id } })
  if (!localSub) return

  await db.subscription.update({
    where: { id: localSub.id },
    data: {
      status: SubStatus.ACTIVE,
      currentPeriodStart: new Date(sub.current_start * 1000),
      currentPeriodEnd: new Date(sub.current_end * 1000),
    },
  })

  const dbPayment = await db.payment.create({
    data: {
      userId: localSub.userId,
      subscriptionId: localSub.id,
      amount: payment.amount / 100,
      currency: (payment.currency as string).toUpperCase(),
      status: PaymentStatus.SUCCESS,
      gateway: "RAZORPAY",
      gatewayPaymentId: payment.id,
      paidAt: new Date(),
    },
  })

  await invoiceQueue.add("generate.invoice", { paymentId: dbPayment.id, userId: localSub.userId })
}

// ── Handler: subscription.halted ─────────────────────────────────────────────
async function handleSubscriptionHalted(payload: any) {
  const sub = payload.payload?.subscription?.entity
  if (!sub) return

  const localSub = await db.subscription.findUnique({ where: { razorpaySubId: sub.id } })
  if (!localSub) return

  await db.subscription.update({
    where: { id: localSub.id },
    data: { status: SubStatus.PAST_DUE },
  })

  await notifQueue.add("dunning.start", { subscriptionId: localSub.id, userId: localSub.userId }, { delay: 0 })

  await createNotification({
    userId: localSub.userId,
    type: "SUBSCRIPTION",
    title: "Subscription Paused — Action Required",
    body: "Multiple payment attempts failed. Please update your payment details to restore access.",
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: refund.processed ────────────────────────────────────────────────
async function handleRefundProcessed(payload: any) {
  const refund = payload.payload?.refund?.entity
  if (!refund) return

  const payment = await db.payment.findFirst({ where: { gatewayPaymentId: refund.payment_id } })
  if (!payment) return

  await db.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REFUNDED } })

  await auditLog({
    action: "razorpay.refund.processed",
    entity: "Payment",
    entityId: payment.id,
    after: { refundId: refund.id, amount: refund.amount / 100, currency: refund.currency },
  })

  await createNotification({
    userId: payment.userId,
    type: "PAYMENT",
    title: "Refund Processed",
    body: `Your refund of ₹${(refund.amount / 100).toFixed(2)} has been processed and will reflect in 5–7 business days.`,
    actionUrl: "/dashboard/invoices",
  })
}

// ── Main webhook handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("x-razorpay-signature") ?? ""
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET ?? ""

  if (!webhookSecret) {
    logger.warn("RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification")
  } else if (!verifyRazorpayWebhookSignature(body, signature, webhookSecret)) {
    logger.error("Razorpay webhook signature mismatch")
    return new NextResponse("Invalid signature", { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 })
  }

  const eventType: string = event.event ?? ""
  // Razorpay uses account_id + event + timestamp as a deterministic event ID
  const rzpEventId =
    event.payload?.payment?.entity?.id ??
    event.payload?.subscription?.entity?.id ??
    event.payload?.refund?.entity?.id ??
    `rzp_${eventType}_${Date.now()}`

  logger.info({ type: eventType }, "Razorpay webhook received")

  // ── Idempotency check via WebhookEvent table ──────────────────────────────
  let webhookRecord = await db.webhookEvent.findUnique({ where: { eventId: rzpEventId } })

  if (webhookRecord?.status === "PROCESSED") {
    logger.info({ eventId: rzpEventId }, "Razorpay webhook already processed — skipping")
    return NextResponse.json({ received: true, idempotent: true })
  }

  if (!webhookRecord) {
    webhookRecord = await db.webhookEvent.create({
      data: {
        source: "RAZORPAY",
        eventType,
        eventId: rzpEventId,
        payload: event,
        status: "PENDING",
        attempts: 1,
        lastAttemptAt: new Date(),
      },
    })
  } else {
    await db.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        status: "PENDING",
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        errorMessage: null,
      },
    })
  }

  try {
    switch (eventType) {
      case "payment.captured":
        await handlePaymentCaptured(event)
        break
      case "payment.failed":
        await handlePaymentFailed(event)
        break
      case "subscription.charged":
        await handleSubscriptionCharged(event)
        break
      case "subscription.halted":
        await handleSubscriptionHalted(event)
        break
      case "refund.processed":
        await handleRefundProcessed(event)
        break
      default:
        logger.info({ type: eventType }, "Unhandled Razorpay event — skipped")
    }

    await db.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    })
  } catch (error) {
    logger.error({ error, eventType }, "Error handling Razorpay webhook event")
    const currentAttempts = (webhookRecord.attempts ?? 0) + 1
    await db.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        status: currentAttempts >= 5 ? "DEAD" : "FAILED",
        errorMessage: (error as Error).message?.slice(0, 500) ?? "Unknown error",
      },
    })
  }

  return NextResponse.json({ received: true })
}

