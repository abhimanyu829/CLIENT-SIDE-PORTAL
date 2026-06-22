import Link from "next/link"
import { db } from "@/lib/db"
import { Briefcase, ArrowRight, Settings2 } from "lucide-react"
import { SERVICE_CENTER_CONFIG, SERVICE_CENTER_ORDER } from "./center-config"

export default async function ServiceCentersPage() {
  const [categories, services] = await Promise.all([
    db.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { services: true } } },
    }),
    db.servicePage.count({ where: { isActive: true } }),
  ])

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-indigo-400">Service command center</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Dedicated Service Management Centers</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Independent vertical control planes for SaaS, AI agents, automation, websites, APIs, enterprise programs, cloud services, and consulting.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/services/categories" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <Settings2 className="h-4 w-4" />
            Manage Categories
          </Link>
          <Link href="/admin/services/requests" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <ArrowRight className="h-4 w-4" />
            Review Requests
          </Link>
          <Link href="/admin/services/orders" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <ArrowRight className="h-4 w-4" />
            Service Orders
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const copy = SERVICE_CENTER_CONFIG[category.slug] ?? {
            title: category.name,
            description: category.description ?? "Vertical-specific service management.",
            slug: category.slug,
            eyebrow: category.name,
            focus: [],
            capabilities: [],
            actionLabel: "Open center",
          }
          return (
            <Link
              key={category.id}
              href={`/admin/services/centers/${category.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-indigo-500/40 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                  <Briefcase className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-zinc-400">
                  {category._count.services} services
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white group-hover:text-indigo-300">{copy.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{copy.description}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-indigo-400 group-hover:translate-x-1 transition-transform">
                Open center <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          )
        })}

        {categories.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/5 py-24 text-center text-zinc-500">
            No service categories configured yet.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Platform status</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Active service pages" value={services} />
          <Stat label="Configured centers" value={categories.length} />
          <Stat label="Verticals ready" value={Math.min(categories.length, SERVICE_CENTER_ORDER.length)} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}
