"use server"

import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-auth"
import { revalidatePath, revalidateTag } from "next/cache"
import { CouponType, CampaignType, CampaignStatus } from "@prisma/client"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

// ─── ISR Revalidation ─────────────────────────────────────────────────────────────

const REVALIDATE_PROFILE = "" // Next.js 16 requires second arg

async function revalidateCouponCaches() {
  revalidateTag("coupons", REVALIDATE_PROFILE)
  revalidateTag("campaigns", REVALIDATE_PROFILE)
  revalidateTag("pricing", REVALIDATE_PROFILE)
  revalidateTag("home-promotions", REVALIDATE_PROFILE)
  revalidatePath("/admin/coupons")
  revalidatePath("/")
  revalidatePath("/pricing")
  revalidatePath("/checkout")
}

// ─── Create Coupon ────────────────────────────────────────────────────────────────

export async function createCoupon(data: {
  code: string
  name?: string | null
  description?: string | null
  type: CouponType
  discountValue: number
  maxDiscountCap?: number | null
  freeCredits?: number | null
  freeTokens?: number | null
  trialExtensionDays?: number | null
  maxUses: number | null
  perUserLimit?: number
  expiresAt: string | null
  startsAt?: string | null
  applicableTierIds: string[]
  applicableProductIds?: string[]
  minCartValue?: number | null
  allowedGeos?: string[]
  blockedGeos?: string[]
  targetSegment?: string | null
  requiresSubscription?: boolean
  newUsersOnly?: boolean
  campaignId?: string | null
  affiliateCode?: string | null
  affiliateCommission?: number | null
  isActive: boolean
}) {
  const admin = await requireAdmin()

  const coupon = await db.$transaction(async (tx) => {
    // Check for duplicate code
    const existing = await tx.coupon.findUnique({ where: { code: data.code.toUpperCase().trim() } })
    if (existing) throw new Error(`Coupon code "${data.code}" already exists.`)

    const newCoupon = await tx.coupon.create({
      data: {
        code: data.code.toUpperCase().trim(),
        name: data.name,
        description: data.description,
        type: data.type,
        discountValue: data.discountValue,
        maxDiscountCap: data.maxDiscountCap,
        freeCredits: data.freeCredits,
        freeTokens: data.freeTokens,
        trialExtensionDays: data.trialExtensionDays,
        maxUses: data.maxUses,
        perUserLimit: data.perUserLimit ?? 1,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        applicableTierIds: data.applicableTierIds,
        applicableProductIds: data.applicableProductIds ?? [],
        minCartValue: data.minCartValue,
        allowedGeos: data.allowedGeos ?? [],
        blockedGeos: data.blockedGeos ?? [],
        targetSegment: data.targetSegment,
        requiresSubscription: data.requiresSubscription ?? false,
        newUsersOnly: data.newUsersOnly ?? false,
        campaignId: data.campaignId,
        affiliateCode: data.affiliateCode,
        affiliateCommission: data.affiliateCommission,
        isActive: data.isActive,
        createdBy: admin.userId,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "COUPON_CREATED",
        entity: "Coupon",
        entityId: newCoupon.id,
        afterJson: {
          code: newCoupon.code,
          type: newCoupon.type,
          discountValue: String(newCoupon.discountValue),
          maxUses: newCoupon.maxUses,
          expiresAt: newCoupon.expiresAt?.toISOString() ?? null,
        },
      },
    })

    return newCoupon
  })

  await emitEvent({
    type: EVENTS.COUPON_CREATED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: { couponId: coupon.id, code: coupon.code, type: coupon.type },
  })

  await revalidateCouponCaches()
  return coupon
}

// ─── Update Coupon ────────────────────────────────────────────────────────────────

export async function updateCoupon(couponId: string, data: {
  name?: string | null
  description?: string | null
  type: CouponType
  discountValue: number
  maxDiscountCap?: number | null
  freeCredits?: number | null
  freeTokens?: number | null
  trialExtensionDays?: number | null
  maxUses: number | null
  perUserLimit?: number
  expiresAt: string | null
  startsAt?: string | null
  applicableTierIds: string[]
  applicableProductIds?: string[]
  minCartValue?: number | null
  allowedGeos?: string[]
  blockedGeos?: string[]
  targetSegment?: string | null
  requiresSubscription?: boolean
  newUsersOnly?: boolean
  isActive: boolean
}) {
  const admin = await requireAdmin()

  const coupon = await db.$transaction(async (tx) => {
    const before = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } })

    const updated = await tx.coupon.update({
      where: { id: couponId },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        discountValue: data.discountValue,
        maxDiscountCap: data.maxDiscountCap,
        freeCredits: data.freeCredits,
        freeTokens: data.freeTokens,
        trialExtensionDays: data.trialExtensionDays,
        maxUses: data.maxUses,
        perUserLimit: data.perUserLimit ?? 1,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        applicableTierIds: data.applicableTierIds,
        applicableProductIds: data.applicableProductIds ?? [],
        minCartValue: data.minCartValue,
        allowedGeos: data.allowedGeos ?? [],
        blockedGeos: data.blockedGeos ?? [],
        targetSegment: data.targetSegment,
        requiresSubscription: data.requiresSubscription ?? false,
        newUsersOnly: data.newUsersOnly ?? false,
        isActive: data.isActive,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "COUPON_UPDATED",
        entity: "Coupon",
        entityId: couponId,
        beforeJson: { isActive: before.isActive, discountValue: String(before.discountValue) },
        afterJson: { isActive: updated.isActive, discountValue: String(updated.discountValue) },
      },
    })

    return updated
  })

  await revalidateCouponCaches()
  return coupon
}

