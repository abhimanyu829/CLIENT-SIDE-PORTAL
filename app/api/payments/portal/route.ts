import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { logger } from "@/lib/logger"
import { env } from "@/lib/env"

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Payment service not configured" }}, { status: 503 })
  }

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" }}, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "User or Stripe customer not found" }}, { status: 404 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions`,
    })

    return NextResponse.json({ success: true, data: { portalUrl: portalSession.url }})
  } catch (error) {
    logger.error({ error }, "API error in POST /api/payments/portal")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }}, { status: 500 })
  }
}
