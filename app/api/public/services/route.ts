import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 })
  const { hasAcceptedCurrentLegal } = await import("@/lib/legal-consent")
  if (!(await hasAcceptedCurrentLegal(session.user.id).catch(() => false))) return NextResponse.json({ success: false, error: { code: "CONSENT_REQUIRED", message: "Terms and Privacy acceptance required." } }, { status: 403 })
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
