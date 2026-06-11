import { getServerSession } from "next-auth"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { VendorOnboardingClient } from "./VendorOnboardingClient"

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export default async function VendorStudioPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  const vendor = userId ? await db.vendorProfile.findFirst({
    where: { userId },
    include: {
      products: { include: { _count: { select: { subscriptions: true, reviews: true } }, tiers: { take: 1, orderBy: { price: "asc" } } }, orderBy: { updatedAt: "desc" } },
      payouts: { orderBy: { createdAt: "desc" }, take: 5 },
      serviceEngagements: { orderBy: { updatedAt: "desc" }, take: 5 },
    },
  }) : null

  if (!vendor) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-fuchsia-400">Vendor economy</p>
          <h1 className="mt-3 text-3xl font-black">Launch your AI product business on NexusAI</h1>
          <p className="mt-3 text-zinc-500">
            Vendor Studio turns creators, AI developers, agencies, API providers, and automation builders into marketplace sellers with products, pricing, payouts, analytics, support, and service delivery.
          </p>
          <VendorOnboardingClient />
        </div>
      </div>
    )
  }

  const activeProducts = vendor.products.filter((product) => product.status === "AVAILABLE")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-fuchsia-400">Vendor Studio</p>
          <h1 className="mt-2 text-3xl font-black">{vendor.displayName}</h1>
          <p className="mt-2 text-sm text-zinc-500">{vendor.type.replaceAll("_", " ")} - {vendor.status}</p>
        </div>
        <Link href="/admin/products" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black">
          Manage Listings
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs text-zinc-500">Revenue</p><p className="mt-2 text-3xl font-black">{currency(Number(vendor.totalRevenue))}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs text-zinc-500">Sales</p><p className="mt-2 text-3xl font-black">{vendor.totalSales}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs text-zinc-500">Published Products</p><p className="mt-2 text-3xl font-black">{activeProducts.length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs text-zinc-500">Seller Score</p><p className="mt-2 text-3xl font-black">{vendor.sellerScore.toFixed(0)}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 p-5">
            <h2 className="font-bold">Products and Subscriptions</h2>
          </div>
          <div className="divide-y divide-white/10">
            {vendor.products.map((product) => (
              <div key={product.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-zinc-500">{product.type} - {product.status}</p>
                  </div>
                  <p className="text-sm font-bold">{product.tiers[0] ? currency(Number(product.tiers[0].price)) : "Custom"}</p>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-zinc-500">
                  <span>{product._count.subscriptions} subscriptions</span>
                  <span>{product._count.reviews} reviews</span>
                  <span>{product.viewCount} views</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 p-5">
            <h2 className="font-bold">Service Delivery and Payouts</h2>
          </div>
          <div className="divide-y divide-white/10">
            {vendor.serviceEngagements.map((engagement) => (
              <div key={engagement.id} className="p-5">
                <p className="font-semibold">{engagement.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{engagement.status} - {currency(Number(engagement.budget))}</p>
              </div>
            ))}
            {vendor.serviceEngagements.length === 0 && <p className="p-5 text-sm text-zinc-500">No active service engagements yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
