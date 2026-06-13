import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { CampaignStatus } from "@prisma/client"
import { revalidateCampaigns } from "@/lib/revalidate"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

// ── Zod Schemas ───────────────────────────────────────────────────────────────
const createCampaignSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(["FESTIVAL", "FLASH", "REFERRAL", "LOYALTY", "BLACKFRIDAY", "INFLUENCER", "AB_TEST", "RETENTION", "AFFILIATE", "CUSTOM"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  discountPercent: z.number().min(0).max(100).default(0),
  flatDiscount: z.number().optional(),
  label: z.string().max(80).optional(),
  applicableTierIds: z.array(z.string()).optional(),
  applicableProductIds: z.array(z.string()).optional(),
  bannerText: z.string().max(200).optional(),
  bannerImageUrl: z.string().url().optional(),
  ctaText: z.string().max(80).optional(),
  ctaUrl: z.string().optional(),
  status: z.nativeEnum(CampaignStatus).default(CampaignStatus.DRAFT),
  targetSegment: z.string().optional(),
  allowedGeos: z.array(z.string()).optional(),
})

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// ── GET /api/admin/campaigns ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user?.id || (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN")) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const { page, limit } = paginationSchema.parse(Object.fromEntries(searchParams))
    const skip = (page - 1) * limit

    const [campaigns, total] = await Promise.all([
      db.campaign.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.campaign.count(),
    ])

    return NextResponse.json({
      success: true,
      data: campaigns,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/campaigns")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

// ── POST /api/admin/campaigns ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user?.id || (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN")) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const {
      name, type, startsAt, endsAt, discountPercent, flatDiscount,
      label, applicableTierIds, applicableProductIds, bannerText,
      bannerImageUrl, ctaText, ctaUrl, status, targetSegment, allowedGeos,
    } = parsed.data

    const starts = new Date(startsAt)
    const ends = new Date(endsAt)

    if (ends <= starts) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "endsAt must be after startsAt" } },
        { status: 400 }
      )
    }

    const campaign = await db.campaign.create({
      data: {
        name,
        type,
        startsAt: starts,
        endsAt: ends,
        discountPercent,
        flatDiscount: flatDiscount ? flatDiscount : undefined,
        label: label ?? name,
        applicableTierIds: applicableTierIds ?? [],
        applicableProductIds: applicableProductIds ?? [],
        bannerText: bannerText ?? null,
        bannerImageUrl: bannerImageUrl ?? null,
        ctaText: ctaText ?? null,
        ctaUrl: ctaUrl ?? null,
        status,
        targetSegment: targetSegment ?? null,
        allowedGeos: allowedGeos ?? [],
        createdBy: session.user.id,
      },
    })

    await auditLog({
      userId: session.user.id,
      action: "campaign.create",
      entity: "Campaign",
      entityId: campaign.id,
      after: campaign,
    })

    // Revalidate public pages if campaign is active
    if (status === CampaignStatus.ACTIVE) {
      revalidateCampaigns()
      await emitEvent({
        type: EVENTS.CAMPAIGN_STARTED,
        timestamp: new Date().toISOString(),
        payload: { campaignId: campaign.id, campaignName: name },
        actorId: session.user.id,
      })
    }

    return NextResponse.json({ success: true, data: campaign }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/campaigns")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
