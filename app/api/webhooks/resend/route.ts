import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { db } from "@/lib/db"
import { updateEmailDeliveryState } from "@/lib/email/service"

function resolveQueueId(payload: any) {
  return payload?.queueId ?? payload?.data?.queueId ?? payload?.data?.tags?.queueId ?? payload?.tags?.queueId ?? null
}

export async function POST(req: NextRequest) {
  try {
    const secret = env.RESEND_WEBHOOK_SECRET
    if (secret) {
      const provided = req.headers.get("x-email-webhook-secret")
      if (provided !== secret) {
        return NextResponse.json({ success: false, error: { message: "Invalid webhook secret" } }, { status: 401 })
      }
    }

    const payload = await req.json()
    const eventType = String(payload?.type ?? payload?.event ?? "").toLowerCase()
    const queueId = resolveQueueId(payload)

    if (!queueId) {
      return NextResponse.json({ success: false, error: { message: "Missing queueId" } }, { status: 400 })
    }

    if (eventType.includes("delivered")) {
      await updateEmailDeliveryState({
        queueId,
        status: "SENT",
        deliveryState: "DELIVERED",
        providerMsgId: payload?.data?.id ?? payload?.id ?? null,
        providerResponse: payload,
        eventType: "delivered",
      })
    } else if (eventType.includes("open")) {
      await updateEmailDeliveryState({
        queueId,
        status: "SENT",
        deliveryState: "OPENED",
        providerResponse: payload,
        eventType: "open",
      })
    } else if (eventType.includes("click")) {
      await updateEmailDeliveryState({
        queueId,
        status: "SENT",
        deliveryState: "CLICKED",
        providerResponse: payload,
        eventType: "click",
      })
    } else if (eventType.includes("bounce")) {
      await updateEmailDeliveryState({
        queueId,
        status: "FAILED",
        deliveryState: "BOUNCED",
        providerResponse: payload,
        failureReason: String(payload?.data?.reason ?? payload?.reason ?? "Bounced"),
        eventType: "bounce",
      })
    } else if (eventType.includes("complaint")) {
      await updateEmailDeliveryState({
        queueId,
        status: "FAILED",
        deliveryState: "COMPLAINED",
        providerResponse: payload,
        failureReason: String(payload?.data?.reason ?? payload?.reason ?? "Spam complaint"),
        eventType: "complaint",
      })
    } else {
      await updateEmailDeliveryState({
        queueId,
        providerResponse: payload,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error }, "POST /api/webhooks/resend")
    return NextResponse.json({ success: false, error: { message: "Webhook handling failed" } }, { status: 500 })
  }
}
