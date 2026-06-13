import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { scheduleEmailCampaign } from "@/lib/email/service"
import { logger } from "@/lib/logger"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()
    const { id } = await params
    const result = await scheduleEmailCampaign(id)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/emails/[id]/send")
    return NextResponse.json({ success: false, error: { message: "Unable to send campaign" } }, { status: 500 })
  }
}
