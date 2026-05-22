import Link from "next/link"
import { getEnterpriseCommandCenter } from "@/lib/services/enterprise-commerce-service"

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function Card({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export default async function EcosystemControlPage() {
  const data = await getEnterpriseCommandCenter()
  const { totals } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-violet-500">NexusAI master control</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Enterprise Marketplace Ecosystem</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            One operating layer for vendors, products, carts, orders, services, AI deployments, entitlements, billing, and live commerce events.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Manage Products
          </Link>
          <Link href="/admin/orders" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Review Orders
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Gross marketplace volume" value={money(totals.grossRevenue)} hint={`${money(totals.platformFees)} platform fees captured`} />
        <Card label="Vendor net revenue" value={money(totals.vendorNetRevenue)} hint={`${totals.vendors} vendors, ${totals.pendingVendors} pending verification`} />
        <Card label="Published products" value={totals.publishedProducts} hint="AI agents, SaaS tools, APIs, templates, services" />
        <Card label="Orders" value={totals.orders} hint={`${totals.activeCarts} active carts in commerce flow`} />
        <Card label="Open services" value={totals.openServices} hint="Consulting, deployment, onboarding, support retainers" />
        <Card label="Live AI deployments" value={totals.liveAgents} hint="Runtime status tracked from the agent deployment layer" />
        <Card label="AI requests" value={totals.aiRequests} hint={`${totals.aiTokens.toLocaleString()} tokens consumed`} />
        <Card label="AI cost" value={money(totals.aiCostUsd)} hint="Aggregated from usage logs for billing and alerts" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border bg-card shadow-sm xl:col-span-2">
          <div className="border-b p-5">
            <h2 className="text-base font-bold">Live Order Spine</h2>
            <p className="mt-1 text-xs text-muted-foreground">Checkout now creates orders, payments, invoices, entitlements, subscriptions, notifications, and metrics.</p>
          </div>
          <div className="divide-y">
            {data.recentOrders.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No orders yet.</div>
            ) : data.recentOrders.map((order) => (
              <div key={order.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{order.user.name} - {order.user.email}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {order.items.map((item) => item.name).join(", ")}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-sm font-bold">{money(Number(order.grandTotal))}</p>
                  <p className="text-xs uppercase text-muted-foreground">{order.status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-base font-bold">Top Vendor Economy</h2>
            <p className="mt-1 text-xs text-muted-foreground">Ranked by revenue and seller health.</p>
          </div>
          <div className="divide-y">
            {data.topVendors.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No vendors onboarded yet.</div>
            ) : data.topVendors.map((vendor) => (
              <div key={vendor.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{vendor.displayName}</p>
                    <p className="text-xs text-muted-foreground">{vendor.type.replaceAll("_", " ")} - {vendor.status}</p>
                  </div>
                  <span className="rounded-full border px-2 py-1 text-xs font-semibold">{vendor._count.products} products</span>
                </div>
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>{money(Number(vendor.totalRevenue))} revenue</span>
                  <span>{vendor.totalSales} sales</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-base font-bold">Realtime Ecosystem Feed</h2>
          <p className="mt-1 text-xs text-muted-foreground">Metrics are stored as database events so admin, vendor, and client dashboards can share one truth.</p>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {data.liveEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live metric events yet.</p>
          ) : data.liveEvents.map((event) => (
            <div key={event.id} className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-500">{event.type.replaceAll("_", " ")}</p>
              <p className="mt-2 text-sm font-semibold">{event.product?.name ?? event.user?.name ?? "Platform event"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{event.occurredAt.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
