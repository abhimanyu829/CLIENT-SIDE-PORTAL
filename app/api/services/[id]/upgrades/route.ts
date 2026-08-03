import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { addTimelineEvent, TIMELINE } from "@/lib/services/service-lifecycle-service"

const upgradeSchema = z.object({
  addonId: z.string().min(1),
})

/// Customer purchases an add-on: creates an upgrade request for the admin.
/// Payment confirmation (any gateway) flips it to PAID; admin applies it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    const { addonId } = upgradeSchema.parse(await req.json())

    const service = await db.purchasedService.findFirst({
      where: { id, userId: session.user.id },
      include: { orderItem: { select: { name: true } } },
    })
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

    const addon = await db.addonCatalogItem.findFirst({
      where: {
        id: addonId,
        isActive: true,
        OR: [{ applicableProductIds: { isEmpty: true } }, { applicableProductIds: { has: service.productId } }],
      },
    })
    if (!addon) return NextResponse.json({ error: "Add-on not available for this service" }, { status: 404 })

    const existing = await db.serviceUpgrade.findFirst({
      where: { purchasedServiceId: service.id, addonId, status: { in: ["PENDING", "PAID"] } },
    })
    if (existing) return NextResponse.json({ error: "This upgrade is already in progress" }, { status: 409 })

    const upgrade = await db.serviceUpgrade.create({
      data: {
        purchasedServiceId: service.id,
        userId: session.user.id,
        addonId,
        status: "PENDING",
        snapshot: {
          name: addon.name,
          category: addon.category,
          price: addon.price.toString(),
          currency: addon.currency,
          specs: addon.specs,
        },
      },
    })

    await addTimelineEvent(service.id, TIMELINE.UPGRADE_PURCHASED, `Upgrade requested: ${addon.name}`, { upgradeId: upgrade.id, addonId }, session.user.id)
    emailQueue
      .add(EMAIL_JOBS.SEND_UPGRADE_PURCHASED, { userId: session.user.id, serviceName: service.orderItem.name, addonName: addon.name, purchasedServiceId: service.id })
      .catch(() => {})

    return NextResponse.json({ success: true, data: upgrade }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    console.error("[services/[id]/upgrades POST]", err)
    return NextResponse.json({ success: false, error: "Failed to request upgrade" }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const upgrades = await db.serviceUpgrade.findMany({
    where: { purchasedServiceId: id, userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ success: true, data: upgrades })
}
