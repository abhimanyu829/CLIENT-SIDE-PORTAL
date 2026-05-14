import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { razorpay } from "@/lib/razorpay"
import { z } from "zod"
import { logger } from "@/lib/logger"

const orderSchema = z.object({
  tierId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" }}, { status: 401 })
    }

    const body = await req.json()
    const { tierId } = orderSchema.parse(body)

    const tier = await db.productTier.findUnique({ where: { id: tierId }})
    if (!tier) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Tier not found" }}, { status: 404 })
    }

    const options = {
      amount: Number(tier.price) * 100,
      currency: "INR",
      receipt: `receipt_tier_${tier.id}`,
      notes: {
        userId: session.user.id,
        tierId: tier.id,
      }
    }
    const order = await razorpay.orders.create(options)

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: error.errors }}, { status: 400 })
    }
    logger.error({ error }, "API error in POST /api/payments/razorpay/order")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }}, { status: 500 })
  }
}
