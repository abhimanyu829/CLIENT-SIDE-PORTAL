import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import crypto from "crypto"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { env } from "@/lib/env"
import { SubStatus } from "@prisma/client"
import { invoiceQueue } from "@/lib/queue"

const verifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  tierId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" }}, { status: 401 })
    }

    const body = await req.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, tierId } = verifySchema.parse(body)

    const secret = env.RAZORPAY_KEY_SECRET ?? ""
    const shasum = crypto.createHmac("sha256", secret)
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`)
    const digest = shasum.digest("hex")

    if (digest !== razorpay_signature) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid signature" }}, { status: 400 })
    }

    // Look up productId from tier
    const tier = await db.productTier.findUnique({ where: { id: tierId }, select: { productId: true } })
    if (!tier) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Tier not found" }}, { status: 404 })
    }

    await db.subscription.create({
      data: {
        userId: session.user.id,
        tierId,
        productId: tier.productId,
        status: SubStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      }
    })

    await invoiceQueue.add("generate.invoice", {
      paymentId: razorpay_payment_id,
      userId: session.user.id,
    })

    return NextResponse.json({ success: true, data: { message: "Payment successful" }})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: error.errors }}, { status: 400 })
    }
    logger.error({ error }, "API error in POST /api/payments/razorpay/verify")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }}, { status: 500 })
  }
}
