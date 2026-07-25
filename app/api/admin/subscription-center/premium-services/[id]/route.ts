import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

const updateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).max(150).optional(),
  shortDescription: z.string().max(500).optional(),
  fullDescription: z.string().max(5000).optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  basePrice: z.number().min(0).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD"]).optional(),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"]).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const service = await db.premiumService.findUnique({
      where: { id },
      include: {
        category: true,
        addonServices: { orderBy: { sortOrder: "asc" } },
      },
    })
    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: service })
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to fetch service" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    // Coerce empty strings to null so z.string().url() doesn't reject blank inputs
    if (body.iconUrl === "") body.iconUrl = null
    if (body.bannerUrl === "") body.bannerUrl = null
    if (body.fullDescription === "") body.fullDescription = null
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }
    const service = await db.premiumService.update({ where: { id }, data: parsed.data as any })
    return NextResponse.json({ success: true, data: service })
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })
    return NextResponse.json({ success: false, error: "Failed to update service" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.premiumService.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })
    return NextResponse.json({ success: false, error: "Failed to delete service" }, { status: 500 })
  }
}
