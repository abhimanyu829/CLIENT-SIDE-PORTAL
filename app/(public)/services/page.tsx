import { db } from "@/lib/db"
import Link from "next/link"
import { ArrowRight, Briefcase, Layers3, Sparkles } from "lucide-react"
import { ServiceDiscoveryShelf } from "@/components/services/ServiceDiscoveryShelf"

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
    <div className="min-h-screen bg-background text-foreground selection:bg-amber-500/30">
      {/* Hero section with beautiful glowing gradient background (no black background) */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-amber-500/10 via-purple-500/5 via-30% to-background">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/15 via-purple-500/5 to-transparent blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-16 sm:pb-20">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2.5 mb-6">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300 shadow-xs">
                Enterprise Services
              </span>
              <span className="rounded-full border border-border bg-muted/60 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {totalCategories} categories
              </span>
              <span className="rounded-full border border-border bg-muted/60 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {totalServices} active offerings
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-amber-700 via-purple-700 to-indigo-700 dark:from-amber-400 dark:via-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
              Professional Services
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl">
              Explore NexusAI&apos;s separate service vertical for AI delivery, SaaS builds, automation, cloud, APIs, enterprise systems, consulting, and digital transformation.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
        <ServiceDiscoveryShelf />

        {/* Category Pills */}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/services"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 border ${!category ? "border-amber-600 bg-amber-600 text-white shadow-md shadow-amber-600/20" : "border-border bg-card text-foreground hover:border-amber-500/40 hover:bg-muted"}`}
            >
              All Services
            </Link>
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`/services?category=${item.slug}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 border ${category === item.slug ? "border-amber-600 bg-amber-600 text-white shadow-md shadow-amber-600/20" : "border-border bg-card text-foreground hover:border-amber-500/40 hover:bg-muted"}`}
              >
                {item.name}
                <span className={`ml-2 text-xs ${category === item.slug ? "text-amber-100" : "text-muted-foreground"}`}>({item._count.services})</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Category Grid */}
        {categories.length > 0 && (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`/services?category=${item.slug}`}
                className="group relative overflow-hidden rounded-3xl border border-white/80 dark:border-zinc-800/80 bg-gradient-to-br from-slate-50/90 via-indigo-50/40 to-purple-50/60 dark:from-zinc-900/90 dark:via-purple-950/20 dark:to-indigo-950/30 p-6 shadow-md shadow-slate-200/50 dark:shadow-none transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1"
              >
                {/* Organic Translucent Liquid Gradient Orbs */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-purple-300/40 via-pink-200/30 to-blue-200/20 dark:from-purple-900/30 dark:to-blue-950/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
                  <div className="absolute bottom-0 right-0 w-44 h-44 bg-gradient-to-tl from-indigo-300/30 via-purple-200/25 to-sky-200/20 dark:from-indigo-900/25 dark:to-purple-950/10 rounded-full blur-xl transform translate-x-8 translate-y-8" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 group-hover:bg-amber-500/20 transition-colors backdrop-blur-xs">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">{item._count.services} services</span>
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{item.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                    {item.description || "Category-managed services tailored for enterprise delivery."}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* Service Catalog Grid */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <Layers3 className="h-6 w-6 text-amber-700 dark:text-amber-400" />
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {category ? `Filtered Services` : "Service Catalog"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {services.map((service) => (
              <Link
                href={`/services/${service.slug}`}
                key={service.id}
                className="group relative overflow-hidden rounded-3xl border border-white/80 dark:border-zinc-800/80 bg-gradient-to-br from-slate-50/90 via-indigo-50/40 to-purple-50/60 dark:from-zinc-900/90 dark:via-purple-950/20 dark:to-indigo-950/30 p-8 shadow-md shadow-slate-200/50 dark:shadow-none transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/15 flex flex-col justify-between"
              >
                {/* Organic Translucent Liquid Gradient Orbs */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-300/40 via-pink-200/35 to-blue-200/20 dark:from-purple-900/30 dark:via-pink-900/20 dark:to-blue-950/10 rounded-full blur-2xl transform translate-x-12 -translate-y-12" />
                  <div className="absolute bottom-0 right-0 w-56 h-56 bg-gradient-to-tl from-indigo-300/35 via-purple-200/30 to-sky-200/25 dark:from-indigo-900/30 dark:via-purple-950/20 dark:to-sky-950/10 rounded-full blur-2xl transform translate-x-10 translate-y-10" />
                  <div className="absolute top-1/2 left-0 w-44 h-44 bg-gradient-to-tr from-sky-200/30 via-indigo-100/20 to-transparent dark:from-sky-950/20 dark:via-indigo-950/10 rounded-full blur-xl transform -translate-x-14 -translate-y-10" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 group-hover:bg-amber-500/20 transition-colors backdrop-blur-xs">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    {service.category?.name && (
                      <span className="rounded-full border border-border bg-background/80 backdrop-blur-xs px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground shadow-2xs">
                        {service.category.name}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-6 text-2xl font-bold tracking-tight text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {service.heroSubheading}
                  </p>
                </div>

                <div className="relative z-10">
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    {service._count.features > 0 && (
                      <span className="rounded-full bg-background/70 backdrop-blur-xs border border-border/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-2xs">
                        {service._count.features} features
                      </span>
                    )}
                    {service._count.technologies > 0 && (
                      <span className="rounded-full bg-background/70 backdrop-blur-xs border border-border/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-2xs">
                        {service._count.technologies} tech items
                      </span>
                    )}
                    <span className="rounded-full bg-background/70 backdrop-blur-xs border border-border/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-2xs">
                      {service._count.leads} leads
                    </span>
                  </div>

                  <div className="mt-8 flex items-center text-amber-700 dark:text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                    Learn More <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}

            {services.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-border bg-card py-20 text-center text-muted-foreground">
                No services found in this category yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
