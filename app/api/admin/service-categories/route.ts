import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

const categorySchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional().default(0),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const categories = await db.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { services: true } } },
    })

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/service-categories")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const parsed = categorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const category = await db.serviceCategory.create({
      data: {
        ...parsed.data,
        description: parsed.data.description || null,
      },
    })

    await auditLog({
      userId: session.user.id,
      action: "service_category.create",
      entity: "ServiceCategory",
      entityId: category.id,
      after: category,
    })

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Service category slug already exists" } }, { status: 409 })
    }
    logger.error({ error }, "POST /api/admin/service-categories")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
