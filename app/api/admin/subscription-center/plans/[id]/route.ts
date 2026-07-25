import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

const updateSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(100).optional(),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  tier: z.enum(["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE"]).optional(),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"]).optional(),
  price: z.number().min(0).optional(),
  discountPrice: z.number().min(0).nullable().optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD"]).optional(),
  trialDays: z.number().int().min(0).optional(),
  isPopular: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isCustom: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  stripePlanId: z.string().max(200).optional().nullable(),
  razorpayPlanId: z.string().max(200).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    const plan = await db.subscriptionPlan.findUnique({
      where: { id },
      include: {
        benefits: { orderBy: { sortOrder: "asc" } },
        _count: { select: { subscriptions: true } },
      },
    })

    if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: plan })
  } catch (err) {
    console.error("[admin/subscription-center/plans/[id] GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch plan" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: parsed.data as any,
    })

    return NextResponse.json({ success: true, data: plan })
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 })
    }
    if (err?.code === "P2002") {
      return NextResponse.json({ success: false, error: "A plan with this slug already exists" }, { status: 409 })
    }
    console.error("[admin/subscription-center/plans/[id] PATCH]", err)
    return NextResponse.json({ success: false, error: "Failed to update plan" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    // Safety check — cannot delete a plan with active subscribers
    const activeSubs = await db.userSubscription.count({
      where: { planId: id, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
    })
    if (activeSubs > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete: ${activeSubs} active subscriber(s) on this plan. Deactivate instead.` },
        { status: 422 }
      )
    }

    await db.subscriptionPlan.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 })
    }
    console.error("[admin/subscription-center/plans/[id] DELETE]", err)
    return NextResponse.json({ success: false, error: "Failed to delete plan" }, { status: 500 })
  }
}
