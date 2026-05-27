import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { cancelSubscription } from "@/lib/services/subscription-service"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "User cancellation"

    const sub = await db.subscription.findUnique({ where: { id } })
    if (!sub || sub.userId !== session.user.id) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }

    if (stripe && sub.stripeSubId) {
      await stripe.subscriptions.cancel(sub.stripeSubId)
    }

    await cancelSubscription(id, session.user.id, reason)
    const updated = await db.subscription.findUnique({ where: { id }, include: { tier: true, product: true } })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[subscriptions/cancel POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
