import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

const planSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  name: z.string().min(1).max(100),
  tagline: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  tier: z.enum(["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE"]),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"]),
  price: z.number().min(0),
  discountPrice: z.number().min(0).nullable().optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD"]).default("USD"),
  trialDays: z.number().int().min(0).default(0),
  isPopular: z.boolean().default(false),
  isRecommended: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isCustom: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  stripePlanId: z.string().max(200).optional().nullable(),
  razorpayPlanId: z.string().max(200).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const tier = searchParams.get("tier") ?? undefined
    const isActive = searchParams.get("isActive")
    const cycle = searchParams.get("billingCycle") ?? undefined

    const plans = await db.subscriptionPlan.findMany({
      where: {
        ...(tier ? { tier: tier as any } : {}),
        ...(isActive !== null ? { isActive: isActive === "true" } : {}),
        ...(cycle ? { billingCycle: cycle as any } : {}),
      },
      include: {
        benefits: { orderBy: { sortOrder: "asc" } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ success: true, data: plans })
  } catch (err) {
    console.error("[admin/subscription-center/plans GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch plans" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const parsed = planSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const { metadata, ...data } = parsed.data

    const plan = await db.subscriptionPlan.create({
      data: {
        ...data,
        price: data.price,
        discountPrice: data.discountPrice ?? null,
        metadata: (metadata ?? {}) as any,
      },
    })

    return NextResponse.json({ success: true, data: plan }, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ success: false, error: "A plan with this slug already exists" }, { status: 409 })
    }
    console.error("[admin/subscription-center/plans POST]", err)
    return NextResponse.json({ success: false, error: "Failed to create plan" }, { status: 500 })
  }
}
