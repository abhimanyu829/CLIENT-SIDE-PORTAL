import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { BillingInterval, PaymentGateway } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { logger } from "@/lib/logger"
import { env } from "@/lib/env"
import {
  attachGatewayOrder,
  createBuyNowCart,
  createOrderFromActiveCart,
  recalculateCart,
} from "@/lib/services/enterprise-commerce-service"

const checkoutSchema = z.object({
  mode: z.enum(["cart", "buy_now"]).default("buy_now"),
  productId: z.string().optional(),
  tierId: z.string().optional(),
  couponCode: z.string().optional(),
  region: z.string().optional(),
})

function amountInMinorUnits(amount: unknown) {
  return Math.max(50, Math.round(Number(amount) * 100))
}

function stripeRecurringInterval(interval: BillingInterval): "day" | "week" | "month" | "year" | null {
  if (interval === BillingInterval.WEEKLY) return "week"
  if (interval === BillingInterval.MONTHLY) return "month"
  if (interval === BillingInterval.YEARLY) return "year"
  return null
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Payment service not configured" } }, { status: 503 })
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, isVerified: true, isBanned: true },
    })
    if (!user?.isVerified || user.isBanned) {
      return NextResponse.json({ success: false, error: { code: "ACCOUNT_RESTRICTED", message: "Verify your account before checkout." } }, { status: 403 })
    }

    const body = checkoutSchema.parse(await req.json())
    let cartId: string | undefined

    if (body.mode === "cart") {
      const activeCart = await db.cart.findFirst({
        where: { userId: session.user.id, status: "ACTIVE" },
        include: { items: true },
        orderBy: { updatedAt: "desc" },
      })
      if (!activeCart || activeCart.items.length === 0) {
        return NextResponse.json({ success: false, error: { code: "EMPTY_CART", message: "Your cart is empty." } }, { status: 400 })
      }
      if (body.couponCode) await recalculateCart(activeCart.id, body.couponCode)
      cartId = activeCart.id
    } else {
      let productId = body.productId
      if (!productId && body.tierId) {
        const tier = await db.productTier.findUnique({ where: { id: body.tierId }, select: { productId: true } })
        productId = tier?.productId
      }
      if (!productId) {
        return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "productId or tierId is required." } }, { status: 400 })
      }
      const cart = await createBuyNowCart({
        userId: session.user.id,
        productId,
        tierId: body.tierId,
        couponCode: body.couponCode,
        region: body.region,
      })
      cartId = cart.id
    }

    const order = await createOrderFromActiveCart({
      userId: session.user.id,
      cartId,
      gateway: PaymentGateway.STRIPE,
      couponCode: body.couponCode,
    })
    if (Number(order.grandTotal) <= 0) {
      return NextResponse.json({ success: false, error: { code: "ZERO_TOTAL", message: "This checkout has no payable amount." } }, { status: 400 })
    }

    const firstItem = await db.orderItem.findFirst({
      where: { orderId: order.id },
      include: { tier: true },
      orderBy: { createdAt: "asc" },
    })
    const recurringInterval = firstItem?.tier ? stripeRecurringInterval(firstItem.tier.interval) : null
    const checkoutMode = recurringInterval ? "subscription" : "payment"

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: checkoutMode,
      line_items: [{
        price_data: {
          currency: order.currency.toLowerCase(),
          product_data: { name: `NexusAI ${order.orderNumber}` },
          unit_amount: amountInMinorUnits(order.grandTotal),
          ...(recurringInterval ? { recurring: { interval: recurringInterval } } : {}),
        },
        quantity: 1,
      }],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?orderId=${order.id}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/checkout?cancelled=true`,
      customer_email: user.email,
      metadata: {
        userId: session.user.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        cartId: order.cartId ?? "",
        exactGrandTotal: String(order.grandTotal),
      },
      payment_intent_data: checkoutMode === "payment" ? {
        metadata: {
          userId: session.user.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      } : undefined,
      subscription_data: checkoutMode === "subscription" ? {
        metadata: {
          userId: session.user.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      } : undefined,
    })

    await attachGatewayOrder({
      orderId: order.id,
      gatewayOrderId: stripeSession.id,
      paymentMethod: "stripe_checkout",
      expiresAt: stripeSession.expires_at ? new Date(stripeSession.expires_at * 1000) : undefined,
    })

    return NextResponse.json({ success: true, data: { checkoutUrl: stripeSession.url, orderId: order.id } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: error.errors } }, { status: 400 })
    }
    logger.error({ error }, "API error in POST /api/payments/checkout")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
