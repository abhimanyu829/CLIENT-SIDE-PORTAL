import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"

const validateCouponSchema = z.object({
  code: z.string(),
  tierId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, tierId } = validateCouponSchema.parse(body)

    const coupon = await db.coupon.findUnique({
      where: { code, isActive: true },
    })

    if (!coupon) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Invalid coupon code" }}, { status: 404 })
    }

    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return NextResponse.json({ success: false, error: { code: "COUPON_EXPIRED", message: "Coupon has expired" }}, { status: 400 })
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ success: false, error: { code: "COUPON_LIMIT_REACHED", message: "Coupon usage limit reached" }}, { status: 400 })
    }

    if (coupon.applicableTierIds.length > 0 && !coupon.applicableTierIds.includes(tierId)) {
      return NextResponse.json({ success: false, error: { code: "COUPON_NOT_APPLICABLE", message: "Coupon not valid for this tier" }}, { status: 400 })
    }

    return NextResponse.json({ success: true, data: {
      type: coupon.type,
      discountValue: coupon.discountValue,
    }})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: error.errors }}, { status: 400 })
    }
    logger.error({ error }, "API error in POST /api/payments/coupons/validate")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }}, { status: 500 })
  }
}
