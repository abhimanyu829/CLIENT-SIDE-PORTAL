import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import { SubStatus } from "@prisma/client"

const upgradeSchema = z.object({
  newTierId: z.string().min(1),
})

// POST /api/subscriptions/[id]/upgrade
// Upgrades to a higher plan immediately with proration credit applied
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

    const body = await req.json()
    const parsed = upgradeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
        },
        { status: 422 }
      )
    }
    const { newTierId } = parsed.data

    // Fetch subscription with current tier
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

    // Fetch the target tier
    const newTier = await db.productTier.findUnique({ where: { id: newTierId } })
    if (!newTier) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Target tier not found" } },
        { status: 404 }
      )
    }

    // Validate that new tier is actually a higher price (upgrade, not downgrade)
    if (Number(newTier.price) <= Number(subscription.tier.price)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "New tier price must be higher than current tier for an upgrade. Use /downgrade for lower plans.",
          },
        },
        { status: 400 }
      )
    }

    // Perform upgrade on Stripe with immediate proration
    if (stripe && subscription.stripeSubId && newTier.stripePriceId) {
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubId)
      const itemId = stripeSub.items.data[0]?.id

      await stripe.subscriptions.update(subscription.stripeSubId, {
        items: [{ id: itemId, price: newTier.stripePriceId }],
        proration_behavior: "create_prorations", // immediate invoice for diff
        billing_cycle_anchor: "unchanged",
      })
    }

    // Update local DB — new tier, same product
    const updated = await db.subscription.update({
      where: { id },
      data: {
        tierId: newTierId,
        status: SubStatus.ACTIVE,
      },
      include: { tier: true },
    })

    await auditLog({
      userId: session.user.id,
      action: "subscription.upgrade",
      entity: "Subscription",
      entityId: id,
      before: { tierId: subscription.tierId, tierName: subscription.tier.name },
      after: { tierId: newTierId, tierName: newTier.name },
    })

    await createNotification({
      userId: subscription.userId,
      type: "SUBSCRIPTION",
      title: "Plan Upgraded! 🚀",
      body: `You've successfully upgraded to the ${newTier.name} plan. Your new features are now active.`,
      actionUrl: "/dashboard/subscriptions",
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error({ error }, `POST /api/subscriptions/${id}/upgrade`)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
