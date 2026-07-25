import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

const updateSchema = z.object({
  premiumServiceId: z.string().optional().nullable(),
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(2000).optional().nullable(),
  pricingType: z.enum(["FLAT_RECURRING", "PER_UNIT_RECURRING", "ONE_TIME"]).optional(),
  unitName: z.string().max(50).optional().nullable(),
  unitPrice: z.number().min(0).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD"]).optional(),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"]).optional(),
  maxQuantity: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  stripePriceId: z.string().max(200).optional().nullable(),
  razorpayPlanId: z.string().max(200).optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    // Normalise display-text values that old cached clients may send
    if (typeof body.pricingType === "string") body.pricingType = body.pricingType.replace(/ /g, "_")
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }
    const addon = await db.addonService.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ success: true, data: addon })
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ success: false, error: "Addon not found" }, { status: 404 })
    return NextResponse.json({ success: false, error: "Failed to update addon" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const activeCount = await db.userSubscriptionAddon.count({ where: { addonServiceId: id, isActive: true } })
    if (activeCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete: ${activeCount} users have this addon active. Deactivate instead.` },
        { status: 422 }
      )
    }
    await db.addonService.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ success: false, error: "Addon not found" }, { status: 404 })
    return NextResponse.json({ success: false, error: "Failed to delete addon" }, { status: 500 })
  }
}
