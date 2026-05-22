import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { paymentQueue, PAYMENT_JOBS } from "@/lib/queue"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { auditLog } from "@/lib/admin-audit"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()

  const event = await db.webhookEvent.findUnique({ where: { id } })
  if (!event) {
    return NextResponse.json({ error: "Webhook event not found" }, { status: 404 })
  }

  if (event.status === "PROCESSED") {
    return NextResponse.json({ error: "This webhook event has already been processed" }, { status: 400 })
  }

  if (event.attempts >= 10) {
    return NextResponse.json(
      { error: "Max replay attempts (10) reached. Manual intervention required." },
      { status: 400 }
    )
  }

  // Reset to PENDING and enqueue for processing
  await db.$transaction(async (tx) => {
    await tx.webhookEvent.update({
      where: { id },
      data: {
        status: "PENDING",
        lastAttemptAt: new Date(),
        attempts: { increment: 1 },
        errorMessage: null,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "WEBHOOK_REPLAYED",
        entity: "WebhookEvent",
        entityId: id,
        beforeJson: { status: event.status, attempts: event.attempts },
        afterJson: { status: "PENDING", replayedBy: admin.userId, timestamp: new Date().toISOString() },
      },
    })
  })

  // Re-enqueue the webhook payload for processing
  await paymentQueue.add(PAYMENT_JOBS.PROCESS_WEBHOOK, {
    webhookEventId: id,
    source: event.source,
    eventType: event.eventType,
    payload: event.payload,
    isReplay: true,
  })

  await emitEvent({
    type: EVENTS.WEBHOOK_REPLAYED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: {
      webhookEventId: id,
      source: event.source,
      eventType: event.eventType,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Webhook event ${id} re-queued for processing`,
    eventId: id,
  })
}
