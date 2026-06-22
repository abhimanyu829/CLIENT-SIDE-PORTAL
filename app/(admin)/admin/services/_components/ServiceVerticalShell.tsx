import Link from "next/link"
import { SERVICE_CENTER_CONFIG, type ServiceCenterConfig } from "../centers/center-config"

type ServiceRow = {
  id: string
  title: string
  slug: string
  isActive: boolean
  category?: { name: string; slug: string } | null
  _count: {
    leads: number
    requests: number
    orders: number
    plans: number
    addOns: number
    mediaAssets: number
    documents: number
  }
  orders: Array<{ grandTotal: unknown; status: string }>
}

type Props = {
  config: ServiceCenterConfig
  categorySlug: string
  categoryLabel?: string
  services: ServiceRow[]
  relatedCategorySlugs?: string[]
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ServiceVerticalShell({ config, categorySlug, categoryLabel, services, relatedCategorySlugs = [] }: Props) {
  const totalServices = services.length
  const activeServices = services.filter((service) => service.isActive).length
  const leads = services.reduce((sum, service) => sum + service._count.leads, 0)
  const requests = services.reduce((sum, service) => sum + service._count.requests, 0)
  const plans = services.reduce((sum, service) => sum + service._count.plans, 0)
  const addOns = services.reduce((sum, service) => sum + service._count.addOns, 0)
  const mediaAssets = services.reduce((sum, service) => sum + service._count.mediaAssets, 0)
  const documents = services.reduce((sum, service) => sum + service._count.documents, 0)
  const revenue = services
    .flatMap((service) => service.orders)
    .filter((order) => order.status === "ACTIVE" || order.status === "PAID")
    .reduce((sum, order) => sum + Number(order.grandTotal ?? 0), 0)

  const categoryFilter = `?category=${categorySlug}`

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-300">{config.eyebrow}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-black tracking-tight text-white">{config.title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{config.description}</p>
            {categoryLabel && <p className="mt-2 text-xs text-zinc-500">Primary category: {categoryLabel}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/admin/services/new${categoryFilter}`} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Create Service
            </Link>
            <Link href={`/admin/services${categoryFilter}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              Service List
            </Link>
            <Link href={`/admin/services/leads${categoryFilter}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              Leads
            </Link>
            <Link href={`/admin/services/analytics${categoryFilter}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              Analytics
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Services" value={`${activeServices}/${totalServices}`} />
        <Metric label="Revenue" value={money(revenue)} />
        <Metric label="Leads / Requests" value={`${leads} / ${requests}`} />
        <Metric label="Plans / Add-ons" value={`${plans} / ${addOns}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <LinkCard href={`/admin/services/new${categoryFilter}`} label="Create Service" description="Open the service composer with this vertical preselected." />
        <LinkCard href={`/admin/services${categoryFilter}`} label="Pricing" description="Open service pages and edit pricing, plans, and status." />
        <LinkCard href={`/admin/services/requests${categoryFilter}`} label="Refund Requests" description="Review cancellation and refund requests for this vertical." />
        <LinkCard href="/admin/services/emails" label="Email Center" description="Send service-targeted campaign and transactional email." />
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Service List</h2>
            <p className="mt-1 text-sm text-zinc-500">Edit existing services from the dedicated {config.title} queue.</p>
          </div>
          <Link href={`/admin/services${categoryFilter}`} className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
            Open list
          </Link>
        </div>
        <div className="mt-4 grid gap-4">
          {services.map((service) => (
            <div key={service.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">{service.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${service.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"}`}>
                      {service.isActive ? "Active" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{service.category?.name ?? "Unassigned"} · {service.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span>Leads {service._count.leads}</span>
                  <span>Requests {service._count.requests}</span>
                  <span>Plans {service._count.plans}</span>
                  <span>Add-ons {service._count.addOns}</span>
                </div>
                <Link href={`/admin/services/${service.id}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10">
                  Edit Service
                </Link>
              </div>
            </div>
          ))}
          {services.length === 0 && <p className="text-sm text-zinc-500">No services found for this vertical yet.</p>}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <LinkCard href={`/admin/services/orders${categoryFilter}`} label="Orders" description="Review service orders, payment state, and fulfillment progress." />
        <LinkCard href={`/admin/services/analytics${categoryFilter}`} label="Analytics" description="View revenue, lead, and request metrics for this vertical." />
        <LinkCard href="/admin/services/categories" label="Categories" description="Manage the broader service taxonomy and reassign services." />
      </div>

      {relatedCategorySlugs.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-black text-white">Related Verticals</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {relatedCategorySlugs.map((slug) => {
              const center = SERVICE_CENTER_CONFIG[slug]
              if (!center) return null
              return (
                <Link key={slug} href={`/admin/services/centers/${slug}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">
                  {center.title}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Media assets" value={mediaAssets} />
        <Metric label="Documents" value={documents} />
        <Metric label="Active services" value={activeServices} />
        <Metric label="Service operations" value={`${leads + requests + plans + addOns}`} />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function LinkCard({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06]">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </Link>
  )
}
