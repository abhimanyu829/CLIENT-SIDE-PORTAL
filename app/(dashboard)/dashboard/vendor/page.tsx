import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { VendorOnboardingClient } from "./VendorOnboardingClient"

function currency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
}

export default async function VendorStudioPage() {
  const session = await auth()
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
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Vendor economy</p>
          <h1 className="mt-3 text-3xl font-black text-foreground font-sans">Launch your AI product business on NexusAI</h1>
          <p className="mt-3 text-muted-foreground">
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
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Vendor Studio</p>
          <h1 className="mt-2 text-3xl font-black text-foreground font-sans">{vendor.displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{vendor.type.replaceAll("_", " ")} - {vendor.status}</p>
        </div>
        <Link href="/admin/products" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
          Manage Listings
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">Revenue</p><p className="mt-2 text-3xl font-black text-foreground">{currency(Number(vendor.totalRevenue))}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">Sales</p><p className="mt-2 text-3xl font-black text-foreground">{vendor.totalSales}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">Published Products</p><p className="mt-2 text-3xl font-black text-foreground">{activeProducts.length}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">Seller Score</p><p className="mt-2 text-3xl font-black text-foreground">{vendor.sellerScore.toFixed(0)}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/20 p-5">
            <h2 className="font-bold text-foreground">Products and Subscriptions</h2>
          </div>
          <div className="divide-y divide-border">
            {vendor.products.map((product) => (
              <div key={product.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.type} - {product.status}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground">{product.tiers[0] ? currency(Number(product.tiers[0].price)) : "Custom"}</p>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>{product._count.subscriptions} subscriptions</span>
                  <span>{product._count.reviews} reviews</span>
                  <span>{product.viewCount} views</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/20 p-5">
            <h2 className="font-bold text-foreground">Service Delivery and Payouts</h2>
          </div>
          <div className="divide-y divide-border">
            {vendor.serviceEngagements.map((engagement) => (
              <div key={engagement.id} className="p-5">
                <p className="font-semibold text-foreground">{engagement.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{engagement.status} - {currency(Number(engagement.budget))}</p>
              </div>
            ))}
            {vendor.serviceEngagements.length === 0 && <p className="p-5 text-sm text-muted-foreground">No active service engagements yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
