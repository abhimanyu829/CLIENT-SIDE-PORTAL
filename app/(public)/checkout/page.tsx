import { db } from "@/lib/db"
import CheckoutClient from "./CheckoutClient"

function normalizeTaxRate(taxRate: number) {
  if (taxRate <= 0) return 18
  return taxRate > 1 ? taxRate : taxRate * 100
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const tierId = typeof params?.tierId === "string" ? params.tierId : undefined
  const productSlug = typeof params?.product === "string" ? params.product : undefined

  const tier = tierId
    ? await db.productTier.findUnique({
        where: { id: tierId },
        include: { product: { include: { vendor: true } } },
      })
    : null

  const initialBuyNow = tier
    ? {
        tierId: tier.id,
        productId: tier.productId,
        productSlug: tier.product.slug,
        productName: tier.product.name,
        productType: tier.product.type,
        tierName: tier.name,
        interval: tier.interval,
        currency: tier.currency,
        price: Number(tier.discountPrice ?? tier.price),
        taxRate: normalizeTaxRate(tier.taxRate),
        vendorName: tier.product.vendor?.displayName ?? "NexusAI",
        aiQuota: tier.aiQuota,
        thumbnailUrl: tier.product.thumbnailUrl,
      }
    : null

  return <CheckoutClient initialBuyNow={initialBuyNow} productSlug={productSlug} />
}