// ─── Bulk Generate Coupons ────────────────────────────────────────────────────────

export async function bulkGenerateCoupons(data: {
  prefix: string
  count: number
  type: CouponType
  discountValue: number
  maxUses: number | null
  expiresAt: string | null
  applicableTierIds: string[]
  campaignId?: string | null
}) {
  const admin = await requireAdmin()

  if (data.count > 500) throw new Error("Maximum 500 coupons can be generated at once.")

  const createdCodes = await db.$transaction(async (tx) => {
    const coupons: Array<{ id: string; code: string }> = []

    for (let i = 0; i < data.count; i++) {
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
      const code = `${data.prefix.toUpperCase().trim()}-${randomSuffix}`

      const coupon = await tx.coupon.create({
        data: {
          code,
          type: data.type,
          discountValue: data.discountValue,
          maxUses: data.maxUses,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          applicableTierIds: data.applicableTierIds,
          campaignId: data.campaignId,
          isActive: true,
          createdBy: admin.userId,
          allowedGeos: [],
          blockedGeos: [],
          applicableProductIds: [],
        },
      })
      coupons.push(coupon)
    }

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "COUPONS_BULK_GENERATED",
        entity: "Coupon",
        afterJson: {
          count: data.count,
          prefix: data.prefix,
          type: data.type,
          discountValue: data.discountValue,
          campaignId: data.campaignId,
        },
      },
    })

    return coupons
  })

  await revalidateCouponCaches()
  return createdCodes
}

// ─── Deactivate Coupon ────────────────────────────────────────────────────────────

export async function deactivateCouponAction(couponId: string, reason: string) {
  const admin = await requireAdmin()

  const coupon = await db.$transaction(async (tx) => {
    const existing = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } })

    const updated = await tx.coupon.update({
      where: { id: couponId },
      data: { isActive: false },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "COUPON_DEACTIVATED",
        entity: "Coupon",
        entityId: couponId,
        beforeJson: { isActive: existing.isActive, code: existing.code },
        afterJson: { isActive: false, reason },
      },
    })

    return updated
  })

  await emitEvent({
    type: EVENTS.COUPON_DEACTIVATED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: { couponId, code: coupon.code, reason },
  })

  await revalidateCouponCaches()
  return coupon
}

// ─── Delete Coupon ────────────────────────────────────────────────────────────────

export async function deleteCoupon(couponId: string) {
  const admin = await requireAdmin()

  await db.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } })
    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "COUPON_DELETED",
        entity: "Coupon",
        entityId: couponId,
        beforeJson: { code: coupon.code, type: coupon.type },
      },
    })
    await tx.coupon.delete({ where: { id: couponId } })
  })

  await revalidateCouponCaches()
  return { success: true }
}

// ─── Server-Side Coupon Validation (Concurrency-safe) ────────────────────────────

