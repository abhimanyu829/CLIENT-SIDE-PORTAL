import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const service = await db.servicePage.findUnique({
      where: { slug: slug },
      include: {
        category: true,
        features: { orderBy: { sortOrder: 'asc' } },
        technologies: { orderBy: { sortOrder: 'asc' } },
        faqs: { orderBy: { sortOrder: 'asc' } },
        portfolios: { orderBy: { sortOrder: 'asc' } },
        plans: { orderBy: { sortOrder: 'asc' } },
        addOns: { orderBy: { sortOrder: 'asc' } }
      }
    })

    if (!service || !service.isActive) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service not found" } }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: service })
  } catch (error) {
    logger.error({ error }, "GET /api/public/services/[slug]")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
