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

  let tier: Awaited<ReturnType<typeof db.productTier.findUnique>> | null = null
  try {
    tier = tierId
      ? await db.productTier.findUnique({
          where: { id: tierId },
          include: { product: { include: { vendor: true } } },
        })
      : null
  } catch (err: any) {
    const isConnErr =
      err?.code === "P1001" ||
      err?.constructor?.name === "PrismaClientInitializationError" ||
      err?.message?.includes("Can't reach database server")
    if (isConnErr) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white grid place-items-center px-4">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-6">⚡</div>
            <h1 className="text-2xl font-black mb-3">Checkout is starting up…</h1>
            <p className="text-zinc-400 mb-6">
              The server is warming up. Please refresh in a moment to continue your purchase.
            </p>
            <a
              href={params?.tierId ? `/checkout?tierId=${params.tierId}${params?.product ? `&product=${params.product}` : ""}` : "/checkout"}
              className="inline-block bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:scale-105 transition-all"
            >
              Refresh checkout
            </a>
          </div>
        </div>
      )
    }
    throw err
  }

  // tier is typed as the full Prisma result including nested product+vendor
  const tierWithProduct = tier as any

  const initialBuyNow = tierWithProduct
    ? {
        tierId: tierWithProduct.id,
        productId: tierWithProduct.productId,
        productSlug: tierWithProduct.product.slug,
        productName: tierWithProduct.product.name,
        productType: tierWithProduct.product.type,
        tierName: tierWithProduct.name,
        interval: tierWithProduct.interval,
        currency: tierWithProduct.currency,
        price: Number(tierWithProduct.discountPrice ?? tierWithProduct.price),
        taxRate: normalizeTaxRate(tierWithProduct.taxRate),
        vendorName: tierWithProduct.product.vendor?.displayName ?? "NexusAI",
        aiQuota: tierWithProduct.aiQuota,
        thumbnailUrl: tierWithProduct.product.thumbnailUrl,
      }
    : null

  return <CheckoutClient initialBuyNow={initialBuyNow} productSlug={productSlug} />
}
