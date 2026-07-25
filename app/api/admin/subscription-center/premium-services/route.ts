import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

const serviceSchema = z.object({
  categoryId: z.string().optional().nullable(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(150),
  shortDescription: z.string().max(500),
  fullDescription: z.string().max(5000).optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  basePrice: z.number().min(0),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD"]).default("USD"),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"]).default("MONTHLY"),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get("categoryId") ?? undefined
    const isActive = searchParams.get("isActive")
    const isFeatured = searchParams.get("isFeatured")

    const services = await db.premiumService.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
        ...(isActive !== null ? { isActive: isActive === "true" } : {}),
        ...(isFeatured !== null ? { isFeatured: isFeatured === "true" } : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { addonServices: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    return NextResponse.json({ success: true, data: services })
  } catch (err) {
    console.error("[premium-services GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch services" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    // Coerce empty strings to null so z.string().url() doesn't reject blank inputs
    if (body.iconUrl === "") body.iconUrl = null
    if (body.bannerUrl === "") body.bannerUrl = null
    if (body.fullDescription === "") body.fullDescription = null
    const parsed = serviceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const { metadata, ...data } = parsed.data
    const service = await db.premiumService.create({
      data: { ...data, metadata: (metadata ?? {}) as any },
    })

    return NextResponse.json({ success: true, data: service }, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ success: false, error: "A service with this slug already exists" }, { status: 409 })
    }
    console.error("[premium-services POST]", err)
    return NextResponse.json({ success: false, error: "Failed to create service" }, { status: 500 })
  }
}
