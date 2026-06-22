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

const createServiceSchema = z.object({
  categoryId: z.string().cuid().optional().nullable(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  title: z.string().min(2).max(100),
  heroHeading: z.string().min(2).max(200),
  heroSubheading: z.string().min(2).max(300),
  overview: z.string().min(10),
  isActive: z.boolean().default(true),
  heroImageUrl: z.string().url().optional().nullable(),
  pricingGuidance: z.string().optional().nullable(),
  businessBenefits: z.array(z.string()).optional(),
  technicalBenefits: z.array(z.string()).optional(),
  workflow: z.any().optional(),
  useCases: z.any().optional(),
  industriesServed: z.array(z.string()).optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  seoKeywords: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const services = await db.servicePage.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        _count: {
          select: { leads: true }
        }
      }
    })
    return NextResponse.json({ success: true, data: services })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/services")
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
    const parsed = createServiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const data = {
      ...parsed.data,
      categoryId: parsed.data.categoryId || null,
      heroImageUrl: parsed.data.heroImageUrl || null,
      pricingGuidance: parsed.data.pricingGuidance || null,
      businessBenefits: parsed.data.businessBenefits ?? [],
      technicalBenefits: parsed.data.technicalBenefits ?? [],
      workflow: parsed.data.workflow ?? [],
      useCases: parsed.data.useCases ?? [],
      industriesServed: parsed.data.industriesServed ?? [],
      seoTitle: parsed.data.seoTitle || null,
      seoDescription: parsed.data.seoDescription || null,
      seoKeywords: parsed.data.seoKeywords ?? [],
    }

    const service = await db.servicePage.create({ data })

    await auditLog({
      userId: session.user.id,
      action: "service_page.create",
      entity: "ServicePage",
      entityId: service.id,
      after: service,
    })

    return NextResponse.json({ success: true, data: service }, { status: 201 })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "Service slug already exists" } }, { status: 409 })
    }
    logger.error({ error }, "POST /api/admin/services")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
