import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

const pauseSchema = z.object({
  // Optional: ISO date string for when to auto-resume
  resumeAt: z.string().datetime().optional(),
})

// POST /api/subscriptions/[id]/pause
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
    const parsed = pauseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }
    const { resumeAt } = parsed.data

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

    if (subscription.status === "PAUSED") {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Subscription is already paused" } },
        { status: 409 }
      )
    }

    if (subscription.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Cannot pause a cancelled subscription" } },
        { status: 409 }
      )
    }

    // Pause on Stripe: set collection_method to mark pause
    if (stripe && subscription.stripeSubId) {
      await stripe.subscriptions.update(subscription.stripeSubId, {
        pause_collection: {
          behavior: "void",
          ...(resumeAt ? { resumes_at: Math.floor(new Date(resumeAt).getTime() / 1000) } : {}),
        },
      })
    }

    const updated = await db.subscription.update({
      where: { id },
      data: {
        status: "PAUSED",
      },
    })

    await auditLog({
      userId: session.user.id,
      action: "subscription.pause",
      entity: "Subscription",
      entityId: id,
      after: { resumeAt },
    })

    await createNotification({
      userId: subscription.userId,
      type: "SUBSCRIPTION",
      title: "Subscription Paused",
      body: resumeAt
        ? `Your subscription has been paused and will resume on ${new Date(resumeAt).toLocaleDateString()}.`
        : "Your subscription has been paused. You can resume it at any time.",
      actionUrl: "/dashboard/subscriptions",
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error({ error }, `POST /api/subscriptions/${id}/pause`)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
