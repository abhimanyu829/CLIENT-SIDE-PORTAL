import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { EmailAudienceType, EmailCampaignStatus } from "@prisma/client"
import { createEmailCampaign, scheduleEmailCampaign } from "@/lib/email/service"
import { logger } from "@/lib/logger"

const createSchema = z.object({
  name: z.string().min(2).max(120),
  subject: z.string().min(2).max(160),
  templateName: z.string().min(2).max(120),
  payload: z.record(z.any()).default({}),
  audienceType: z.nativeEnum(EmailAudienceType),
  audienceFilter: z.record(z.any()).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  sendNow: z.boolean().default(false),
  status: z.nativeEnum(EmailCampaignStatus).optional(),
})

export async function GET() {
  try {
    await requireSuperAdmin()
    const campaigns = await db.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        createdByAdmin: { select: { id: true, name: true, email: true } },
        queueItems: { select: { id: true, status: true, recipient: true, emailType: true, createdAt: true } },
      },
    })

    const stats = {
      total: campaigns.length,
      sending: campaigns.filter((c) => c.status === "SENDING").length,
      sent: campaigns.filter((c) => c.status === "SENT").length,
      draft: campaigns.filter((c) => c.status === "DRAFT").length,
    }

    return NextResponse.json({ success: true, data: campaigns, stats })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/emails")
    return NextResponse.json({ success: false, error: { message: "Unable to load email campaigns" } }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin()
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Invalid email campaign data", details: parsed.error.flatten() } }, { status: 422 })
    }

    const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null
    const campaign = await createEmailCampaign({
      name: parsed.data.name,
      subject: parsed.data.subject,
      templateName: parsed.data.templateName,
      payload: parsed.data.payload ?? {},
      audienceType: parsed.data.audienceType,
      audienceFilter: parsed.data.audienceFilter ?? null,
      scheduledAt,
      status: parsed.data.status ?? (parsed.data.sendNow ? EmailCampaignStatus.SENDING : EmailCampaignStatus.DRAFT),
      createdByAdminId: admin.userId,
    })

    if (parsed.data.sendNow) {
      await scheduleEmailCampaign(campaign.id)
    }

    return NextResponse.json({ success: true, data: campaign }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/emails")
    return NextResponse.json({ success: false, error: { message: "Unable to create email campaign" } }, { status: 500 })
  }
}
