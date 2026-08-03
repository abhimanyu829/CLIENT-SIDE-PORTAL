import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

const addonUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().min(2).max(40).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  specs: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  applicableProductIds: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ addonId: string }> }) {
  try {
    await requireAdmin()
    const { addonId } = await params
    const body = addonUpdateSchema.parse(await req.json())
    const addon = await db.addonCatalogItem.update({ where: { id: addonId }, data: body })
    return NextResponse.json({ success: true, data: addon })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid add-on" }, { status: 400 })
    console.error("[admin/deployment-center/addons/[addonId] PATCH]", err)
    return NextResponse.json({ success: false, error: "Failed to update add-on" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ addonId: string }> }) {
  try {
    await requireAdmin()
    const { addonId } = await params
    await db.addonCatalogItem.delete({ where: { id: addonId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/deployment-center/addons/[addonId] DELETE]", err)
    return NextResponse.json({ success: false, error: "Failed to delete add-on" }, { status: 500 })
  }
}
