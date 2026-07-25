import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Public endpoint - no auth required
// Returns active plans with their benefits for the pricing page
export async function GET(_req: NextRequest) {
  try {
    const plans = await db.subscriptionPlan.findMany({
      where: { isActive: true },
      include: {
        benefits: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    })

    return NextResponse.json({
      success: true,
      data: plans.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        tier: p.tier,
        billingCycle: p.billingCycle,
        price: Number(p.price),
        discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
        currency: p.currency,
        trialDays: p.trialDays,
        isPopular: p.isPopular,
        isRecommended: p.isRecommended,
        isCustom: p.isCustom,
        benefits: p.benefits.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          benefitType: b.benefitType,
          benefitValue: b.benefitValue,
          isHighlighted: b.isHighlighted,
          isIncluded: b.isIncluded,
          sortOrder: b.sortOrder,
        })),
      })),
    })
  } catch (err) {
    console.error("[public/pricing GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch pricing" }, { status: 500 })
  }
}
