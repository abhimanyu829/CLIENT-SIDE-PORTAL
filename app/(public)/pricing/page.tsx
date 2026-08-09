import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"
import { unstable_cache } from "next/cache"
import type { Metadata } from "next"
import PricingClient from "./PricingClient"

export const revalidate = 30

export const metadata: Metadata = {
  title: "Pricing — NexusAI | Transparent, Flexible Pricing for Every Team",
  description: "Choose the right plan for your team. Flexible monthly and yearly pricing for all NexusAI products. Start free, scale when you're ready.",
}

const getPricingData = unstable_cache(async () => {
  return db.product.findMany({
    where: { status: ProductStatus.AVAILABLE },
    include: { tiers: { where: { isActive: true }, orderBy: { price: "asc" } } },
    orderBy: [{ isFeatured: "desc" }, { viewCount: "desc" }],
    take: 10,
  })
}, ["pricing-data"], { revalidate: 30, tags: ["pricing", "products"] })

export default async function PricingPage() {
  const products = await getPricingData()

  // Convert Prisma Decimal objects to numbers for safe Client Component prop serialization
  const serializedProducts = products.map(product => ({
    ...product,
    tiers: product.tiers.map(tier => ({
      ...tier,
      price: Number(tier.price),
      discountPrice: tier.discountPrice ? Number(tier.discountPrice) : null,
      flashSalePrice: tier.flashSalePrice ? Number(tier.flashSalePrice) : null,
      flashSaleEndsAt: tier.flashSaleEndsAt ? tier.flashSaleEndsAt.toISOString() : null,
    })),
  }))

  return <PricingClient products={serializedProducts} />
}
