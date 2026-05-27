import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import crypto from "crypto"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { env } from "@/lib/env"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { markOrderPaid } from "@/lib/services/enterprise-commerce-service"

const verifySchema = z.object({
  orderId: z.string(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
})

function verifySignature(orderId: string, paymentId: string, signature: string) {
  const secret = env.RAZORPAY_KEY_SECRET
  if (!secret) {
    console.error("[RAZORPAY VERIFY] ❌ RAZORPAY_KEY_SECRET not configured — cannot verify signature")
    logger.error("RAZORPAY_KEY_SECRET not configured — cannot verify signature")
    return false
  }
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex")
  if (expected.length !== signature.length) {
    console.error("[RAZORPAY VERIFY] ❌ Signature length mismatch")
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(req: NextRequest) {
  console.log("[RAZORPAY VERIFY] 📨 POST /api/payments/razorpay/verify — request received")

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log("[RAZORPAY VERIFY] ❌ No authenticated session")
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Please sign in." } }, { status: 401 })
    }

    const body = verifySchema.parse(await req.json())
    console.log(`[RAZORPAY VERIFY] Verifying payment: order=${body.orderId}, razorpay_order=${body.razorpay_order_id}, payment=${body.razorpay_payment_id}`)

    // ── 1. Verify Razorpay signature ──────────────────────────────────────
    if (!verifySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      console.error("[RAZORPAY VERIFY] ❌ Signature verification FAILED — possible tampering")
      return NextResponse.json({ success: false, error: { code: "BAD_SIGNATURE", message: "Payment signature verification failed. This may indicate tampering — please contact support." } }, { status: 400 })
    }
    console.log("[RAZORPAY VERIFY] ✅ Signature verified successfully")

    // ── 2. Find the order ──────────────────────────────────────────────────
    const order = await db.order.findFirst({
      where: {
        id: body.orderId,
        userId: session.user.id,
        payments: { some: { gatewayOrderId: body.razorpay_order_id } },
      },
    })

    if (!order) {
      console.error(`[RAZORPAY VERIFY] ❌ Order not found: orderId=${body.orderId}, userId=${session.user.id}, razorpay_order_id=${body.razorpay_order_id}`)
      return NextResponse.json({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Checkout session not found." } }, { status: 404 })
    }

    // ── 3. Mark order as paid (idempotent) ─────────────────────────────────
    console.log(`[RAZORPAY VERIFY] 💰 Marking order ${order.orderNumber} as paid`)
    const paid = await markOrderPaid(order.id, body.razorpay_payment_id, body.razorpay_order_id)
    console.log(`[RAZORPAY VERIFY] ✅ Order ${order.orderNumber} marked as paid, status: ${paid.status}`)

    return NextResponse.json({
      success: true,
      data: {
        orderId: paid.id,
        orderNumber: paid.orderNumber,
        status: paid.status,
        redirectUrl: `/checkout/success?orderId=${paid.id}`,
      },
    })
  } catch (error) {
    console.error("[RAZORPAY VERIFY] ❌ Verification error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: error.errors } }, { status: 400 })
    }

    logger.error({ error }, "API error in POST /api/payments/razorpay/verify")
    return NextResponse.json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: process.env.NODE_ENV === "development" ? (error as Error).message : "Unable to verify payment. Please contact support.",
      },
    }, { status: 500 })
  }
}