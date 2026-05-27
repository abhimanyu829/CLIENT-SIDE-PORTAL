import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import crypto from "crypto"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { SubStatus, PaymentStatus, BillingInterval } from "@prisma/client"
import { invoiceQueue, notifQueue, emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { createNotification } from "@/lib/notifications"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { auditLog } from "@/lib/audit"
import { markOrderPaid, markOrderPaymentFailed } from "@/lib/services/enterprise-commerce-service"
import { markSubscriptionPastDue, revokeUserAccessForOrder, syncSubscriptionAccessState, cancelSubscription } from "@/lib/services/subscription-service"

function intervalEnd(interval: BillingInterval | string): Date {
  const end = new Date()
  if (interval === BillingInterval.YEARLY) end.setFullYear(end.getFullYear() + 1)
  else if (interval === BillingInterval.WEEKLY) end.setDate(end.getDate() + 7)
  else end.setMonth(end.getMonth() + 1)
  return end
}

// ── Signature verification ────────────────────────────────────────────────────
function verifyRazorpayWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex")
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))
}

// ── Handler: payment.captured ─────────────────────────────────────────────────
async function handlePaymentCaptured(payload: any) {
  const payment = payload.payload?.payment?.entity
  if (!payment) return

  const { id: gatewayPaymentId, order_id, amount, currency, notes, subscription_id } = payment
  const orderId = notes?.orderId as string | undefined
  const userId = notes?.userId as string | undefined
  const tierId = notes?.tierId as string | undefined
  const razorpaySubId = subscription_id as string | undefined

  if (orderId) {
    await markOrderPaid(orderId, gatewayPaymentId, order_id)
    return
  }

  if (!userId || !tierId) {
    logger.warn({ gatewayPaymentId }, "Missing notes on Razorpay payment")
    return
  }

  const existing = await db.payment.findUnique({ where: { gatewayPaymentId } })
  if (existing) return

  const tier = await db.productTier.findUnique({
    where: { id: tierId },
    select: { productId: true, interval: true },
  })
  if (!tier) return

  const periodEnd = intervalEnd(tier.interval)

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

  const existingSub = await db.subscription.findFirst({ where: { userId, tierId } })
  if (!existingSub) {
    const createdSub = await db.subscription.create({
      data: {
        userId,
        tierId,
        productId: tier.productId,
        status: SubStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        razorpaySubId: razorpaySubId ?? undefined,
      },
    })
    await syncSubscriptionAccessState(createdSub.id)
  } else {
    await db.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: SubStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        razorpaySubId: razorpaySubId ?? undefined,
      },
    })
    await syncSubscriptionAccessState(existingSub.id)
  }

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
  const orderId = notes?.orderId as string | undefined
  const userId = notes?.userId as string | undefined
  if (!userId && !orderId) return

  await markOrderPaymentFailed({
    orderId,
    userId,
    gatewayOrderId: order_id,
    gatewayPaymentId,
    amount: amount / 100,
    currency: currency.toUpperCase(),
    reason: error_description ?? "Payment failed",
  })

  if (!userId) return

  // Trigger dunning if there's an active subscription for this user
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAST_DUE"] } },
  })
  if (sub) {
    await markSubscriptionPastDue(sub.id, userId, error_description ?? "Razorpay payment failed")
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
  await syncSubscriptionAccessState(localSub.id)

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

  await markSubscriptionPastDue(localSub.id, localSub.userId, "Razorpay subscription halted")

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
  if (payment.orderId) {
    await revokeUserAccessForOrder(payment.orderId, payment.userId, "Razorpay refund processed")
  }

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

  await emitEvent({
    type: EVENTS.REFUND_PROCESSED,
    timestamp: new Date().toISOString(),
    actorId: payment.userId,
    payload: { paymentId: payment.id, amount: refund.amount / 100 },
  })
}

