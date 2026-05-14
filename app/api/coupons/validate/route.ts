import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"

const validateCouponSchema = z.object({
  code: z.string().min(1),
  tierId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const parsed = validateCouponSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Invalid request payload" } },
        { status: 400 }
      )
    }

    const { code, tierId } = parsed.data

    const coupon = await db.coupon.findUnique({
      where: { code },
    })

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Coupon not found" } },
        { status: 404 }
      )
    }

    if (!coupon.isActive) {
      return NextResponse.json(
        { success: false, error: { code: "INACTIVE", message: "Coupon is no longer active" } },
        { status: 400 }
      )
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: "EXPIRED", message: "Coupon has expired" } },
        { status: 400 }
      )
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json(
        { success: false, error: { code: "MAX_USES_REACHED", message: "Coupon usage limit reached" } },
        { status: 400 }
      )
    }

    if (coupon.applicableTierIds.length > 0 && !coupon.applicableTierIds.includes(tierId)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TIER", message: "Coupon is not applicable for this tier" } },
        { status: 400 }
      )
    }

    await auditLog({
      userId: session.user.id,
      action: "validate_coupon",
      entity: "Coupon",
      entityId: coupon.id,
      after: { code, tierId, valid: true }
    })

    return NextResponse.json({
      success: true,
      data: {
        type: coupon.type,
        discountValue: coupon.discountValue,
        currency: coupon.currency
      }
    })

  } catch (error: any) {
    logger.error({ err: error }, "Failed to validate coupon")
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    )
  }
}
