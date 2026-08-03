import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

/// Service Request Center inbox: every customer request (feature, bug fix,
/// migration, customization, …) against an owned service.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const status = req.nextUrl.searchParams.get("status")

    const requests = await db.serviceRequest.findMany({
      where: {
        purchasedServiceId: { not: null },
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return NextResponse.json({ success: true, data: requests })
  } catch (err) {
    console.error("[admin/deployment-center/requests GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load requests" }, { status: 500 })
  }
}

const patchSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["OPEN", "APPROVED", "REJECTED", "CLOSED"]),
  adminNotes: z.string().max(2000).optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = patchSchema.parse(await req.json())

    const updated = await db.serviceRequest.update({
      where: { id: body.requestId },
      data: {
        status: body.status,
        adminNotes: body.adminNotes,
        reviewedBy: admin.userId,
        reviewedAt: new Date(),
        resolvedAt: body.status === "CLOSED" ? new Date() : undefined,
      },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    console.error("[admin/deployment-center/requests PATCH]", err)
    return NextResponse.json({ success: false, error: "Failed to update request" }, { status: 500 })
  }
}
