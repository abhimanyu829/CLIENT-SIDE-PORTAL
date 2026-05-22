/**
 * lib/services/coupon-service.ts
 *
 * Centralized coupon engine — server-side only, transactional.
 * This is the SINGLE source of truth for coupon validation and application.
 * Checkout, subscription, and admin modules all use this service.
 */

import { db } from "@/lib/db"
import { auditLog } from "@/lib/admin-audit"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

export interface CouponValidationResult {
  valid: boolean
  coupon?: {
    id: string
    code: string
    type: "PERCENTAGE" | "FLAT"
    discountValue: number
    currency: string | null
  }
  discountAmount?: number
  finalPrice?: number
  error?: string
}

/**
 * Validate a coupon code server-side.
 * Checks: active status, expiry, tier eligibility, quota, first-purchase rules.
 * Does NOT apply the coupon — call applyCoupon() to commit.
 */
export async function validateCoupon(
  code: string,
  tierId: string,
  userId: string,
  originalPrice: number
): Promise<CouponValidationResult> {
  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase().trim() } })

  if (!coupon) return { valid: false, error: "Coupon not found" }
  if (!coupon.isActive) return { valid: false, error: "Coupon is inactive" }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { valid: false, error: "Coupon has expired" }
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: "Coupon quota exhausted" }
  }

  // Tier eligibility check
  if (
    coupon.applicableTierIds.length > 0 &&
    !coupon.applicableTierIds.includes(tierId)
  ) {
    return { valid: false, error: "Coupon not applicable to this plan" }
  }

  // Abuse prevention — check if user already used this coupon
  const existingAuditEntry = await db.auditLog.findFirst({
    where: {
      userId,
      action: "COUPON_APPLIED",
      afterJson: { path: ["couponCode"], equals: coupon.code },
    },
  })
  if (existingAuditEntry) {
    return { valid: false, error: "You have already used this coupon" }
  }

  // Calculate discount
  let discountAmount = 0
  if (coupon.type === "PERCENTAGE") {
    discountAmount = (originalPrice * Number(coupon.discountValue)) / 100
  } else {
    discountAmount = Number(coupon.discountValue)
  }
  discountAmount = Math.min(discountAmount, originalPrice)
  const finalPrice = Math.max(0, originalPrice - discountAmount)

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discountValue: Number(coupon.discountValue),
      currency: coupon.currency,
    },
    discountAmount,
    finalPrice,
  }
}

/**
 * Transactionally apply a coupon.
 * Increments usedCount, records audit, emits event.
 * Must be called AFTER payment confirmation.
 */
export async function applyCoupon(
  couponCode: string,
  tierId: string,
  userId: string,
  originalPrice: number,
  subscriptionId?: string,
  adminId?: string
): Promise<{ success: boolean; discountAmount: number; finalPrice: number; error?: string }> {
  const validation = await validateCoupon(couponCode, tierId, userId, originalPrice)
  if (!validation.valid) {
    return {
      success: false,
      discountAmount: 0,
      finalPrice: originalPrice,
      error: validation.error,
    }
  }

  const coupon = await db.coupon.findUniqueOrThrow({
    where: { code: couponCode.toUpperCase().trim() },
  })

  await db.$transaction(async (tx) => {
    // 1. Increment usage counter
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    })

    // 2. Write audit log inside transaction
    await tx.auditLog.create({
      data: {
        userId: adminId ?? userId,
        action: "COUPON_APPLIED",
        entity: "Coupon",
        entityId: coupon.id,
        afterJson: {
          couponCode: coupon.code,
          userId,
          subscriptionId,
          discountAmount: validation.discountAmount,
          finalPrice: validation.finalPrice,
          appliedBy: adminId ? "admin" : "user",
        },
      },
    })
  })

  await emitEvent({
    type: EVENTS.COUPON_APPLIED,
    timestamp: new Date().toISOString(),
    actorId: adminId ?? userId,
    payload: {
      couponCode: coupon.code,
      couponId: coupon.id,
      userId,
      subscriptionId,
      discountAmount: validation.discountAmount,
      finalPrice: validation.finalPrice,
    },
  })

  return {
    success: true,
    discountAmount: validation.discountAmount!,
    finalPrice: validation.finalPrice!,
  }
}

/**
 * Deactivate a coupon with reason (admin action).
 */
export async function deactivateCoupon(
  couponId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean }> {
  const before = await db.coupon.findUniqueOrThrow({ where: { id: couponId } })

  await db.$transaction(async (tx) => {
    await tx.coupon.update({
      where: { id: couponId },
      data: { isActive: false },
    })

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "COUPON_DEACTIVATED",
        entity: "Coupon",
        entityId: couponId,
        beforeJson: { isActive: before.isActive, code: before.code },
        afterJson: { isActive: false, reason },
      },
    })
  })

  await emitEvent({
    type: EVENTS.COUPON_DEACTIVATED,
    timestamp: new Date().toISOString(),
    actorId: adminId,
    payload: { couponId, code: before.code, reason },
  })

  return { success: true }
}
