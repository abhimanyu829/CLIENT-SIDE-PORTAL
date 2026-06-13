import { NextRequest, NextResponse } from "next/server"
import { updateEmailDeliveryState } from "@/lib/email/service"

function safeDestination(value: string | null) {
  if (!value) return "/"
  if (value.startsWith("/") && !value.startsWith("//")) return value
  try {
    const parsed = new URL(value)
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "/"
  } catch {
    return "/"
  }
}

export async function GET(req: NextRequest) {
  const queueId = req.nextUrl.searchParams.get("queueId")
  const destination = safeDestination(req.nextUrl.searchParams.get("url"))

  if (queueId) {
    await updateEmailDeliveryState({
      queueId,
      deliveryState: "CLICKED",
      status: "SENT",
      eventType: "click",
    }).catch(() => {})
  }

  return NextResponse.redirect(destination)
}
