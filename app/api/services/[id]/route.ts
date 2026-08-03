import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { decryptConfig } from "@/lib/services/service-lifecycle-service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    const service = await db.purchasedService.findFirst({
      where: { id, userId: session.user.id },
      include: {
        product: {
          select: {
            name: true, slug: true, thumbnailUrl: true, iconUrl: true,
            documentationUrl: true, version: true,
            serviceProfile: { select: { documentation: true, tutorials: true, supportBenefits: true } },
          },
        },
        orderItem: { select: { name: true, unitPrice: true, currency: true, tier: { select: { name: true, interval: true, features: true, limits: true } } } },
        order: {
          select: {
            orderNumber: true, grandTotal: true, currency: true, paidAt: true,
            invoices: { select: { id: true, number: true, pdfUrl: true, totalAmount: true, status: true, issuedAt: true } },
            payments: { select: { id: true, amount: true, currency: true, status: true, gateway: true, paidAt: true } },
          },
        },
        deployment: true,
        upgrades: { orderBy: { createdAt: "desc" } },
      },
    })
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const now = Date.now()
    const remainingDays = service.expiryDate ? Math.max(0, Math.ceil((service.expiryDate.getTime() - now) / 86400000)) : null

    // Credentials and config are only exposed once the service is ACTIVE.
    // Waiting/expired/suspended states never leak admin-entered data.
    const usable = service.status === "ACTIVE"
    const config = usable ? decryptConfig(service.config) : {}

    return NextResponse.json({
      success: true,
      data: { ...service, config, remainingDays },
    })
  } catch (err) {
    console.error("[services/[id] GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load service" }, { status: 500 })
  }
}
