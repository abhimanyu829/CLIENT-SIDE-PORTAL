import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

const createTeamSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with hyphens"),
  billingEmail: z.string().email().optional(),
})

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// GET /api/teams — list teams the current user belongs to
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const { page, limit } = paginationSchema.parse(Object.fromEntries(searchParams))
    const skip = (page - 1) * limit

    const [memberships, total] = await Promise.all([
      db.teamMember.findMany({
        where: { userId: session.user.id, inviteStatus: "ACCEPTED" },
        skip,
        take: limit,
        include: {
          team: {
            include: {
              _count: { select: { members: true } },
            },
          },
        },
      }),
      db.teamMember.count({ where: { userId: session.user.id, inviteStatus: "ACCEPTED" } }),
    ])

    return NextResponse.json({
      success: true,
      data: memberships.map((m) => ({ ...m.team, role: m.role })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    logger.error({ error }, "GET /api/teams")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

// POST /api/teams — create a new team
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createTeamSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const { name, slug, billingEmail } = parsed.data

    // Check slug uniqueness
    const existing = await db.team.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Team slug already taken" } }, { status: 409 })
    }

    // Create team + add creator as OWNER in a transaction
    const team = await db.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name,
          slug,
          ownerId: session.user.id,
          billingEmail,
        },
      })

      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          userId: session.user.id,
          role: "OWNER",
          inviteStatus: "ACCEPTED",
          acceptedAt: new Date(),
        },
      })

      return newTeam
    })

    await auditLog({
      userId: session.user.id,
      action: "team.create",
      entity: "Team",
      entityId: team.id,
      after: { name, slug },
    })

    return NextResponse.json({ success: true, data: team }, { status: 201 })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Team slug already taken" } }, { status: 409 })
    }
    logger.error({ error }, "POST /api/teams")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
