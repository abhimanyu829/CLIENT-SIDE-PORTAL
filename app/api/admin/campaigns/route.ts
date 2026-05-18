import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"

// ── Zod Schemas ───────────────────────────────────────────────────────────────
const createCampaignSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(["FESTIVAL", "FLASH", "REFERRAL", "LOYALTY", "BLACKFRIDAY", "CUSTOM"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  discountPercent: z.number().min(1).max(100),
  label: z.string().max(80).optional(),         // e.g. "Diwali Sale"
  applicableTierIds: z.array(z.string()).optional(),
  bannerText: z.string().max(200).optional(),
  isActive: z.boolean().default(false),
})

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// ── GET /api/admin/campaigns — list all campaigns ────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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

// ── POST /api/admin/campaigns — create campaign ───────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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
      name, type, startsAt, endsAt, discountPercent,
      label, applicableTierIds, bannerText, isActive,
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
        label: label ?? name,
        applicableTierIds: applicableTierIds ?? [],
        bannerText: bannerText ?? null,
        isActive,
      },
    })

    await auditLog({
      userId: session.user.id,
      action: "campaign.create",
      entity: "Campaign",
      entityId: campaign.id,
      after: campaign,
    })

    return NextResponse.json({ success: true, data: campaign }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/campaigns")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
