/**
 * POST /api/payments/paytm/order
 *
 * Secure Paytm Direct-UPI gateway.
 * Architecture: "Never trust the client" — this endpoint creates an internal
 * PENDING order on the server and returns the Paytm UPI ID + order details
 * to power the QR code / UTR submission flow. No third-party Paytm API calls
 * are made — the user pays via UPI directly and submits proof for admin verification.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PaymentGateway } from "@prisma/client"
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
  billingAddress: z.record(z.unknown()).optional(),
  region: z.string().optional(),
  checkoutSessionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized — please sign in to continue." } },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user || !user.isVerified) {
      return NextResponse.json(
        { success: false, error: { message: "Account not verified. Please verify your email first." } },
        { status: 403 }
      )
    }

    const body = orderSchema.parse(await req.json())

    // ── 1. Create the internal order ─────────────────────────────────────────
    let internalOrder
    if (body.mode === "buy_now") {
      if (!body.productId || !body.tierId) {
        throw new Error("Missing product info for buy now mode.")
      }
      const cart = await createBuyNowCart({
        userId: user.id,
        productId: body.productId,
        tierId: body.tierId,
        quantity: body.quantity ?? 1,
      })
      internalOrder = await createOrderFromActiveCart({
        userId: user.id,
        cartId: cart.id,
        gateway: PaymentGateway.PAYTM,
      })
    } else {
      internalOrder = await createOrderFromActiveCart({
        userId: user.id,
        gateway: PaymentGateway.PAYTM,
      })
    }

    if (!internalOrder) {
      return NextResponse.json(
        { success: false, error: { message: "Failed to create order. Your cart may be empty." } },
        { status: 400 }
      )
    }

    // ── 2. Attach gateway order ID (our own order ID for UPI flow) ────────────
    await attachGatewayOrder({
      orderId: internalOrder.id,
      gatewayOrderId: `PAYTM_UPI_${internalOrder.orderNumber}`,
    })

    // ── 3. Resolve Paytm-specific UPI ID from env ─────────────────────────────
    // Priority: PAYTM_UPI_ID → NEXT_PUBLIC_UPI_ID → default
    const upiId =
      env.PAYTM_UPI_ID ||
      env.NEXT_PUBLIC_UPI_ID ||
      "9142798767@pthdfc"

    const upiName =
      env.PAYTM_UPI_NAME ||
      env.NEXT_PUBLIC_UPI_NAME ||
      "NexusAI"

    // ── 4. Return data for QR code generation on frontend ─────────────────────
    return NextResponse.json({
      success: true,
      data: {
        gateway: "PAYTM",
        order: {
          id: internalOrder.id,
          orderNumber: internalOrder.orderNumber,
          amount: Number(internalOrder.grandTotal),
          currency: internalOrder.currency,
        },
        upiId,
        upiName,
      },
    })
  } catch (err: any) {
    console.error("[PAYTM UPI ORDER]", err)
    return NextResponse.json(
      { success: false, error: { message: err.message || "Failed to initiate Paytm UPI payment." } },
      { status: 500 }
    )
  }
}
