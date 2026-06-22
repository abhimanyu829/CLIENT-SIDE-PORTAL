import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { fulfillServiceOrder } from "@/lib/services/service-commerce"
import { serializePrisma } from "@/lib/serialize-prisma"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireSuperAdmin()
    const { id } = await params

    const order = await db.serviceOrder.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service order not found" } }, { status: 404 })
    }

    const updated = await db.serviceOrder.update({
      where: { id },
      data: {
        status: order.status === "ACTIVE" ? "ACTIVE" : "PAID",
        paidAt: order.paidAt ?? new Date(),
      },
    })

    const fulfilled = await fulfillServiceOrder({
      orderId: updated.id,
      actorId: admin.userId,
    })

    return NextResponse.json({ success: true, data: serializePrisma(fulfilled) })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/services/orders/[id]/fulfill")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Unable to fulfill service order" } }, { status: 500 })
  }
}
