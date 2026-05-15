import { Suspense } from "react"
import Link from "next/link"
import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Marketplace — NexusAI",
  description: "Browse premium AI agents, SaaS products, and automation tools. Find, try, and deploy in seconds.",
}

async function getProducts(type?: string) {
  return await db.product.findMany({
    where: {
      status: ProductStatus.PUBLISHED,
      ...(type && type !== "ALL" ? { type: type as any } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { tiers: { take: 1, orderBy: { price: "asc" } } },
  })
}

const FILTERS = ["ALL","AI_AGENT","SERVICE","AUTOMATION","ANALYTICS","API"]
const FILTER_LABELS: Record<string,string> = {ALL:"All Products",AI_AGENT:"AI Agents",SERVICE:"SaaS",AUTOMATION:"Automation",ANALYTICS:"Analytics",API:"APIs"}

async function ProductGrid({ type }: { type?: string }) {
  const products = await getProducts(type)

  if (products.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-white mb-2">No products found</h3>
        <p className="text-zinc-500">Be the first to publish in this category.</p>
      </div>
    )
  }

  return (
    <>
      {products.map((p) => (
        <Link key={p.id} href={`/marketplace/${p.slug}`}>
          <article className="group glass rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10">
            <div className="aspect-video relative overflow-hidden bg-zinc-900">
              {p.thumbnailUrl ? (
                <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center">
                  <span className="text-5xl">{p.type === "AI_AGENT" ? "🤖" : "⚡"}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="bg-black/70 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full text-purple-300 border border-white/10">
                  {FILTER_LABELS[p.type] ?? p.type}
                </span>
              </div>
              {p.tiers[0] && (
                <div className="absolute bottom-3 right-3">
                  <span className="bg-emerald-500/90 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full text-white">
                    ${Number(p.tiers[0].price)/100}/{p.tiers[0].interval === "MONTHLY" ? "mo" : "yr"}
                  </span>
                </div>
              )}
            </div>

            <div className="p-5">
              <h3 className="font-bold text-white text-lg mb-1 group-hover:text-purple-300 transition-colors">{p.name}</h3>
              <p className="text-zinc-500 text-sm mb-4 line-clamp-2">{p.tagline}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s=>(
                    <span key={s} className={`text-sm ${p.averageRating >= s ? "text-amber-400" : "text-zinc-700"}`}>★</span>
                  ))}
                  <span className="text-xs text-zinc-600 ml-1">({p.reviewCount})</span>
                </div>
                <span className="text-xs text-zinc-600">{p.viewCount.toLocaleString()} views</span>
              </div>
            </div>
          </article>
        </Link>
      ))}
    </>
  )
}

function ProductGridSkeleton() {
  return (
    <>
      {[1,2,3,4,5,6].map(i=>(
        <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
          <div className="aspect-video bg-zinc-800" />
          <div className="p-5 space-y-3">
            <div className="h-5 bg-zinc-800 rounded w-3/4" />
            <div className="h-3 bg-zinc-800 rounded" />
            <div className="h-3 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </>
  )
}

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .text-gradient { background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .filter-active { background: rgba(139,92,246,0.2); border-color: rgba(139,92,246,0.5); color: #c4b5fd; }
      `}</style>

      {/* Hero */}
      <section className="relative py-24 px-4 text-center overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-zinc-400 mb-6">
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
            {0} products live · Updated daily
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
            AI <span className="text-gradient">Marketplace</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-8">
            Discover, deploy, and monetize premium AI agents and SaaS tools.
          </p>
          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <input
              type="search"
              placeholder="Search AI agents, SaaS tools, APIs..."
              className="w-full glass rounded-xl px-5 py-4 text-white placeholder-zinc-600 outline-none focus:border-purple-500/50 pr-12 text-sm"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">⌘K</span>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {FILTERS.map(f=>(
            <Link key={f} href={f==="ALL" ? "/marketplace" : `/marketplace?type=${f}`}>
              <button className={`glass rounded-lg px-4 py-2 text-xs font-medium whitespace-nowrap transition-all hover:border-purple-500/40 ${f==="ALL" ? "filter-active" : "text-zinc-400"}`}>
                {FILTER_LABELS[f]}
              </button>
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <select className="glass rounded-lg px-3 py-2 text-xs text-zinc-400 bg-transparent outline-none cursor-pointer">
              <option value="newest">Newest First</option>
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="price_asc">Price: Low → High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Featured Sections */}
      <div className="max-w-7xl mx-auto px-4 py-12">

        {/* Trending Banner */}
        <div className="glass rounded-2xl p-6 mb-10 flex items-center gap-6 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/10 pointer-events-none" />
          <div className="relative z-10 flex-1">
            <p className="text-purple-400 text-xs font-mono tracking-widest uppercase mb-1">🔥 Trending Now</p>
            <h2 className="text-xl font-bold text-white">Top AI Agents this week</h2>
            <p className="text-zinc-500 text-sm">Deployed by 2,400+ developers in the last 7 days</p>
          </div>
          <div className="relative z-10 flex gap-3">
            {["Sales AI","Code Helper","Doc AI"].map(t=>(
              <span key={t} className="glass text-xs px-3 py-1.5 rounded-full text-zinc-300">{t}</span>
            ))}
          </div>
        </div>

        {/* Category labels */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">All Products</h2>
          <span className="text-zinc-600 text-sm">Sorted by latest</span>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductGrid />
          </Suspense>
        </div>

        {/* Editor Picks */}
        <div className="mt-20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xl">🏆</span>
            <h2 className="text-2xl font-bold text-white">Editor&apos;s Picks</h2>
            <span className="glass text-xs px-2.5 py-1 rounded-full text-zinc-400">Curated weekly</span>
          </div>
          <div className="glass rounded-2xl p-8 text-center text-zinc-600">
            <p>Editor picks will appear here once products are featured by admins.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
