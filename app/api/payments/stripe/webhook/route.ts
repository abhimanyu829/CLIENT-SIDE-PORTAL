import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { SubStatus, PaymentStatus } from "@prisma/client"
import { emailQueue, invoiceQueue, notifQueue } from "@/lib/queue"
import { createNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"

// ── Handler: checkout.session.completed ──────────────────────────────────────
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (!stripe) return
  const { userId, tierId } = session.metadata ?? {}
  if (!userId || !tierId) {
    logger.warn({ session }, "Missing metadata on checkout session")
    return
  }

  const tier = await db.productTier.findUnique({ where: { id: tierId }, select: { productId: true } })
  if (!tier) return

  // Idempotency: skip if subscription already exists for this Stripe sub
  const stripeSubId = session.subscription as string | null
  if (stripeSubId) {
    const existing = await db.subscription.findUnique({ where: { stripeSubId } })
    if (existing) return
  }

  const stripeSubscription = stripeSubId
    ? await stripe.subscriptions.retrieve(stripeSubId)
    : null

  // Create local subscription record
  const sub = await db.subscription.create({
    data: {
      userId,
      tierId,
      productId: tier.productId,
      stripeSubId: stripeSubId ?? undefined,
      status: SubStatus.ACTIVE,
      currentPeriodStart: stripeSubscription
        ? new Date(stripeSubscription.current_period_start * 1000)
        : new Date(),
      currentPeriodEnd: stripeSubscription
        ? new Date(stripeSubscription.current_period_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  // Queue invoice PDF generation
  if (session.payment_intent) {
    await invoiceQueue.add("generate.invoice", {
      paymentId: session.payment_intent,
      userId,
    })
  }

  // Send welcome email
  await emailQueue.add("send.welcome", { userId, subscriptionId: sub.id })

  await createNotification({
    userId,
    type: "SUBSCRIPTION",
    title: "Subscription Activated 🎉",
    body: "Your payment was successful and your subscription is now active.",
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: invoice.payment_succeeded ───────────────────────────────────────
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!stripe) return
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)

  const localSub = await db.subscription.findUnique({ where: { stripeSubId: stripeSubscription.id } })
  if (!localSub) {
    logger.warn({ stripeSubId: stripeSubscription.id }, "No local subscription found for invoice.payment_succeeded")
    return
  }

  await db.subscription.update({
    where: { stripeSubId: stripeSubscription.id },
    data: {
      status: SubStatus.ACTIVE,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    },
  })

  await emailQueue.add("send.renewal", {
    email: invoice.customer_email,
    invoiceUrl: invoice.hosted_invoice_url,
  })
}

// ── Handler: invoice.payment_failed ──────────────────────────────────────────
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  const localSub = await db.subscription.findUnique({ where: { stripeSubId: subscriptionId } })
  if (!localSub) return

  // Mark subscription as past_due
  await db.subscription.update({
    where: { id: localSub.id },
    data: { status: SubStatus.PAST_DUE },
  })

  // Record failed payment
  await db.payment.create({
    data: {
      userId: localSub.userId,
      subscriptionId: localSub.id,
      amount: invoice.amount_due / 100,
      currency: invoice.currency.toUpperCase(),
      status: PaymentStatus.FAILED,
      gateway: "STRIPE",
      gatewayOrderId: invoice.id,
      failureReason: "Invoice payment failed",
    },
  })

  // Enqueue dunning sequence
  await notifQueue.add(
    "dunning.start",
    { subscriptionId: localSub.id, userId: localSub.userId },
    { delay: 0 }
  )

  await createNotification({
    userId: localSub.userId,
    type: "PAYMENT",
    title: "Payment Failed",
    body: "We couldn't process your subscription payment. Please update your payment method.",
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: payment_intent.payment_failed ───────────────────────────────────
async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  const userId = pi.metadata?.userId
  if (!userId) return

  await db.payment.create({
    data: {
      userId,
      amount: pi.amount / 100,
      currency: pi.currency.toUpperCase(),
      status: PaymentStatus.FAILED,
      gateway: "STRIPE",
      gatewayPaymentId: pi.id,
      failureReason: pi.last_payment_error?.message ?? "Unknown error",
    },
  })

  await createNotification({
    userId,
    type: "PAYMENT",
    title: "Payment Failed",
    body: `Your payment of ${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()} failed. ${pi.last_payment_error?.message ?? ""}`,
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: customer.subscription.updated ───────────────────────────────────
async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const localSub = await db.subscription.findUnique({ where: { stripeSubId: stripeSub.id } })
  if (!localSub) return

  // Map Stripe status → local SubStatus
  const statusMap: Record<string, SubStatus> = {
    active: SubStatus.ACTIVE,
    trialing: SubStatus.TRIALING,
    past_due: SubStatus.PAST_DUE,
    canceled: SubStatus.CANCELLED,
    paused: SubStatus.PAUSED,
    unpaid: SubStatus.PAST_DUE,
  }

  const newStatus = statusMap[stripeSub.status] ?? localSub.status

  // Check if Stripe has a price change (downgrade took effect)
  const stripePriceId = stripeSub.items.data[0]?.price.id
  let tierId = localSub.tierId
  if (stripePriceId) {
    const matchingTier = await db.productTier.findFirst({ where: { stripePriceId } })
    if (matchingTier) tierId = matchingTier.id
  }

  await db.subscription.update({
    where: { id: localSub.id },
    data: {
      status: newStatus,
      tierId,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    },
  })
}

// ── Handler: customer.subscription.deleted ───────────────────────────────────
async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const localSub = await db.subscription.findUnique({ where: { stripeSubId: stripeSub.id } })
  if (!localSub) return

  await db.subscription.update({
    where: { id: localSub.id },
    data: { status: SubStatus.CANCELLED, cancelledAt: new Date() },
  })

  await createNotification({
    userId: localSub.userId,
    type: "SUBSCRIPTION",
    title: "Subscription Ended",
    body: "Your subscription has been cancelled and access has been revoked.",
    actionUrl: "/dashboard/subscriptions",
  })
}

// ── Handler: charge.dispute.created ──────────────────────────────────────────
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id

  // Find affected payment
  const payment = await db.payment.findFirst({ where: { gatewayPaymentId: chargeId } })

  await auditLog({
    action: "stripe.dispute.created",
    entity: "Payment",
    entityId: payment?.id ?? chargeId,
    after: {
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      currency: dispute.currency,
      reason: dispute.reason,
    },
  })

  // Notify all admins — find SUPER_ADMIN users
  const admins = await db.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } })
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: "PAYMENT",
        title: "⚠️ Chargeback Dispute Filed",
        body: `A dispute was filed for charge ${chargeId}. Amount: ${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}. Reason: ${dispute.reason}`,
        actionUrl: "/admin/orders",
      })
    )
  )

  if (payment) {
    await db.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } })
  }
}

