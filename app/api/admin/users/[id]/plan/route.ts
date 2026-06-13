import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { changePlan } from "@/lib/services/subscription-service"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

// POST /api/admin/users/[id]/plan — manually change a user's subscription plan
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const { subscriptionId, newTierId, reason } = z.object({
      subscriptionId: z.string().min(1),
      newTierId: z.string().min(1),
      reason: z.string().max(500).optional(),
    }).parse(body)

    const subscription = await db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { tier: true },
    })
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Subscription not found" } }, { status: 404 })
    }

    const result = await changePlan(subscriptionId, newTierId, session.user.id, reason ?? "Admin user plan change")

    return NextResponse.json({ success: true, data: result.subscription })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 422 })
    }
    logger.error({ error }, "POST /api/admin/users/[id]/plan")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