// ── Handler: subscription.activated ──────────────────────────────────────────
async function handleSubscriptionActivated(payload: any) {
  const sub = payload.payload?.subscription?.entity
  if (!sub) return

  const localSub = await db.subscription.findUnique({ where: { razorpaySubId: sub.id } })
  if (!localSub) {
    logger.warn({ razorpaySubId: sub.id }, "Razorpay subscription activated but no local record found")
    return
  }

  await db.subscription.update({
    where: { id: localSub.id },
    data: {
      status: SubStatus.ACTIVE,
      currentPeriodStart: new Date(sub.current_start ? sub.current_start * 1000 : Date.now()),
      currentPeriodEnd: new Date(sub.current_end ? sub.current_end * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  await syncSubscriptionAccessState(localSub.id)

  await emitEvent({
    type: EVENTS.SUBSCRIPTION_ACTIVATED,
    timestamp: new Date().toISOString(),
    actorId: localSub.userId,
    payload: { subscriptionId: localSub.id, userId: localSub.userId },
  })

  try {
    await emailQueue.add(EMAIL_JOBS.SEND_WELCOME, {
      userId: localSub.userId,
      type: "subscription-activated",
      subscriptionId: localSub.id,
    })
  } catch {}
}

// ── Handler: subscription.cancelled ──────────────────────────────────────────
async function handleSubscriptionCancelled(payload: any) {
  const sub = payload.payload?.subscription?.entity
  if (!sub) return

  const localSub = await db.subscription.findUnique({ where: { razorpaySubId: sub.id } })
  if (!localSub) return

  await cancelSubscription(localSub.id, localSub.userId, "Razorpay subscription cancelled")

  await createNotification({
    userId: localSub.userId,
    type: "SUBSCRIPTION",
    title: "Subscription Cancelled",
    body: "Your subscription has been cancelled as requested. Access will remain until the end of your billing period.",
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: subscription.paused ─────────────────────────────────────────────
async function handleSubscriptionPaused(payload: any) {
  const sub = payload.payload?.subscription?.entity
  if (!sub) return

  const localSub = await db.subscription.findUnique({ where: { razorpaySubId: sub.id } })
  if (!localSub) return

  await db.subscription.update({
    where: { id: localSub.id },
    data: { status: SubStatus.PAUSED },
  })
  await syncSubscriptionAccessState(localSub.id)

  await emitEvent({
    type: EVENTS.SUBSCRIPTION_PAUSED,
    timestamp: new Date().toISOString(),
    actorId: localSub.userId,
    payload: { subscriptionId: localSub.id, userId: localSub.userId },
  })

  await createNotification({
    userId: localSub.userId,
    type: "SUBSCRIPTION",
    title: "Subscription Paused",
    body: "Your subscription has been paused. Reactivate it anytime to restore access.",
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: subscription.resumed ────────────────────────────────────────────
async function handleSubscriptionResumed(payload: any) {
  const sub = payload.payload?.subscription?.entity
  if (!sub) return

  const localSub = await db.subscription.findUnique({ where: { razorpaySubId: sub.id } })
  if (!localSub) return

  await db.subscription.update({
    where: { id: localSub.id },
    data: {
      status: SubStatus.ACTIVE,
      currentPeriodStart: new Date(sub.current_start ? sub.current_start * 1000 : Date.now()),
      currentPeriodEnd: new Date(sub.current_end ? sub.current_end * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  await syncSubscriptionAccessState(localSub.id)

  await emitEvent({
    type: EVENTS.SUBSCRIPTION_REACTIVATED,
    timestamp: new Date().toISOString(),
    actorId: localSub.userId,
    payload: { subscriptionId: localSub.id, userId: localSub.userId },
  })

  await createNotification({
    userId: localSub.userId,
    type: "SUBSCRIPTION",
    title: "Subscription Reactivated",
    body: "Your subscription is active again. All features and entitlements have been restored.",
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: dispute.created ─────────────────────────────────────────────────
async function handleDisputeCreated(payload: any) {
  const dispute = payload.payload?.dispute?.entity
  if (!dispute) return

  const payment = await db.payment.findFirst({
    where: { gatewayPaymentId: dispute.payment_id },
  })
  if (!payment) return

  await db.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.DISPUTED },
  })

  await auditLog({
    action: "razorpay.dispute.created",
    entity: "Payment",
    entityId: payment.id,
    after: {
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      reason: dispute.dispute_reason ?? "Unknown",
      status: dispute.status,
    },
  })

  await createNotification({
    userId: payment.userId,
    type: "PAYMENT",
    title: "Payment Disputed",
    body: `A dispute has been raised for your payment of ₹${(dispute.amount / 100).toFixed(2)}. Our team will review and respond.`,
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Main webhook handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  console.log("[RAZORPAY WEBHOOK] 📨 Incoming webhook request")
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("x-razorpay-signature") ?? ""
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET ?? ""

  if (!webhookSecret) {
    console.error("[RAZORPAY WEBHOOK] ❌ RAZORPAY_WEBHOOK_SECRET not set — REJECTING webhook")
    logger.error("RAZORPAY_WEBHOOK_SECRET not set — REJECTING webhook")
    return new NextResponse("Webhook secret not configured", { status: 500 })
  }

  if (!verifyRazorpayWebhookSignature(body, signature, webhookSecret)) {
    console.error("[RAZORPAY WEBHOOK] ❌ Signature verification FAILED — rejecting")
    logger.error("Razorpay webhook signature mismatch")
    return new NextResponse("Invalid signature", { status: 400 })
  }

  console.log("[RAZORPAY WEBHOOK] ✅ Signature verified")

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 })
  }

  const eventType: string = event.event ?? ""
  console.log(`[RAZORPAY WEBHOOK] 📋 Event type: ${eventType}`)

  const rzpEventId =
    event.payload?.payment?.entity?.id ??
    event.payload?.subscription?.entity?.id ??
    event.payload?.refund?.entity?.id ??
    event.payload?.order?.entity?.id ??
    headersList.get("x-razorpay-event-id") ??
    `rzp_${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  logger.info({ type: eventType }, "Razorpay webhook received")

  // ── Idempotency check via WebhookEvent table ──────────────────────────────
  let webhookRecord = await db.webhookEvent.findUnique({ where: { eventId: rzpEventId } })

  if (webhookRecord?.status === "PROCESSED") {
    logger.info({ eventId: rzpEventId }, "Razorpay webhook already processed — skipping")
    console.log(`[RAZORPAY WEBHOOK] ⏭️ Already processed event: ${rzpEventId}`)
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
    console.log(`[RAZORPAY WEBHOOK] 🔄 Processing event: ${eventType}`)
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
      case "subscription.activated":
        await handleSubscriptionActivated(event)
        break
      case "subscription.cancelled":
        await handleSubscriptionCancelled(event)
        break
      case "subscription.paused":
        await handleSubscriptionPaused(event)
        break
      case "subscription.resumed":
        await handleSubscriptionResumed(event)
        break
      case "dispute.created":
        await handleDisputeCreated(event)
        break
      default:
        logger.info({ type: eventType }, "Unhandled Razorpay event — skipped")
    }

    await db.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    })
    console.log(`[RAZORPAY WEBHOOK] ✅ Event processed successfully: ${eventType}`)
  } catch (error) {
    logger.error({ error, eventType }, "Error handling Razorpay webhook event")
    console.error(`[RAZORPAY WEBHOOK] ❌ Error processing event ${eventType}:`, error)
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
