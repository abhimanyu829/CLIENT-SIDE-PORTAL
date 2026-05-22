import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const { productId, priceId, planName, amount } = await req.json()
    if (!priceId) return NextResponse.json({ error: "Price ID required" }, { status: 400 })
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    let stripeCustomerId = user.stripeCustomerId
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      })
      stripeCustomerId = customer.id
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions?canceled=true`,
      metadata: {
        userId,
        productId,
        planName,
      },
    })

    // Create Audit Log
    await db.auditLog.create({
      data: {
        userId,
        action: "SUBSCRIPTION_CHECKOUT_STARTED",
        entity: "Subscription",
        afterJson: { planName, priceId, amount },
      }
    })

    return NextResponse.json({ data: { url: checkoutSession.url } })
  } catch (err) {
    console.error("[subscriptions/upgrade POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
