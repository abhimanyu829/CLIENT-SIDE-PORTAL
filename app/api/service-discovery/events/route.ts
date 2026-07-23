import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { recordServiceCampaignEvent, recordServiceDiscoveryEvent } from "@/lib/service-discovery"

const eventSchema = z.object({
  eventType: z.enum(["VIEW", "CLICK", "SEARCH", "WISHLIST_SIGNAL", "CART_SIGNAL", "PURCHASE_SIGNAL"]),
  servicePageId: z.string().cuid().optional(),
  query: z.string().trim().max(200).optional(),
  campaignId: z.string().cuid().optional(),
  campaignEventType: z.enum(["IMPRESSION", "CLICK", "CONVERSION"]).optional(),
  value: z.number().nonnegative().max(10000000).optional(),
})

export async function POST(request: NextRequest) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid discovery event" }, { status: 422 })
  const session = await auth()
  const sessionKey = request.headers.get("x-discovery-session")?.slice(0, 120) ?? null
  const event = await recordServiceDiscoveryEvent({ ...parsed.data, userId: session?.user?.id, sessionKey })
  if (parsed.data.campaignId && parsed.data.campaignEventType) {
    await recordServiceCampaignEvent({
      campaignId: parsed.data.campaignId, eventType: parsed.data.campaignEventType,
      userId: session?.user?.id, sessionKey, servicePageId: parsed.data.servicePageId, value: parsed.data.value,
    })
  }
  return NextResponse.json({ success: true, data: { id: event.id } })
}
