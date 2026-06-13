import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const { block, reason } = z.object({
      block: z.boolean(),
      reason: z.string().max(500).optional(),
    }).parse(await req.json())

    const user = await db.user.findUnique({ where: { id }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 })
    }
    if (id === session.user.id) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Cannot block yourself" } }, { status: 400 })
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          isBanned: block,
          bannedAt: block ? new Date() : null,
          banReason: block ? reason ?? "Admin account restriction" : null,
        },
      })

      await tx.subscription.updateMany({
        where: { userId: id, status: { in: block ? ["ACTIVE", "TRIALING"] : ["PAUSED"] } },
        data: { status: block ? "PAUSED" : "ACTIVE" },
      })

      await tx.customerEntitlement.updateMany({
        where: block
          ? { userId: id }
          : { userId: id, status: "SUSPENDED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        data: { status: block ? "SUSPENDED" : "ACTIVE" },
      })
    })

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

    await emitEvent({
      type: block ? EVENTS.USER_BANNED : EVENTS.USER_UNBANNED,
      timestamp: new Date().toISOString(),
      actorId: session.user.id,
      payload: { userId: id, reason },
    })

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