export async function validateCoupon(data: {
  code: string
  userId: string
  tierIds?: string[]
  cartValue?: number
  userGeo?: string
  isNewUser?: boolean
  hasActiveSubscription?: boolean
}) {
  const code = data.code.toUpperCase().trim()
  const now = new Date()

  // Atomic validation in transaction
  const result = await db.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({ where: { code } })
    if (!coupon) return { valid: false, error: "Coupon code not found." }
    if (!coupon.isActive) return { valid: false, error: "This coupon is no longer active." }
    if (coupon.startsAt && coupon.startsAt > now) return { valid: false, error: "This coupon is not yet active." }
    if (coupon.expiresAt && coupon.expiresAt < now) return { valid: false, error: "This coupon has expired." }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { valid: false, error: "This coupon has reached its usage limit." }

    // Per-user limit check
    if (coupon.perUserLimit > 0) {
      const userUsageCount = await tx.couponUsage.count({
        where: { couponId: coupon.id, userId: data.userId },
      })
      if (userUsageCount >= coupon.perUserLimit) return { valid: false, error: `You have already used this coupon ${coupon.perUserLimit > 1 ? coupon.perUserLimit + " times" : ""}.` }
    }

    // Targeting restrictions
    if (coupon.newUsersOnly && !data.isNewUser) return { valid: false, error: "This coupon is for new users only." }
    if (coupon.requiresSubscription && !data.hasActiveSubscription) return { valid: false, error: "This coupon requires an active subscription." }

    // Geo restrictions
    if (data.userGeo) {
      if (coupon.allowedGeos.length > 0 && !coupon.allowedGeos.includes(data.userGeo)) return { valid: false, error: "This coupon is not available in your region." }
      if (coupon.blockedGeos.includes(data.userGeo)) return { valid: false, error: "This coupon is not available in your region." }
    }

    // Min cart value
    if (coupon.minCartValue && data.cartValue && data.cartValue < Number(coupon.minCartValue)) {
      return { valid: false, error: `Minimum cart value of ${coupon.minCartValue} required.` }
    }

    // Plan restrictions
    if (coupon.applicableTierIds.length > 0 && data.tierIds) {
      const hasValidTier = data.tierIds.some(tid => coupon.applicableTierIds.includes(tid))
      if (!hasValidTier) return { valid: false, error: "This coupon is not applicable to your selected plan." }
    }

    return { valid: true, coupon }
  })

  return result
}

// ─── Create Campaign ──────────────────────────────────────────────────────────────

export async function createCampaign(data: {
  name: string
  label?: string | null
  description?: string | null
  type: CampaignType
  status?: CampaignStatus
  startsAt: string
  endsAt: string
  discountPercent?: number
  flatDiscount?: number | null
  bannerText?: string | null
  bannerImageUrl?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  applicableTierIds: string[]
  applicableProductIds?: string[]
  targetSegment?: string | null
  allowedGeos?: string[]
  isAbTest?: boolean
  abVariantA?: any
  abVariantB?: any
  isActive: boolean
}) {
  const admin = await requireAdmin()

  const campaign = await db.$transaction(async (tx) => {
    const newCampaign = await tx.campaign.create({
      data: {
        name: data.name,
        label: data.label,
        description: data.description,
        type: data.type,
        status: data.status ?? (data.isActive ? "ACTIVE" : "DRAFT"),
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        discountPercent: data.discountPercent ?? 0,
        flatDiscount: data.flatDiscount,
        bannerText: data.bannerText,
        bannerImageUrl: data.bannerImageUrl,
        ctaText: data.ctaText,
        ctaUrl: data.ctaUrl,
        applicableTierIds: data.applicableTierIds,
        applicableProductIds: data.applicableProductIds ?? [],
        targetSegment: data.targetSegment,
        allowedGeos: data.allowedGeos ?? [],
        isAbTest: data.isAbTest ?? false,
        abVariantA: data.abVariantA,
        abVariantB: data.abVariantB,
        isActive: data.isActive,
        createdBy: admin.userId,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "CAMPAIGN_CREATED",
        entity: "Campaign",
        entityId: newCampaign.id,
        afterJson: {
          name: newCampaign.name,
          type: newCampaign.type,
          startsAt: newCampaign.startsAt.toISOString(),
          endsAt: newCampaign.endsAt.toISOString(),
          discountPercent: newCampaign.discountPercent,
          isActive: newCampaign.isActive,
        },
      },
    })

    return newCampaign
  })

  await emitEvent({
    type: EVENTS.CAMPAIGN_STARTED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: { campaignId: campaign.id, name: campaign.name, isActive: campaign.isActive },
  })

  await revalidateCouponCaches()
  return campaign
}

// ─── Update Campaign ──────────────────────────────────────────────────────────────

export async function updateCampaign(campaignId: string, data: {
  name: string
  label?: string | null
  description?: string | null
  type: CampaignType
  status?: CampaignStatus
  startsAt: string
  endsAt: string
  discountPercent?: number
  flatDiscount?: number | null
  bannerText?: string | null
  bannerImageUrl?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  applicableTierIds: string[]
  applicableProductIds?: string[]
  targetSegment?: string | null
  allowedGeos?: string[]
  isActive: boolean
}) {
  const admin = await requireAdmin()

  const campaign = await db.$transaction(async (tx) => {
    const before = await tx.campaign.findUniqueOrThrow({ where: { id: campaignId } })

    const updated = await tx.campaign.update({
      where: { id: campaignId },
      data: {
        name: data.name,
        label: data.label,
        description: data.description,
        type: data.type,
        status: data.status ?? (data.isActive ? "ACTIVE" : "PAUSED"),
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        discountPercent: data.discountPercent ?? 0,
        flatDiscount: data.flatDiscount,
        bannerText: data.bannerText,
        bannerImageUrl: data.bannerImageUrl,
        ctaText: data.ctaText,
        ctaUrl: data.ctaUrl,
        applicableTierIds: data.applicableTierIds,
        applicableProductIds: data.applicableProductIds ?? [],
        targetSegment: data.targetSegment,
        allowedGeos: data.allowedGeos ?? [],
        isActive: data.isActive,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "CAMPAIGN_UPDATED",
        entity: "Campaign",
        entityId: campaignId,
        beforeJson: { name: before.name, isActive: before.isActive, status: before.status },
        afterJson: { name: updated.name, isActive: updated.isActive, status: updated.status },
      },
    })

    return updated
  })

  await revalidateCouponCaches()
  return campaign
}

