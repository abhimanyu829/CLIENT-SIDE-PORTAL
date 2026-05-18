import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

const createFlagSchema = z.object({
  name: z.string().min(2).max(80).regex(/^[a-z0-9_]+$/, "name must be snake_case"),
  description: z.string().max(300).optional(),
  isEnabled: z.boolean().default(false),
  rolloutPercent: z.number().int().min(0).max(100).default(100),
  targetUserIds: z.array(z.string()).default([]),
})

const updateFlagSchema = createFlagSchema.partial().omit({ name: true })

// GET /api/admin/feature-flags
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const flags = await db.featureFlag.findMany({ orderBy: { name: "asc" } })
    return NextResponse.json({ success: true, data: flags })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/feature-flags")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

// POST /api/admin/feature-flags — create flag
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createFlagSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const flag = await db.featureFlag.create({ data: parsed.data })

    await auditLog({
      userId: session.user.id,
      action: "feature_flag.create",
      entity: "FeatureFlag",
      entityId: flag.id,
      after: flag,
    })

    return NextResponse.json({ success: true, data: flag }, { status: 201 })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Flag name already exists" } }, { status: 409 })
    }
    logger.error({ error }, "POST /api/admin/feature-flags")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

// PATCH /api/admin/feature-flags/[name] — toggle / update flag
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const { name, ...rest } = body
    if (!name) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Flag name required" } }, { status: 400 })
    }

    const parsed = updateFlagSchema.safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const before = await db.featureFlag.findUnique({ where: { name } })
    const flag = await db.featureFlag.update({ where: { name }, data: parsed.data })

    await auditLog({
      userId: session.user.id,
      action: "feature_flag.update",
      entity: "FeatureFlag",
      entityId: flag.id,
      before: before ?? undefined,
      after: flag,
    })

    return NextResponse.json({ success: true, data: flag })
  } catch (error) {
    logger.error({ error }, "PATCH /api/admin/feature-flags")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
