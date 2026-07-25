import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

const addonSchema = z.object({
  premiumServiceId: z.string().optional().nullable(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  pricingType: z.enum(["FLAT_RECURRING", "PER_UNIT_RECURRING", "ONE_TIME"]).default("FLAT_RECURRING"),
  unitName: z.string().max(50).optional().nullable(),
  unitPrice: z.number().min(0),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD"]).default("USD"),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"]).default("MONTHLY"),
  maxQuantity: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  stripePriceId: z.string().max(200).optional().nullable(),
  razorpayPlanId: z.string().max(200).optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const premiumServiceId = searchParams.get("premiumServiceId") ?? undefined
    const isActive = searchParams.get("isActive")

    const addons = await db.addonService.findMany({
      where: {
        ...(premiumServiceId ? { premiumServiceId } : {}),
        ...(isActive !== null ? { isActive: isActive === "true" } : {}),
      },
      include: {
        premiumService: { select: { id: true, name: true } },
        _count: { select: { userAddons: { where: { isActive: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    return NextResponse.json({ success: true, data: addons })
  } catch (err) {
    console.error("[addon-services GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch addon services" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    // Normalise display-text values that old cached clients may send
    if (typeof body.pricingType === "string") body.pricingType = body.pricingType.replace(/ /g, "_")
    const parsed = addonSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const addon = await db.addonService.create({ data: parsed.data })
    return NextResponse.json({ success: true, data: addon }, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ success: false, error: "An addon with this slug already exists" }, { status: 409 })
    }
    console.error("[addon-services POST]", err)
    return NextResponse.json({ success: false, error: "Failed to create addon service" }, { status: 500 })
  }
}