// ─── Toggle Campaign ──────────────────────────────────────────────────────────────

export async function toggleCampaign(campaignId: string, isActive: boolean, reason?: string) {
  const admin = await requireAdmin()

  const campaign = await db.$transaction(async (tx) => {
    const before = await tx.campaign.findUniqueOrThrow({ where: { id: campaignId } })

    const updated = await tx.campaign.update({
      where: { id: campaignId },
      data: {
        isActive,
        status: isActive ? "ACTIVE" : "PAUSED",
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: isActive ? "CAMPAIGN_ACTIVATED" : "CAMPAIGN_PAUSED",
        entity: "Campaign",
        entityId: campaignId,
        beforeJson: { isActive: before.isActive, name: before.name },
        afterJson: { isActive, reason: reason ?? "Manual toggle" },
      },
    })

    return updated
  })

  await emitEvent({
    type: isActive ? EVENTS.CAMPAIGN_STARTED : EVENTS.CAMPAIGN_STOPPED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: { campaignId, name: campaign.name, isActive, reason },
  })

  await revalidateCouponCaches()
  return campaign
}

// ─── Duplicate Campaign ───────────────────────────────────────────────────────────

export async function duplicateCampaign(campaignId: string) {
  const admin = await requireAdmin()

  const source = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { coupons: true },
  })

  const dup = await db.$transaction(async (tx) => {
    const newCampaign = await tx.campaign.create({
      data: {
        name: `${source.name} (Copy)`,
        label: source.label,
        description: source.description,
        type: source.type,
        status: "DRAFT",
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        discountPercent: source.discountPercent,
        flatDiscount: source.flatDiscount,
        bannerText: source.bannerText,
        bannerImageUrl: source.bannerImageUrl,
        ctaText: source.ctaText,
        ctaUrl: source.ctaUrl,
        applicableTierIds: source.applicableTierIds,
        applicableProductIds: source.applicableProductIds,
        targetSegment: source.targetSegment,
        allowedGeos: source.allowedGeos,
        isAbTest: source.isAbTest,
        abVariantA: source.abVariantA ?? undefined,
        abVariantB: source.abVariantB ?? undefined,
        isActive: false,
        createdBy: admin.userId,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "CAMPAIGN_DUPLICATED",
        entity: "Campaign",
        entityId: newCampaign.id,
        afterJson: { sourceId: campaignId, newId: newCampaign.id },
      },
    })

    return newCampaign
  })

  await revalidateCouponCaches()
  return dup
}

// ─── Delete Campaign ──────────────────────────────────────────────────────────────

export async function deleteCampaign(campaignId: string) {
  const admin = await requireAdmin()

  await db.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUniqueOrThrow({ where: { id: campaignId } })
    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "CAMPAIGN_DELETED",
        entity: "Campaign",
        entityId: campaignId,
        beforeJson: { name: campaign.name, type: campaign.type },
      },
    })
    // Unlink coupons before deleting
    await tx.coupon.updateMany({ where: { campaignId }, data: { campaignId: null } })
    await tx.campaign.delete({ where: { id: campaignId } })
  })

  await revalidateCouponCaches()
  return { success: true }
}

// ─── Get Coupon Analytics ─────────────────────────────────────────────────────────

export async function getCouponAnalytics(couponId: string) {
  const admin = await requireAdmin()

  const [coupon, usages] = await Promise.all([
    db.coupon.findUniqueOrThrow({ where: { id: couponId }, include: { usages: { include: { user: { select: { name: true, email: true } } } } } }),
    db.couponUsage.findMany({
      where: { couponId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { usedAt: "desc" },
      take: 100,
    }),
  ])

  const totalDiscount = usages.reduce((sum, u) => sum + Number(u.discount), 0)

  return {
    coupon: { ...coupon, discountValue: Number(coupon.discountValue) },
    usages: usages.map(u => ({ ...u, discount: Number(u.discount), usedAt: u.usedAt.toISOString() })),
    stats: {
      totalUses: usages.length,
      totalDiscount,
      uniqueUsers: new Set(usages.map(u => u.userId)).size,
    },
  }
}
