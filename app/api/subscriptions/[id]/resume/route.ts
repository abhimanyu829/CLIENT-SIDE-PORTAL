import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { logger } from "@/lib/logger"
import { reactivateSubscription } from "@/lib/services/subscription-service"

// POST /api/subscriptions/[id]/resume
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      )
    }

    const subscription = await db.subscription.findUnique({ where: { id } })
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Subscription not found" } },
        { status: 404 }
      )
    }

    const role = (session.user as any).role
    const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN"
    if (!isAdmin && subscription.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      )
    }

    if (subscription.status !== "PAUSED") {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Subscription is not paused" } },
        { status: 409 }
      )
    }

    // Resume on Stripe — clear pause_collection
    if (stripe && subscription.stripeSubId) {
      await stripe.subscriptions.update(subscription.stripeSubId, {
        pause_collection: "" as any, // passing empty string removes the pause
      })
    }

    await reactivateSubscription(id, session.user.id)
    const updated = await db.subscription.findUnique({ where: { id }, include: { tier: true, product: true } })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error({ error }, `POST /api/subscriptions/${id}/resume`)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
