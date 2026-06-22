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

const updateSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "slug must be kebab-case").optional(),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const before = await db.serviceCategory.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Category not found" } }, { status: 404 })
    }

    const category = await db.serviceCategory.update({
      where: { id },
      data: {
        ...parsed.data,
        description: parsed.data.description === undefined ? undefined : (parsed.data.description || null),
      },
    })

    await auditLog({
      userId: session.user.id,
      action: "service_category.update",
      entity: "ServiceCategory",
      entityId: category.id,
      before,
      after: category,
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Service category slug already exists" } }, { status: 409 })
    }
    logger.error({ error }, "PUT /api/admin/service-categories/[id]")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const before = await db.serviceCategory.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Category not found" } }, { status: 404 })
    }

    await db.serviceCategory.delete({ where: { id } })

    await auditLog({
      userId: session.user.id,
      action: "service_category.delete",
      entity: "ServiceCategory",
      entityId: id,
      before,
    })

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error: any) {
    if (error?.code === "P2003") {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Delete or reassign services before removing this category" } }, { status: 409 })
    }
    logger.error({ error }, "DELETE /api/admin/service-categories/[id]")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
