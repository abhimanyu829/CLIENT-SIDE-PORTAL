import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { decryptConfig } from "@/lib/services/service-lifecycle-service"

const patchSchema = z.object({
  deploymentPriority: z.number().int().min(0).max(100).optional(),
  estimatedCompletionAt: z.string().datetime().optional().nullable(),
  autoRenew: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = patchSchema.parse(await req.json())

    const updated = await db.purchasedService.update({
      where: { id },
      data: {
        deploymentPriority: body.deploymentPriority,
        estimatedCompletionAt: body.estimatedCompletionAt ? new Date(body.estimatedCompletionAt) : body.estimatedCompletionAt === null ? null : undefined,
        autoRenew: body.autoRenew,
      },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid update" }, { status: 400 })
    console.error("[admin/deployment-center/[id] PATCH]", err)
    return NextResponse.json({ success: false, error: "Failed to update service" }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    const service = await db.purchasedService.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        order: {
          select: {
            orderNumber: true, grandTotal: true, currency: true, paidAt: true, gateway: true, status: true,
            payments: { select: { status: true, amount: true, gateway: true, paidAt: true } },
            invoices: { select: { id: true, number: true, pdfUrl: true, totalAmount: true, status: true } },
          },
        },
        orderItem: { select: { name: true, unitPrice: true, currency: true, tier: { select: { name: true, interval: true, features: true } } } },
        product: { select: { name: true, slug: true, documentationUrl: true, version: true } },
        deployment: true,
        upgrades: { orderBy: { createdAt: "desc" } },
        timeline: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    })
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ success: true, data: { ...service, config: decryptConfig(service.config) } })
  } catch (err) {
    console.error("[admin/deployment-center/[id] GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load service" }, { status: 500 })
  }
}
