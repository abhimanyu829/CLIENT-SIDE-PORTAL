import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

const addonSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().min(2).max(40).default("GENERAL"),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("INR"),
  specs: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  applicableProductIds: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
})

export async function GET(_req: NextRequest) {
  try {
    await requireAdmin()
    const addons = await db.addonCatalogItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] })
    return NextResponse.json({ success: true, data: addons })
  } catch (err) {
    console.error("[admin/deployment-center/addons GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load add-ons" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = addonSchema.parse(await req.json())
    const addon = await db.addonCatalogItem.create({ data: body })
    return NextResponse.json({ success: true, data: addon }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid add-on", issues: err.issues }, { status: 400 })
    console.error("[admin/deployment-center/addons POST]", err)
    return NextResponse.json({ success: false, error: "Failed to create add-on" }, { status: 500 })
  }
}
