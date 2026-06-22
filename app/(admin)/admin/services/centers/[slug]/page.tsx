import Link from "next/link"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { ArrowLeft, BarChart3, Layers3, MessageSquare, Package2, Shapes } from "lucide-react"
import { db } from "@/lib/db"
import { SERVICE_CENTER_CONFIG } from "../center-config"
import { requireServiceCenterAccess } from "@/lib/admin-auth"

function toIso(val: Date | string | null | undefined): string | null {
  if (val == null) return null
  if (val instanceof Date) return val.toISOString()
  const d = new Date(val as string)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

export default async function ServiceCenterDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requireServiceCenterAccess(slug)
  const center = SERVICE_CENTER_CONFIG[slug]
  if (!center) notFound()

  const category = await db.serviceCategory.findUnique({
    where: { slug },
    include: {
      _count: { select: { services: true } },
      services: {
        include: {
          _count: { select: { leads: true, requests: true, plans: true, addOns: true, orders: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  })

  if (!category) notFound()

  const services = category.services
  const totalLeads = services.reduce((sum, item) => sum + item._count.leads, 0)
  const totalRequests = services.reduce((sum, item) => sum + item._count.requests, 0)
  const totalPlans = services.reduce((sum, item) => sum + item._count.plans, 0)
  const totalAddOns = services.reduce((sum, item) => sum + item._count.addOns, 0)
  const totalOrders = services.reduce((sum, item) => sum + item._count.orders, 0)
  const activeServices = services.filter((item) => item.isActive).length

  const recentServices = services.slice(0, 6).map((item) => ({
    ...item,
    createdAt: toIso(item.createdAt) ?? "",
    updatedAt: toIso(item.updatedAt) ?? "",
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <Link href="/admin/services/centers" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-indigo-200">
            <ArrowLeft className="h-4 w-4" />
            Back to centers
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-indigo-400">{center.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">{center.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">{center.description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/services?category=${slug}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <Layers3 className="h-4 w-4" />
            Open services
          </Link>
          <Link href="/admin/services/orders" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <Package2 className="h-4 w-4" />
            Orders
          </Link>
          <Link href="/admin/services/emails" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <MessageSquare className="h-4 w-4" />
            Email Center
          </Link>
          <Link href="/admin/services/leads" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <MessageSquare className="h-4 w-4" />
            Leads
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Services" value={category._count.services} icon={<Package2 className="h-4 w-4" />} />
        <StatCard label="Active" value={activeServices} icon={<Shapes className="h-4 w-4" />} />
        <StatCard label="Leads" value={totalLeads} icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label="Requests" value={totalRequests} icon={<BarChart3 className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Center focus" eyebrow="Managed verticals">
          <div className="flex flex-wrap gap-2">
            {center.focus.map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                {item}
              </span>
            ))}
          </div>
        </Panel>
        <Panel title="Capabilities" eyebrow="Content surface">
          <div className="flex flex-wrap gap-2">
            {center.capabilities.map((item) => (
              <span key={item} className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
                {item}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Plans" value={totalPlans} />
        <Metric title="Add-ons" value={totalAddOns} />
        <Metric title="Orders" value={totalOrders} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Latest update</p>
        <p className="mt-3 text-sm text-zinc-300">
          {recentServices[0]?.updatedAt ? new Date(recentServices[0].updatedAt).toLocaleString() : "No recent updates"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent services" eyebrow="Managed items">
          <div className="space-y-3">
            {recentServices.map((item) => (
              <Link
                key={item.id}
                href={`/admin/services/${item.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/5"
              >
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-xs text-zinc-500">{item.slug}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${item.isActive ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-500/10 text-zinc-300"}`}>
                  {item.isActive ? "Active" : "Draft"}
                </span>
              </Link>
            ))}
            {recentServices.length === 0 && <p className="text-sm text-zinc-500">No services configured in this center yet.</p>}
          </div>
        </Panel>
        <Panel title="Operational summary" eyebrow="Control plane">
          <ul className="space-y-3 text-sm text-zinc-300">
            <li>Dedicated admin workspace for {center.title.toLowerCase()}.</li>
            <li>Manage service pages, plans, add-ons, leads, and requests from the same center.</li>
            <li>Service content is isolated by category slug and does not affect marketplace data.</li>
            <li>Everything here is editable through the existing service CMS and admin review flows.</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-bold text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-black text-white">{formatCount(value)}</p>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{title}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  )
}
