import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

const cancelSchema = z.object({
  immediate: z.boolean().default(false),
  reason: z.string().max(500).optional(),
})

// POST /api/subscriptions/[id]/cancel
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
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }
    const { immediate, reason } = parsed.data

    const subscription = await db.subscription.findUnique({ where: { id } })
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Subscription not found" } },
        { status: 404 }
      )
    }

    const role = (session.user as any).role
    const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN"

    // Non-admins can only cancel their own subscriptions
    if (!isAdmin && subscription.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      )
    }

    if (subscription.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Subscription is already cancelled" } },
        { status: 409 }
      )
    }

    // Cancel on Stripe if linked
    if (stripe && subscription.stripeSubId) {
      await stripe.subscriptions.update(subscription.stripeSubId, {
        cancel_at_period_end: !immediate,
        ...(immediate ? { cancel_at: "now" as any } : {}),
      })
      if (immediate) {
        await stripe.subscriptions.cancel(subscription.stripeSubId)
      }
    }

    // Update local DB
    const updated = await db.subscription.update({
      where: { id },
      data: {
        cancelAtPeriodEnd: !immediate,
        cancelledAt: immediate ? new Date() : null,
        status: immediate ? "CANCELLED" : subscription.status,
      },
    })

    await auditLog({
      userId: session.user.id,
      action: "subscription.cancel",
      entity: "Subscription",
      entityId: id,
      after: { immediate, reason, status: updated.status },
    })

    // Notify user
    await createNotification({
      userId: subscription.userId,
      type: "SUBSCRIPTION",
      title: immediate ? "Subscription Cancelled" : "Cancellation Scheduled",
      body: immediate
        ? "Your subscription has been cancelled immediately."
        : "Your subscription will cancel at the end of the current billing period.",
      actionUrl: "/dashboard/subscriptions",
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error({ error }, `POST /api/subscriptions/${id}/cancel`)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
