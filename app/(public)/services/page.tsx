import { db } from "@/lib/db"
import Link from "next/link"
import { ArrowRight, Briefcase, Layers3, Sparkles } from "lucide-react"

type Props = {
  searchParams: Promise<{ category?: string }>
}

export const metadata = {
  title: "Professional Services | NexusAI",
  description: "Explore NexusAI's enterprise service platform: AI agents, SaaS, automation, web, API, cloud, and consulting offerings.",
}

export default async function ServicesDirectoryPage({ searchParams }: Props) {
  const { category } = await searchParams

  const [categories, services] = await Promise.all([
    db.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { services: true } } },
    }),
    db.servicePage.findMany({
      where: {
        isActive: true,
        ...(category ? { category: { slug: category } } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      include: { category: true, _count: { select: { leads: true, features: true, technologies: true } } },
    }),
  ])

  const totalServices = services.length
  const totalCategories = categories.length

  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_45%),linear-gradient(180deg,rgba(8,8,8,1),rgba(8,8,8,0.92))]" />
        <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-20">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">
                Enterprise Services
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-300">
                {totalCategories} categories
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-300">
                {totalServices} active offerings
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6 bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Professional Services
            </h1>
            <p className="text-xl text-gray-400 leading-relaxed max-w-3xl">
              Explore NexusAI's separate service vertical for AI delivery, SaaS builds, automation, cloud, APIs, enterprise systems, consulting, and digital transformation.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/services"
              className={`rounded-full px-4 py-2 text-sm font-medium border transition ${!category ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200" : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"}`}
            >
              All Services
            </Link>
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`/services?category=${item.slug}`}
                className={`rounded-full px-4 py-2 text-sm font-medium border transition ${category === item.slug ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200" : "border-white/10 bg-white/5 text-zinc-300 hover:text-white"}`}
              >
                {item.name}
                <span className="ml-2 text-xs text-zinc-500">({item._count.services})</span>
              </Link>
            ))}
          </div>
        </section>

        {categories.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`/services?category=${item.slug}`}
                className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-indigo-500/40 hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-zinc-500">{item._count.services} services</span>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white group-hover:text-indigo-300">{item.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400 line-clamp-3">
                  {item.description || "Category-managed services tailored for enterprise delivery."}
                </p>
              </Link>
            ))}
          </section>
        )}

        <section>
          <div className="flex items-center gap-3 mb-8">
            <Layers3 className="h-5 w-5 text-indigo-400" />
            <h2 className="text-3xl font-bold tracking-tight">
              {category ? `Filtered Services` : "Service Catalog"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {services.map((service) => (
              <Link
                href={`/services/${service.slug}`}
                key={service.id}
                className="group relative rounded-2xl border border-white/10 bg-[#0f172a] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.28)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  {service.category?.name && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                      {service.category.name}
                    </span>
                  )}
                </div>

                <h3 className="mt-6 text-2xl font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                  {service.title}
                </h3>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed line-clamp-4">
                  {service.heroSubheading}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {service._count.features > 0 && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">{service._count.features} features</span>
                  )}
                  {service._count.technologies > 0 && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">{service._count.technologies} tech items</span>
                  )}
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">{service._count.leads} leads</span>
                </div>

                <div className="mt-8 flex items-center text-indigo-400 font-medium group-hover:translate-x-1 transition-transform">
                  Learn More <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </Link>
            ))}

            {services.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/5 py-24 text-center text-zinc-500">
                No services found in this category yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
