import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  benefitType: z.enum(["FEATURE", "LIMIT", "SUPPORT", "INTEGRATION", "DISCOUNT"]).optional(),
  benefitValue: z.string().max(100).optional().nullable(),
  isHighlighted: z.boolean().optional(),
  isIncluded: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; benefitId: string }> }
) {
  try {
    await requireAdmin()
    const { benefitId } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }
    const benefit = await db.planBenefit.update({ where: { id: benefitId }, data: parsed.data })
    return NextResponse.json({ success: true, data: benefit })
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ success: false, error: "Benefit not found" }, { status: 404 })
    return NextResponse.json({ success: false, error: "Failed to update benefit" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; benefitId: string }> }
) {
  try {
    await requireAdmin()
    const { benefitId } = await params
    await db.planBenefit.delete({ where: { id: benefitId } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ success: false, error: "Benefit not found" }, { status: 404 })
    return NextResponse.json({ success: false, error: "Failed to delete benefit" }, { status: 500 })
  }
}
