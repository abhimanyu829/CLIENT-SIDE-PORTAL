import { NextRequest, NextResponse } from "next/server"
import { updateEmailDeliveryState } from "@/lib/email/service"

const PIXEL = Buffer.from(
  "R0lGODlhAQABAPAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
)

export async function GET(req: NextRequest) {
  const queueId = req.nextUrl.searchParams.get("queueId")
  if (queueId) {
    await updateEmailDeliveryState({
      queueId,
      deliveryState: "OPENED",
      status: "SENT",
      eventType: "open",
    }).catch(() => {})
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  })
}
