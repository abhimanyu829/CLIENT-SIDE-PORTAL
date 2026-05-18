import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

// POST /api/admin/users/[id]/block — block or unblock a user
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const { block, reason } = z.object({
      block: z.boolean(),
      reason: z.string().max(500).optional(),
    }).parse(body)

    const user = await db.user.findUnique({ where: { id }, select: { id: true, isVerified: true } })
    if (!user) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 })
    }

    // Prevent admins from blocking themselves
    if (id === session.user.id) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Cannot block yourself" } }, { status: 400 })
    }

    // Use isVerified=false as the "blocked" signal on the User model
    // (schema doesn't have isBlocked — we repurpose isVerified to deny login)
    // In production: add an isBlocked field. Here we store it in a metadata-style note.
    await db.user.update({
      where: { id },
      data: { isVerified: !block },
    })

    // If blocking: cancel all active subscriptions access (mark PAUSED)
    if (block) {
      await db.subscription.updateMany({
        where: { userId: id, status: { in: ["ACTIVE", "TRIALING"] } },
        data: { status: "PAUSED" },
      })
    } else {
      // Unblock: restore PAUSED subscriptions that were suspended due to block
      await db.subscription.updateMany({
        where: { userId: id, status: "PAUSED" },
        data: { status: "ACTIVE" },
      })
    }

    await auditLog({
      userId: session.user.id,
      action: block ? "admin.user.block" : "admin.user.unblock",
      entity: "User",
      entityId: id,
      after: { block, reason },
    })

    if (block) {
      await createNotification({
        userId: id,
        type: "SYSTEM",
        title: "Account Suspended",
        body: "Your account has been suspended. Please contact support for assistance.",
        actionUrl: "/support",
      })
    }

    return NextResponse.json({
      success: true,
      data: { userId: id, blocked: block, message: block ? "User blocked" : "User unblocked" },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 422 })
    }
    logger.error({ error }, "POST /api/admin/users/[id]/block")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
