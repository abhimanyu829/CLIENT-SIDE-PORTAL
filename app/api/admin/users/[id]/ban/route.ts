import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()

  const body = await req.json()
  const { action, reason } = body // action: "ban" | "unban"

  if (!["ban", "unban"].includes(action)) {
    return NextResponse.json({ error: "action must be 'ban' or 'unban'" }, { status: 400 })
  }

  if (action === "ban" && (!reason || typeof reason !== "string" || reason.trim().length < 3)) {
    return NextResponse.json(
      { error: "A reason (min 3 chars) is required for banning a user" },
      { status: 400 }
    )
  }

  const userId = id

  // Prevent admin from banning themselves
  if (userId === admin.userId) {
    return NextResponse.json({ error: "You cannot ban yourself" }, { status: 400 })
  }

  const targetUser = await db.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Prevent banning other super admins unless the actor is also super admin
  if (targetUser.role === "SUPER_ADMIN" && !admin.isSuperAdmin) {
    return NextResponse.json(
      { error: "Only SUPER_ADMIN can ban another SUPER_ADMIN" },
      { status: 403 }
    )
  }

  const isBanning = action === "ban"

  await db.$transaction(async (tx) => {
    // 1. Update user ban status
    await tx.user.update({
      where: { id: userId },
      data: {
        isBanned: isBanning,
        bannedAt: isBanning ? new Date() : null,
        banReason: isBanning ? reason.trim() : null,
      },
    })

    // 2. If banning, invalidate all active sessions
    if (isBanning) {
      await tx.userSession.deleteMany({ where: { userId } })
    }

    // 3. Audit log inside transaction
    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: isBanning ? "USER_BANNED" : "USER_UNBANNED",
        entity: "User",
        entityId: userId,
        beforeJson: {
          isBanned: targetUser.isBanned,
          email: targetUser.email,
        },
        afterJson: {
          isBanned: isBanning,
          reason: isBanning ? reason.trim() : null,
          adminId: admin.userId,
        },
      },
    })
  })

  // 4. Emit event for real-time admin update
  await emitEvent({
    type: isBanning ? EVENTS.USER_BANNED : EVENTS.USER_UNBANNED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: {
      userId,
      email: targetUser.email,
      reason: isBanning ? reason.trim() : null,
    },
  })

  return NextResponse.json({
    success: true,
    userId,
    isBanned: isBanning,
    message: isBanning
      ? `User ${targetUser.email} has been banned. All sessions invalidated.`
      : `User ${targetUser.email} has been unbanned.`,
  })
}
