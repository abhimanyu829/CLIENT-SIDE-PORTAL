import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * GET /api/campaigns/active
 * Public endpoint — returns the currently active campaign (if any) with countdown info.
 * Used by the frontend for banners, pricing-page timers, and cart discounts.
 */
export async function GET() {
  try {
    const now = new Date()

    const campaign = await db.campaign.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { discountPercent: "desc" }, // surface highest discount first
    })

    if (!campaign) {
      return NextResponse.json({ success: true, data: null })
    }

    const secondsRemaining = Math.max(
      0,
      Math.floor((campaign.endsAt.getTime() - now.getTime()) / 1000)
    )

    return NextResponse.json({
      success: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        label: campaign.label,
        type: campaign.type,
        discountPercent: campaign.discountPercent,
        bannerText: campaign.bannerText,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
        applicableTierIds: campaign.applicableTierIds,
        secondsRemaining,
      },
    })
  } catch (error) {
    logger.error({ error }, "GET /api/campaigns/active")
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}
