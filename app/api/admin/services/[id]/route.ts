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

const updateServiceSchema = z.object({
  categoryId: z.string().cuid().optional().nullable(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "slug must be kebab-case").optional(),
  title: z.string().min(2).max(100).optional(),
  heroHeading: z.string().min(2).max(200).optional(),
  heroSubheading: z.string().min(2).max(300).optional(),
  heroImageUrl: z.string().url().optional().nullable(),
  overview: z.string().min(10).optional(),
  businessBenefits: z.array(z.string()).optional(),
  technicalBenefits: z.array(z.string()).optional(),
  workflow: z.any().optional(),
  useCases: z.any().optional(),
  industriesServed: z.array(z.string()).optional(),
  pricingGuidance: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  seoKeywords: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const service = await db.servicePage.findUnique({
      where: { id: id },
      include: {
        category: true,
        features: true,
        technologies: true,
        faqs: true,
        portfolios: true,
        plans: true,
        addOns: true,
        mediaAssets: true,
        documents: true,
      }
    })

    if (!service) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service not found" } }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: service })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/services/[id]")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateServiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const before = await db.servicePage.findUnique({ where: { id: id } })
    if (!before) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service not found" } }, { status: 404 })
    }

    const data = {
      ...parsed.data,
      categoryId: parsed.data.categoryId === undefined ? undefined : (parsed.data.categoryId || null),
      heroImageUrl: parsed.data.heroImageUrl === undefined ? undefined : (parsed.data.heroImageUrl || null),
      pricingGuidance: parsed.data.pricingGuidance === undefined ? undefined : (parsed.data.pricingGuidance || null),
      seoTitle: parsed.data.seoTitle === undefined ? undefined : (parsed.data.seoTitle || null),
      seoDescription: parsed.data.seoDescription === undefined ? undefined : (parsed.data.seoDescription || null),
      businessBenefits: parsed.data.businessBenefits ?? undefined,
      technicalBenefits: parsed.data.technicalBenefits ?? undefined,
      workflow: parsed.data.workflow ?? undefined,
      useCases: parsed.data.useCases ?? undefined,
      industriesServed: parsed.data.industriesServed ?? undefined,
      seoKeywords: parsed.data.seoKeywords ?? undefined,
    }

    const service = await db.servicePage.update({
      where: { id: id },
      data
    })

    await auditLog({
      userId: session.user.id,
      action: "service_page.update",
      entity: "ServicePage",
      entityId: service.id,
      before,
      after: service,
    })

    return NextResponse.json({ success: true, data: service })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Service slug already exists" } }, { status: 409 })
    }
    logger.error({ error }, "PUT /api/admin/services/[id]")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const service = await db.servicePage.delete({ where: { id: id } })

    await auditLog({
      userId: session.user.id,
      action: "service_page.delete",
      entity: "ServicePage",
      entityId: service.id,
      before: service,
    })

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    logger.error({ error }, "DELETE /api/admin/services/[id]")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
