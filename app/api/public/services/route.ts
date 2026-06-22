import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest) {
  try {
    const services = await db.servicePage.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        category: true
      }
    })
    return NextResponse.json({ success: true, data: services })
  } catch (error) {
    logger.error({ error }, "GET /api/public/services")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
