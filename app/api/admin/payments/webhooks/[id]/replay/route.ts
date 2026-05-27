import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * POST /api/admin/payments/webhooks/[id]/replay
 * 
 * Replay a failed webhook event by resetting its status to PENDING.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  const { id } = await params

  console.log(`[ADMIN WEBHOOKS] Admin ${admin.userId} replaying webhook event: ${id}`)

  const event = await db.webhookEvent.findUnique({ where: { id } })
  if (!event) {
    return NextResponse.json({ success: false, error: "Webhook event not found" }, { status: 404 })
  }

  if (event.status === "PROCESSED") {
    return NextResponse.json({ success: false, error: "Cannot replay a successfully processed event" }, { status: 400 })
  }

  const updated = await db.webhookEvent.update({
    where: { id },
    data: {
      status: "PENDING",
      attempts: 0,
      lastAttemptAt: null,
      errorMessage: null,
    },
  })

  logger.info({ eventId: id, adminId: admin.userId }, "Webhook event replayed by admin")
  console.log(`[ADMIN WEBHOOKS] ✅ Webhook event ${id} reset to PENDING for replay`)

  return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status } })
}