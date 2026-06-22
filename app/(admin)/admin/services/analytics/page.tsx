import Link from "next/link"
import { db } from "@/lib/db"
import { requireServiceOperationsAccess } from "@/lib/admin-auth"

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export default async function AdminServiceAnalyticsPage({ searchParams }: { searchParams?: Promise<{ category?: string }> }) {
  await requireServiceOperationsAccess("analytics")
  const { category } = (await searchParams) ?? {}

  const [categories, orders, leads, requests, campaigns] = await Promise.all([
    db.serviceCategory.findMany({
      where: category ? { slug: category } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        services: {
          select: {
            id: true,
            title: true,
            slug: true,
            isActive: true,
            _count: { select: { leads: true, requests: true, orders: true, plans: true, addOns: true, mediaAssets: true, documents: true } },
            orders: { select: { grandTotal: true, status: true } },
            mediaAssets: { select: { id: true } },
            documents: { select: { id: true } },
          },
        },
      },
    }),
    db.serviceOrder.findMany({
      where: category
        ? {
            servicePage: {
              category: { slug: category },
            },
          }
        : undefined,
      select: { grandTotal: true, status: true, createdAt: true },
    }),
    db.serviceLead.count({
      where: category
        ? {
            servicePage: {
              category: { slug: category },
            },
          }
        : undefined,
    }),
    db.serviceRequest.count({
      where: category
        ? {
            servicePage: {
              category: { slug: category },
            },
          }
        : undefined,
    }),
    db.emailCampaign.findMany({
      select: { id: true, status: true, templateName: true, payload: true, sentCount: true, totalRecipients: true },
    }),
  ])

  const revenue = orders
    .filter((order) => order.status === "ACTIVE" || order.status === "PAID")
    .reduce((sum, order) => sum + Number(order.grandTotal), 0)
  const activeOrders = orders.filter((order) => order.status === "ACTIVE").length
  const pendingOrders = orders.filter((order) => order.status === "PENDING_PAYMENT").length
  const serviceCampaigns = campaigns.filter((campaign) => {
    const payload = (campaign.payload as { serviceScope?: string } | null) ?? null
    return campaign.templateName.toLowerCase().includes("service") || payload?.serviceScope === "SERVICES"
  })
  const serviceCampaignCount = serviceCampaigns.length
  const serviceCampaignRecipients = serviceCampaigns.reduce((sum, campaign) => sum + campaign.totalRecipients, 0)

  const rows = categories.map((categoryRow) => {
    const serviceCount = categoryRow.services.length
    const categoryOrders = categoryRow.services.flatMap((service) => service.orders)
    const categoryRevenue = categoryOrders
      .filter((order) => order.status === "ACTIVE" || order.status === "PAID")
      .reduce((sum, order) => sum + Number(order.grandTotal), 0)
    return {
      id: categoryRow.id,
      name: categoryRow.name,
      slug: categoryRow.slug,
      serviceCount,
      activeServices: categoryRow.services.filter((service) => service.isActive).length,
      leads: categoryRow.services.reduce((sum, service) => sum + service._count.leads, 0),
      requests: categoryRow.services.reduce((sum, service) => sum + service._count.requests, 0),
      orders: categoryOrders.length,
      revenue: categoryRevenue,
      plans: categoryRow.services.reduce((sum, service) => sum + service._count.plans, 0),
      addOns: categoryRow.services.reduce((sum, service) => sum + service._count.addOns, 0),
      mediaAssets: categoryRow.services.reduce((sum, service) => sum + service._count.mediaAssets, 0),
      documents: categoryRow.services.reduce((sum, service) => sum + service._count.documents, 0),
    }
  })

  const categoryFilter = category ? `?category=${category}` : ""

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Service Analytics</h1>
          <p className="mt-1 text-gray-400">Revenue, lead, request, and catalog metrics for the service platform{category ? ` filtered to ${category}` : ""}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/services/centers" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            Centers
          </Link>
          <Link href={`/admin/services/orders${categoryFilter}`} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            Orders
          </Link>
          <Link href={`/admin/services/leads${categoryFilter}`} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            Leads
          </Link>
          <Link href={`/admin/services/requests${categoryFilter}`} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            Requests
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Service revenue" value={formatMoney(revenue)} />
        <Metric label="Active orders" value={activeOrders} />
        <Metric label="Pending orders" value={pendingOrders} />
        <Metric label="Leads / requests" value={`${leads} / ${requests}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Service campaigns" value={serviceCampaignCount} />
        <Metric label="Campaign recipients" value={serviceCampaignRecipients} />
        <Metric
          label="Media / docs"
          value={categories.reduce((sum, categoryRow) => sum + categoryRow.services.reduce((inner, service) => inner + service._count.mediaAssets + service._count.documents, 0), 0)}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0f172a]">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-[#1e293b] text-xs font-semibold uppercase text-gray-300">
            <tr>
              <th className="px-5 py-4">Vertical</th>
              <th className="px-5 py-4">Services</th>
              <th className="px-5 py-4">Orders</th>
              <th className="px-5 py-4">Revenue</th>
              <th className="px-5 py-4">Leads</th>
              <th className="px-5 py-4">Requests</th>
              <th className="px-5 py-4">Plans</th>
              <th className="px-5 py-4">Add-ons</th>
              <th className="px-5 py-4">Media</th>
              <th className="px-5 py-4">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-800/50">
                <td className="px-5 py-4">
                  <Link href={`/admin/services/centers/${row.slug}`} className="font-medium text-white hover:text-indigo-300">
                    {row.name}
                  </Link>
                </td>
                <td className="px-5 py-4">
                  {row.activeServices}/{row.serviceCount}
                </td>
                <td className="px-5 py-4">{row.orders}</td>
                <td className="px-5 py-4 text-white">{formatMoney(row.revenue)}</td>
                <td className="px-5 py-4">{row.leads}</td>
                <td className="px-5 py-4">{row.requests}</td>
                <td className="px-5 py-4">{row.plans}</td>
                <td className="px-5 py-4">{row.addOns}</td>
                <td className="px-5 py-4">{row.mediaAssets}</td>
                <td className="px-5 py-4">{row.documents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  )
}
