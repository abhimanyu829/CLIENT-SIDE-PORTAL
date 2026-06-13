import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PaymentGateway, OrderStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import {
  createBuyNowCart,
  createOrderFromActiveCart,
  attachGatewayOrder,
} from "@/lib/services/enterprise-commerce-service"

const orderSchema = z.object({
  mode: z.enum(["cart", "buy_now"]).default("cart"),
  productId: z.string().optional(),
  tierId: z.string().optional(),
  quantity: z.number().int().positive().max(999).optional(),
  couponCode: z.string().optional(),
  gateway: z.nativeEnum(PaymentGateway).default(PaymentGateway.MANUAL),
  billingAddress: z.record(z.unknown()).optional(),
  region: z.string().optional(),
  checkoutSessionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user || !user.isVerified) {
      return NextResponse.json({ success: false, error: { message: "Account not verified" } }, { status: 403 })
    }

    const body = orderSchema.parse(await req.json())

    let internalOrder
    if (body.mode === "buy_now") {
      if (!body.productId || !body.tierId) throw new Error("Missing product info for buy now")
      const cart = await createBuyNowCart({
        userId: user.id,
        productId: body.productId,
        tierId: body.tierId,
        quantity: body.quantity ?? 1,
      })
      internalOrder = await createOrderFromActiveCart({ userId: user.id, cartId: cart.id, gateway: body.gateway })
    } else {
      internalOrder = await createOrderFromActiveCart({ userId: user.id, gateway: body.gateway })
    }

    if (!internalOrder) {
      return NextResponse.json({ success: false, error: { message: "Failed to create order" } }, { status: 400 })
    }

    // Since it's manual, we just attach our own order ID as the gateway order ID.
    await attachGatewayOrder({
      orderId: internalOrder.id,
      gatewayOrderId: internalOrder.id,
    })

    const upiId = env.NEXT_PUBLIC_UPI_ID || process.env.NEXT_PUBLIC_UPI_ID || "9142798767@pthdfc"
    const upiName = env.NEXT_PUBLIC_UPI_NAME || process.env.NEXT_PUBLIC_UPI_NAME || "NexusAI"

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: internalOrder.id,
          orderNumber: internalOrder.orderNumber,
          amount: internalOrder.grandTotal,
        },
        upiId,
        upiName,
      }
    })

  } catch (err: any) {
    console.error("[MANUAL ORDER INIT]", err)
    return NextResponse.json({ success: false, error: { message: err.message } }, { status: 500 })
  }
}
