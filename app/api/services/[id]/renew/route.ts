import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { markRenewalRequested } from "@/lib/services/renewal-service"

const renewSchema = z.object({
  days: z.number().int().min(1).max(3650).optional(),
})

/// Customer renewal: records the request and points the customer at checkout
/// for the same product/tier (existing payment pipeline remains authoritative).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    const service = await db.purchasedService.findFirst({
      where: { id, userId: session.user.id },
      include: { product: { select: { slug: true, name: true } } },
    })
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 })

    renewSchema.parse(await req.json().catch(() => ({})))
    await markRenewalRequested(service.id, session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: `/marketplace/${service.product.slug}`,
        message: "Complete checkout to renew this service. Your workspace and data stay intact.",
      },
    })
  } catch (err) {
    console.error("[services/[id]/renew POST]", err)
    return NextResponse.json({ success: false, error: "Failed to start renewal" }, { status: 500 })
  }
}
