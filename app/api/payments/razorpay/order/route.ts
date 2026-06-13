import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PaymentGateway, OrderStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getRazorpay } from "@/lib/razorpay"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import {
  attachGatewayOrder,
  createBuyNowCart,
  createOrderFromActiveCart,
  recalculateCart,
} from "@/lib/services/enterprise-commerce-service"

// ── Request schema ──────────────────────────────────────────────────────────────
const orderSchema = z.object({
  mode: z.enum(["cart", "buy_now"]).default("cart"),
  productId: z.string().optional(),
  tierId: z.string().optional(),
  quantity: z.number().int().positive().max(999).optional(),
  couponCode: z.string().optional(),
  billingAddress: z.record(z.unknown()).optional(),
  region: z.string().optional(),
  checkoutSessionId: z.string().optional(),
  pendingOrderId: z.string().optional(),
})

function toPaise(amount: unknown): number {
  const num = Math.round(Number(amount) * 100)
  if (isNaN(num) || num < 100) {
    console.error(`[RAZORPAY ORDER] ❌ Invalid amount for paise conversion: ${amount}, falling back to 100 paise`)
    return 100
  }
  return num
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log("[RAZORPAY ORDER] 📨 POST /api/payments/razorpay/order — request received")

  try {
    // ── 1. Authenticate ────────────────────────────────────────────────────
    const session = await auth()
    if (!session?.user?.id) {
      console.log("[RAZORPAY ORDER] ❌ No authenticated session")
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please sign in to checkout." } },
        { status: 401 },
      )
    }
    console.log(`[RAZORPAY ORDER] ✅ Authenticated user: ${session.user.id} (${session.user.email})`)

    // ── 2. Validate user account ───────────────────────────────────────────
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, isVerified: true, isBanned: true, name: true },
    })
    if (!user) {
      console.error(`[RAZORPAY ORDER] ❌ User not found: ${session.user.id}`)
      return NextResponse.json(
        { success: false, error: { code: "USER_NOT_FOUND", message: "User account not found." } },
        { status: 404 },
      )
    }
    if (!user.isVerified) {
      console.warn(`[RAZORPAY ORDER] ❌ User not verified: ${user.email}`)
      return NextResponse.json(
        { success: false, error: { code: "ACCOUNT_RESTRICTED", message: "Verify your email before checkout." } },
        { status: 403 },
      )
    }
    if (user.isBanned) {
      console.warn(`[RAZORPAY ORDER] ❌ User is banned: ${user.email}`)
      return NextResponse.json(
        { success: false, error: { code: "ACCOUNT_BANNED", message: "Your account has been suspended." } },
        { status: 403 },
      )
    }

    // ── 3. Validate Razorpay configuration ──────────────────────────────────
    const client = getRazorpay()
    if (!client) {
      console.error("[RAZORPAY ORDER] ❌ Razorpay client not initialized — check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars")
      return NextResponse.json(
        { success: false, error: { code: "RAZORPAY_NOT_CONFIGURED", message: "Payment gateway is not configured. Please contact support." } },
        { status: 503 },
      )
    }

    // ── 4. Parse and validate request body ─────────────────────────────────
    let body: z.infer<typeof orderSchema>
    try {
      const rawBody = await req.json()
      body = orderSchema.parse(rawBody)
      console.log(`[RAZORPAY ORDER] 📋 Mode: ${body.mode}, Product: ${body.productId ?? "cart"}, Tier: ${body.tierId ?? "default"}, Session: ${body.checkoutSessionId ?? "none"}`)
    } catch (parseError) {
      console.error("[RAZORPAY ORDER] ❌ Invalid request body:", parseError)
      if (parseError instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: { code: "BAD_REQUEST", message: parseError.errors } },
          { status: 400 },
        )
      }
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Invalid request body." } },
        { status: 400 },
      )
    }

    // ── 5. Duplicate order prevention ────────────────────────────────────────
    // If the client sends a pendingOrderId, check if that order is still PENDING
    // and reuse its Razorpay order instead of creating a new one.
    if (body.pendingOrderId) {
      const existingOrder = await db.order.findFirst({
        where: {
          id: body.pendingOrderId,
          userId: session.user.id,
          status: OrderStatus.PENDING,
        },
        include: { payments: true },
      })

      if (existingOrder) {
        const existingPayment = existingOrder.payments.find((p) => p.gateway === PaymentGateway.RAZORPAY && p.gatewayOrderId)
        if (existingPayment?.gatewayOrderId) {
          // Reuse the existing Razorpay order
          console.log(`[RAZORPAY ORDER] ♻️ Reusing existing Razorpay order: ${existingPayment.gatewayOrderId} for order: ${existingOrder.orderNumber}`)

          // Fetch the existing Razorpay order to get current amount/currency
          let razorpayOrder: any
          try {
            razorpayOrder = await client.orders.fetch(existingPayment.gatewayOrderId)
          } catch {
            // If fetch fails, create a new order
            console.warn(`[RAZORPAY ORDER] ⚠️ Could not fetch existing Razorpay order, creating new one`)
          }

          if (razorpayOrder) {
            const elapsed = Date.now() - startTime
            console.log(`[RAZORPAY ORDER] ✅ Reused order in ${elapsed}ms — order ${existingOrder.orderNumber}`)

            return NextResponse.json(
              {
                success: true,
                data: {
                  keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID,
                  order: {
                    id: existingOrder.id,
                    orderNumber: existingOrder.orderNumber,
                    amount: Number(existingOrder.grandTotal),
                    currency: existingOrder.currency,
                    status: existingOrder.status,
                  },
                  razorpayOrder: {
                    id: existingPayment.gatewayOrderId,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                  },
                },
              },
              { status: 200 },
            )
          }
        }
      }
    }

    // ── 6. Create or resolve cart ────────────────────────────────────────────
    let cartId: string | undefined

    if (body.mode === "buy_now") {
      let productId = body.productId
      if (!productId && body.tierId) {
        const tier = await db.productTier.findUnique({
          where: { id: body.tierId },
          select: { id: true, productId: true, isActive: true },
        })
        if (!tier) {
          console.error(`[RAZORPAY ORDER] ❌ Tier not found: ${body.tierId}`)
          return NextResponse.json(
            { success: false, error: { code: "TIER_NOT_FOUND", message: "Selected pricing tier does not exist." } },
            { status: 400 },
          )
        }
        productId = tier.productId
      }
      if (!productId) {
        return NextResponse.json(
          { success: false, error: { code: "BAD_REQUEST", message: "productId or tierId is required for Buy Now." } },
          { status: 400 },
        )
      }

      const product = await db.product.findUnique({
        where: { id: productId },
        select: { id: true, status: true, name: true, inventoryEnabled: true, inventoryCount: true },
      })
      if (!product) {
        console.error(`[RAZORPAY ORDER] ❌ Product not found: ${productId}`)
        return NextResponse.json(
          { success: false, error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." } },
          { status: 404 },
        )
      }
      if (product.status !== "AVAILABLE") {
        console.error(`[RAZORPAY ORDER] ❌ Product not available: ${product.name} (status: ${product.status})`)
        return NextResponse.json(
          { success: false, error: { code: "PRODUCT_UNAVAILABLE", message: "This product is not available for purchase." } },
          { status: 400 },
        )
      }

      // ── Inventory validation ──────────────────────────────────────────────────────────────
      if (product.inventoryEnabled && (product.inventoryCount ?? 0) <= 0) {
        console.error(`[RAZORPAY ORDER] ❌ Product sold out: ${product.name} (inventory: ${product.inventoryCount})`)
        return NextResponse.json(
          { success: false, error: { code: "SOLD_OUT", message: "This product is sold out. Please try again later." } },
          { status: 400 },
        )
      }

      console.log(`[RAZORPAY ORDER] 🛒 Creating buy-now cart for product: ${product.name}`)
      const cart = await createBuyNowCart({
        userId: session.user.id,
        productId,
        tierId: body.tierId,
        quantity: body.quantity,
        couponCode: body.couponCode,
        region: body.region,
      })
      cartId = cart.id
      console.log(`[RAZORPAY ORDER] ✅ Buy-now cart created: ${cart.id}, grandTotal: ${cart.grandTotal}`)
    } else {
      const activeCart = await db.cart.findFirst({
        where: { userId: session.user.id, status: "ACTIVE" },
        include: { items: { include: { product: { select: { inventoryEnabled: true, inventoryCount: true } } } } },
        orderBy: { updatedAt: "desc" },
      })
      if (!activeCart || activeCart.items.length === 0) {
        console.warn(`[RAZORPAY ORDER] ❌ Empty cart for user: ${session.user.id}`)
        return NextResponse.json(
          { success: false, error: { code: "EMPTY_CART", message: "Your cart is empty. Add items before checking out." } },
          { status: 400 },
        )
      }

      // ── Inventory validation for cart items ──────────────────────────────────────────
      for (const item of activeCart.items) {
        if (item.product.inventoryEnabled && (item.product.inventoryCount ?? 0) <= 0) {
          console.error(`[RAZORPAY ORDER] ❌ Product sold out in cart: ${item.productId}`)
          return NextResponse.json(
            { success: false, error: { code: "SOLD_OUT", message: `An item in your cart (${item.productId}) is sold out. Please remove it and try again.` } },
            { status: 400 },
          )
        }
      }

      if (body.couponCode) {
        await recalculateCart(activeCart.id, body.couponCode)
      }
      cartId = activeCart.id
      console.log(`[RAZORPAY ORDER] 🛒 Using existing cart: ${cartId}, items: ${activeCart.items.length}`)
    }

    // ── 7. Create order from cart (server-side pricing) ──────────────────────
    console.log(`[RAZORPAY ORDER] 📦 Creating order from cart: ${cartId}`)
    const order = await createOrderFromActiveCart({
      userId: session.user.id,
      cartId,
      gateway: PaymentGateway.RAZORPAY,
      couponCode: body.couponCode,
    })

    const grandTotal = Number(order.grandTotal)
    console.log(`[RAZORPAY ORDER] ✅ Order created: ${order.orderNumber}, grandTotal: ${grandTotal} ${order.currency}`)

    if (grandTotal <= 0) {
      console.error(`[RAZORPAY ORDER] ❌ Order has zero total: ${order.orderNumber}`)
      return NextResponse.json(
        { success: false, error: { code: "ZERO_TOTAL", message: "This checkout has no payable amount." } },
        { status: 400 },
      )
    }

    // ── 8. Create Razorpay order (amount in paise) ───────────────────────────
    const paiseAmount = toPaise(order.grandTotal)
    const currency = order.currency || "INR"
    console.log(`[RAZORPAY ORDER] 💰 Creating Razorpay order: amount=${paiseAmount} paise (${grandTotal} ${currency}), receipt=${order.orderNumber}`)

    let razorpayOrder: any
    try {
      razorpayOrder = await client.orders.create({
        amount: paiseAmount,
        currency,
        receipt: order.orderNumber,
        payment_capture: 1,
        notes: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: session.user.id,
          cartId: order.cartId ?? "",
          checkoutMode: body.mode,
          checkoutSessionId: body.checkoutSessionId ?? "",
        },
      } as any)
      console.log(`[RAZORPAY ORDER] ✅ Razorpay order created: ${razorpayOrder.id}`)
    } catch (razorpayError) {
      console.error("[RAZORPAY ORDER] ❌ Razorpay API error:", razorpayError)
      logger.error({ error: razorpayError, orderNumber: order.orderNumber }, "Razorpay order creation failed")
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RAZORPAY_ORDER_FAILED",
            message: "Payment gateway error. Please try again in a moment.",
            details: process.env.NODE_ENV === "development" ? (razorpayError as Error).message : undefined,
          },
        },
        { status: 502 },
      )
    }

    // ── 9. Attach gateway order to our DB ─────────────────────────────────────
    await attachGatewayOrder({
      orderId: order.id,
      gatewayOrderId: razorpayOrder.id,
    })
    console.log(`[RAZORPAY ORDER] ✅ Gateway order attached to DB order: ${order.id}`)

    // ── 10. Store checkout session ID for analytics ──────────────────────────
    if (body.checkoutSessionId) {
      await db.order.update({
        where: { id: order.id },
        data: {
          metadata: {
            ...(typeof order.metadata === "object" && order.metadata ? order.metadata as Record<string, unknown> : {}),
            checkoutSessionId: body.checkoutSessionId,
          },
        },
      }).catch(() => {
        // Non-critical — metadata update failure shouldn't block checkout
        console.warn(`[RAZORPAY ORDER] ⚠️ Could not update order metadata with checkout session ID`)
      })
    }

    const elapsed = Date.now() - startTime
    console.log(`[RAZORPAY ORDER] ✅ Complete in ${elapsed}ms — order ${order.orderNumber}, Razorpay ${razorpayOrder.id}`)

    // ── 11. Return only what the frontend needs for Standard Checkout ──────────
    return NextResponse.json(
      {
        success: true,
        data: {
          keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID,
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            amount: grandTotal,
            currency: order.currency,
            status: order.status,
          },
          razorpayOrder: {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
          },
        },
      },
      { status: 201 },
    )
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[RAZORPAY ORDER] ❌ FATAL ERROR after ${elapsed}ms:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: error.errors } },
        { status: 400 },
      )
    }

    logger.error({ error, elapsed }, "API error in POST /api/payments/razorpay/order")

    const message = error instanceof Error ? error.message : "Unable to create checkout."
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: process.env.NODE_ENV === "development" ? message : "Unable to process payment. Please try again.",
        },
      },
      { status: 500 },
    )
  }
}