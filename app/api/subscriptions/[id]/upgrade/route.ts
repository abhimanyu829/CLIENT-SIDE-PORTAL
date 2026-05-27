import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { logger } from "@/lib/logger"
import { changePlan } from "@/lib/services/subscription-service"

const upgradeSchema = z.object({
  newTierId: z.string().min(1),
})

export async function POST(
  req: NextRequest,
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

    const parsed = upgradeSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }
    const { newTierId } = parsed.data

    const subscription = await db.subscription.findUnique({
      where: { id },
      include: { tier: true },
    })
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
    if (subscription.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Cannot upgrade a cancelled subscription" } },
        { status: 409 }
      )
    }

    const newTier = await db.productTier.findUnique({ where: { id: newTierId } })
    if (!newTier) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Target tier not found" } },
        { status: 404 }
      )
    }
    if (Number(newTier.price) <= Number(subscription.tier.price)) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "New tier price must be higher than current tier for an upgrade." } },
        { status: 400 }
      )
    }

    if (stripe && subscription.stripeSubId && newTier.stripePriceId) {
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubId)
      const itemId = stripeSub.items.data[0]?.id
      if (itemId) {
        await stripe.subscriptions.update(subscription.stripeSubId, {
          items: [{ id: itemId, price: newTier.stripePriceId }],
          proration_behavior: "create_prorations",
          billing_cycle_anchor: "unchanged",
        })
      }
    }

    const result = await changePlan(id, newTierId, session.user.id, "User plan upgrade")
    return NextResponse.json({ success: true, data: result.subscription })
  } catch (error) {
    logger.error({ error }, `POST /api/subscriptions/${id}/upgrade`)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
