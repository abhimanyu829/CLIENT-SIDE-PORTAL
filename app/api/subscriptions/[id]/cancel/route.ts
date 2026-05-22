import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const sub = await db.subscription.findUnique({ where: { id } })
    if (!sub || sub.userId !== session.user.id) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })

    if (sub.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
    }

    const updated = await db.subscription.update({
      where: { id },
      data: { status: "CANCELED" },
    })

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SUBSCRIPTION_CANCELED",
        entity: "Subscription",
        entityId: id,
      }
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[subscriptions/cancel POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
