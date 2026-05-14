import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { env } from "@/lib/env"

const checkoutSchema = z.object({
  tierId: z.string(),
  couponCode: z.string().optional(),
})

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Payment service not configured" }}, { status: 503 })
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" }}, { status: 401 })
    }

    const body = await req.json()
    const { tierId, couponCode } = checkoutSchema.parse(body)

    const tier = await db.productTier.findUnique({ where: { id: tierId } })
    if (!tier) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Tier not found" }}, { status: 404 })
    }

    let couponId: string | undefined = undefined
    if (couponCode) {
      const coupon = await db.coupon.findUnique({ where: { code: couponCode, isActive: true }})
      if (coupon) {
        // coupon found — in production you'd use its Stripe coupon ID
        void coupon
      }
    }

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: tier.interval === 'ONE_TIME' ? 'payment' : 'subscription',
      line_items: [{
        price: tier.stripePriceId!,
        quantity: 1,
      }],
      discounts: couponId ? [{ coupon: couponId }] : [],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions?success=true`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions?cancelled=true`,
      customer_email: session.user.email!,
      metadata: {
        userId: session.user.id,
        tierId: tier.id,
      }
    })

    return NextResponse.json({ success: true, data: { checkoutUrl: stripeSession.url }})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: error.errors }}, { status: 400 })
    }
    logger.error({ error }, "API error in POST /api/payments/checkout")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }}, { status: 500 })
  }
}
