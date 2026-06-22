import { NextRequest, NextResponse } from "next/server"
import { requireServiceOperationsAccess } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { scheduleEmailCampaign } from "@/lib/email/service"
import { logger } from "@/lib/logger"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireServiceOperationsAccess("emails")
    const { id } = await params
    const campaign = await db.emailCampaign.findUnique({ where: { id } })
    if (!campaign) {
      return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 })
    }

    const payload = (campaign.payload as { serviceScope?: string } | null) ?? null
    if (!(campaign.templateName.toLowerCase().includes("service") || payload?.serviceScope === "SERVICES")) {
      return NextResponse.json({ success: false, error: { message: "Campaign is not part of the service email center" } }, { status: 403 })
    }

    await scheduleEmailCampaign(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/services/emails/[id]/send")
    return NextResponse.json({ success: false, error: { message: "Unable to send service campaign" } }, { status: 500 })
  }
}
