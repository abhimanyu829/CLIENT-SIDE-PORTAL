import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

const downgradeSchema = z.object({
  newTierId: z.string().min(1),
})

// POST /api/subscriptions/[id]/downgrade
// Schedules a downgrade at end of current billing period (no immediate proration)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const parsed = downgradeSchema.safeParse(body)
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
        { success: false, error: { code: "CONFLICT", message: "Cannot downgrade a cancelled subscription" } },
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

    // Schedule on Stripe — change at period end, no proration refund
    if (stripe && subscription.stripeSubId && newTier.stripePriceId) {
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubId)
      const itemId = stripeSub.items.data[0]?.id

      await stripe.subscriptions.update(subscription.stripeSubId, {
        items: [{ id: itemId, price: newTier.stripePriceId }],
        proration_behavior: "none", // no immediate charge/credit — takes effect next cycle
        billing_cycle_anchor: "unchanged",
      })
    }

    // We don't change the DB tier yet — it stays on the old tier until period end.
    // The Stripe webhook `customer.subscription.updated` will sync the tier when it takes effect.
    // We record the scheduled downgrade in audit for traceability.
    await auditLog({
      userId: session.user.id,
      action: "subscription.downgrade.scheduled",
      entity: "Subscription",
      entityId: id,
      before: { tierId: subscription.tierId, tierName: subscription.tier.name },
      after: { scheduledTierId: newTierId, scheduledTierName: newTier.name, effectiveAt: subscription.currentPeriodEnd },
    })

    await createNotification({
      userId: subscription.userId,
      type: "SUBSCRIPTION",
      title: "Downgrade Scheduled",
      body: `Your plan will switch to ${newTier.name} on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}. You keep current features until then.`,
      actionUrl: "/dashboard/subscriptions",
    })

    return NextResponse.json({
      success: true,
      data: {
        message: "Downgrade scheduled",
        effectiveAt: subscription.currentPeriodEnd,
        currentTier: subscription.tier.name,
        scheduledTier: newTier.name,
      },
    })
  } catch (error) {
    logger.error({ error }, `POST /api/subscriptions/${id}/downgrade`)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
