import { db } from "@/lib/db"
import CouponsClient from "./CouponsClient"
import { unstable_cache } from "next/cache"

const getCouponsData = unstable_cache(
  async () => {
    return Promise.all([
      db.coupon.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { usages: true } } }
      }),
      db.campaign.findMany({
        orderBy: { startsAt: "desc" },
        include: { _count: { select: { coupons: true } } }
      }),
      db.productTier.findMany({
        where: { isActive: true },
        include: { product: true },
        orderBy: { name: "asc" },
      }),
    ])
  },
  ["admin-coupons"],
  { tags: ["coupons", "campaigns"], revalidate: 30 }
)

export default async function CouponsPage() {
  const [coupons, campaigns, tiers] = await getCouponsData()

  const serializedCoupons = coupons.map(c => ({
    ...c,
    discountValue: Number(c.discountValue),
    maxDiscountCap: c.maxDiscountCap ? Number(c.maxDiscountCap) : null,
    minCartValue: c.minCartValue ? Number(c.minCartValue) : null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    startsAt: c.startsAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  const serializedCampaigns = campaigns.map(c => ({
    ...c,
    flatDiscount: c.flatDiscount ? Number(c.flatDiscount) : null,
    revenue: Number(c.revenue),
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  const serializedTiers = tiers.map(t => ({
    id: t.id,
    name: t.name,
    productName: t.product.name,
  }))

  return (
    <CouponsClient
      coupons={serializedCoupons as any}
      campaigns={serializedCampaigns as any}
      productTiers={serializedTiers}
    />
  )
}
