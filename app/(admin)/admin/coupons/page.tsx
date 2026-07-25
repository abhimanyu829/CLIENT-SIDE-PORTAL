import { db } from "@/lib/db"
import CouponsClient from "./CouponsClient"
import { unstable_cache } from "next/cache"

// Helper: safely convert a Date/string/null to ISO string
function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null
  return new Date(v).toISOString()
}

const getCouponsData = unstable_cache(
  async () => {
    const [coupons, campaigns, tiers] = await Promise.all([
      db.coupon.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { usages: true } } },
      }),
      db.campaign.findMany({
        orderBy: { startsAt: "desc" },
        include: { _count: { select: { coupons: true } } },
      }),
      db.productTier.findMany({
        where: { isActive: true },
        include: { product: true },
        orderBy: { name: "asc" },
      }),
    ])

    // Serialise HERE so the cache only ever stores plain JS objects
    const serializedCoupons = coupons.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name ?? null,
      description: c.description ?? null,
      type: c.type,
      discountValue: Number(c.discountValue),
      maxDiscountCap: c.maxDiscountCap != null ? Number(c.maxDiscountCap) : null,
      currency: c.currency ?? null,
      freeCredits: c.freeCredits ?? null,
      freeTokens: c.freeTokens ?? null,
      freeAddonId: c.freeAddonId ?? null,
      upgradeToTierId: c.upgradeToTierId ?? null,
      trialExtensionDays: c.trialExtensionDays ?? null,
      maxUses: c.maxUses ?? null,
      perUserLimit: c.perUserLimit,
      usedCount: c.usedCount,
      applicableTierIds: c.applicableTierIds,
      applicableProductIds: c.applicableProductIds,
      minCartValue: c.minCartValue != null ? Number(c.minCartValue) : null,
      startsAt: toISO(c.startsAt),
      expiresAt: toISO(c.expiresAt),
      allowedGeos: c.allowedGeos,
      blockedGeos: c.blockedGeos,
      allowedDevices: c.allowedDevices,
      targetSegment: c.targetSegment ?? null,
      requiresSubscription: c.requiresSubscription,
      newUsersOnly: c.newUsersOnly,
      campaignId: c.campaignId ?? null,
      affiliateCode: c.affiliateCode ?? null,
      affiliateCommission: c.affiliateCommission ?? null,
      isActive: c.isActive,
      createdBy: c.createdBy ?? null,
      createdAt: toISO(c.createdAt)!,
      updatedAt: toISO(c.updatedAt)!,
      _count: c._count,
    }))

    const serializedCampaigns = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      label: c.label ?? null,
      description: c.description ?? null,
      type: c.type,
      status: c.status,
      startsAt: toISO(c.startsAt)!,
      endsAt: toISO(c.endsAt)!,
      discountPercent: c.discountPercent,
      flatDiscount: c.flatDiscount != null ? Number(c.flatDiscount) : null,
      bannerText: c.bannerText ?? null,
      bannerImageUrl: c.bannerImageUrl ?? null,
      ctaText: c.ctaText ?? null,
      ctaUrl: c.ctaUrl ?? null,
      applicableTierIds: c.applicableTierIds,
      applicableProductIds: c.applicableProductIds,
      targetSegment: c.targetSegment ?? null,
      allowedGeos: c.allowedGeos,
      isAbTest: c.isAbTest,
      abVariantA: c.abVariantA ?? null,
      abVariantB: c.abVariantB ?? null,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      revenue: Number(c.revenue),
      isActive: c.isActive,
      createdBy: c.createdBy ?? null,
      createdAt: toISO(c.createdAt)!,
      updatedAt: toISO(c.updatedAt)!,
      _count: c._count,
    }))

    const serializedTiers = tiers.map(t => ({
      id: t.id,
      name: t.name,
      productName: t.product.name,
    }))

    return [serializedCoupons, serializedCampaigns, serializedTiers] as const
  },
  ["admin-coupons"],
  { tags: ["coupons", "campaigns"], revalidate: 30 }
)

export default async function CouponsPage() {
  const [coupons, campaigns, tiers] = await getCouponsData()

  return (
    <CouponsClient
      coupons={coupons as any}
      campaigns={campaigns as any}
      productTiers={tiers}
    />
  )
}