// ── Main webhook handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!stripe) {
    return new NextResponse("Stripe not configured", { status: 503 })
  }

  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("Stripe-Signature") ?? ""
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? ""

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error: any) {
    logger.error(`Stripe webhook signature error: ${error.message}`)
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }

  logger.info({ type: event.type, id: event.id }, "Stripe webhook received")

  // ── Idempotency check via WebhookEvent table ──────────────────────────────
  // Record event before processing; skip if already PROCESSED
  let webhookRecord = await db.webhookEvent.findUnique({ where: { eventId: event.id } })

  if (webhookRecord?.status === "PROCESSED") {
    logger.info({ eventId: event.id }, "Stripe webhook already processed — skipping")
    return NextResponse.json({ received: true, idempotent: true })
  }

  if (!webhookRecord) {
    webhookRecord = await db.webhookEvent.create({
      data: {
        source: "STRIPE",
        eventType: event.type,
        eventId: event.id,
        payload: event as object,
        status: "PENDING",
        attempts: 1,
        lastAttemptAt: new Date(),
      },
    })
  } else {
    // Retry existing FAILED event
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
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute)
        break
      default:
        logger.info({ type: event.type }, "Unhandled Stripe event — skipped")
    }

    // Mark as PROCESSED
    await db.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    })
  } catch (error) {
    logger.error({ error, eventType: event.type }, "Error handling Stripe webhook event")

    // Mark as FAILED; if max attempts reached, mark DEAD
    const currentAttempts = (webhookRecord.attempts ?? 0) + 1
    await db.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        status: currentAttempts >= 5 ? "DEAD" : "FAILED",
        errorMessage: (error as Error).message?.slice(0, 500) ?? "Unknown error",
      },
    })

    // Return 200 anyway so Stripe doesn't retry immediately — BullMQ handles retries
  }

  return NextResponse.json({ received: true })
}

