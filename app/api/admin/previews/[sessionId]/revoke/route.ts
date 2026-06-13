import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revokePreviewToken } from "@/lib/preview-token"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { logger } from "@/lib/logger"

// POST /api/admin/previews/[sessionId]/revoke
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  const session = await auth()
  if (!session?.user?.role || !["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const adminId = session.user.id
  let body: { reason?: string } = {}
  try { body = await req.json() } catch {}
  const reason = body.reason?.trim() || "Revoked by admin"

  // Find session by ID or token
  const demo = await db.demoSession.findFirst({
    where: { OR: [{ id: sessionId }, { sessionToken: sessionId }, { signedToken: sessionId }] },
    include: { product: { select: { name: true } } },
  })

  if (!demo) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (demo.isRevoked) {
    return NextResponse.json({ error: "Session already revoked" }, { status: 409 })
  }

  // Revoke in DB
  await db.demoSession.update({
    where: { id: demo.id },
    data: {
      isRevoked: true,
      isExpired: true,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  })

  // Blacklist token in Redis
  await revokePreviewToken(demo.id, demo.expiresAt, reason)

  // Audit log
  await db.auditLog.create({
    data: {
      userId: adminId,
      action: "PREVIEW_REVOKED",
      entity: "DemoSession",
      entityId: demo.id,
      afterJson: {
        sessionId: demo.id,
        productName: demo.product?.name,
        revokedUserId: demo.userId,
        reason,
        revokedAt: new Date().toISOString(),
      },
    },
  })

  // Emit event — fires Pusher to preview-{sessionId} channel and user channel
  await emitEvent({
    type: EVENTS.PREVIEW_REVOKED,
    timestamp: new Date().toISOString(),
    actorId: adminId,
    payload: {
      sessionId: demo.id,
      productId: demo.productId,
      userId: demo.userId,
      reason,
      revokedAt: new Date().toISOString(),
    },
  })

  logger.info({ sessionId: demo.id, adminId, reason }, "Preview session revoked by admin")

  return NextResponse.json({
    success: true,
    sessionId: demo.id,
    revokedAt: new Date().toISOString(),
    reason,
  })
}
