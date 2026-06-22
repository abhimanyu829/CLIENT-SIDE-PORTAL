import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const serviceId = searchParams.get("serviceId")

    const leads = await db.serviceLead.findMany({
      where: serviceId ? { servicePageId: serviceId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        servicePage: {
          select: { title: true, slug: true }
        }
      }
    })
    
    return NextResponse.json({ success: true, data: leads })
  } catch (error) {
    logger.error({ error }, "GET /api/admin/services/leads")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
