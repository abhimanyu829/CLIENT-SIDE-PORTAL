import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { SubStatus } from "@prisma/client"
import { emailQueue, invoiceQueue } from "@/lib/queue"

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (!stripe) return
  const { userId, tierId } = session.metadata ?? {}
  if (!userId || !tierId) return

  const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string)

  // Look up productId from tier
  const tier = await db.productTier.findUnique({ where: { id: tierId }, select: { productId: true } })
  if (!tier) return

  await db.subscription.create({
    data: {
      userId,
      tierId,
      productId: tier.productId,
      stripeSubId: stripeSubscription.id,
      status: SubStatus.ACTIVE,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    },
  })

  await invoiceQueue.add("generate.invoice", {
    paymentId: session.payment_intent,
    userId,
  })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!stripe) return
  const subscriptionId = invoice.subscription as string
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)

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
  })
}

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
    logger.error(`Stripe webhook error: ${error.message}`)
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`)
    }
  } catch (error) {
    logger.error({ error }, "Error handling Stripe webhook")
  }

  return NextResponse.json({ received: true })
}
