import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { addTimelineEvent, TIMELINE } from "@/lib/services/service-lifecycle-service"

const requestSchema = z.object({
  type: z.enum([
    "FEATURE", "DESIGN_CHANGE", "BUG_FIX", "MIGRATION", "CUSTOMIZATION",
    "CONSULTATION", "PERFORMANCE_UPGRADE", "DATABASE_UPGRADE",
    "SECURITY_UPGRADE", "INFRASTRUCTURE_UPGRADE",
  ]),
  subject: z.string().min(3).max(200),
  details: z.string().min(10).max(5000),
})

/// Service Request Center: feature/bug/migration/etc requests against an owned
/// service. Every request lands in the admin panel.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    const body = requestSchema.parse(await req.json())

    const service = await db.purchasedService.findFirst({
      where: { id, userId: session.user.id },
      include: { orderItem: { select: { name: true } } },
    })
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

    const request = await db.serviceRequest.create({
      data: {
        purchasedServiceId: service.id,
        type: body.type,
        name: body.subject,
        email: session.user.email,
        orderRef: service.orderId,
        reason: body.details,
      },
    })

    await addTimelineEvent(
      service.id,
      TIMELINE.SUPPORT_REQUEST,
      `Service request: ${body.type.replace(/_/g, " ").toLowerCase()} — ${body.subject}`,
      { requestId: request.id, type: body.type },
      session.user.id,
    )

    return NextResponse.json({ success: true, data: request }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 })
    console.error("[services/[id]/requests POST]", err)
    return NextResponse.json({ success: false, error: "Failed to submit request" }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const service = await db.purchasedService.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const requests = await db.serviceRequest.findMany({
    where: { purchasedServiceId: service.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, status: true, name: true, reason: true, adminNotes: true, createdAt: true, resolvedAt: true },
  })
  return NextResponse.json({ success: true, data: requests })
}
