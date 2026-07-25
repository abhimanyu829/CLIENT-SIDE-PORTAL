import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

const benefitSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  benefitType: z.enum(["FEATURE", "LIMIT", "SUPPORT", "INTEGRATION", "DISCOUNT"]).default("FEATURE"),
  benefitValue: z.string().max(100).optional().nullable(),
  isHighlighted: z.boolean().default(false),
  isIncluded: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

// GET /api/admin/subscription-center/plans/[id]/benefits
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const benefits = await db.planBenefit.findMany({
      where: { planId: id },
      orderBy: { sortOrder: "asc" },
    })
    return NextResponse.json({ success: true, data: benefits })
  } catch (err) {
    console.error("[plan benefits GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch benefits" }, { status: 500 })
  }
}

// POST /api/admin/subscription-center/plans/[id]/benefits
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const parsed = benefitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const benefit = await db.planBenefit.create({
      data: { ...parsed.data, planId: id },
    })
    return NextResponse.json({ success: true, data: benefit }, { status: 201 })
  } catch (err) {
    console.error("[plan benefits POST]", err)
    return NextResponse.json({ success: false, error: "Failed to create benefit" }, { status: 500 })
  }
}
