import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import ProductCard from "@/components/marketplace/ProductCard"
import Link from "next/link"

interface Props { params: Promise<{ category: string }> }

const CATEGORY_META: Record<string, { title: string; desc: string; icon: string; color: string }> = {
  "ai-agents": { title: "AI Agents", desc: "Deploy intelligent AI agents for any workflow", icon: "🤖", color: "from-purple-600/20 to-blue-600/20" },
  "saas": { title: "SaaS Tools", desc: "Cloud software solutions for businesses", icon: "⚡", color: "from-blue-600/20 to-cyan-600/20" },
  "api-tools": { title: "API & Developer Tools", desc: "APIs, SDKs, and integrations for developers", icon: "🔗", color: "from-orange-600/20 to-amber-600/20" },
  "automation": { title: "Automation Tools", desc: "Workflow automation and no-code solutions", icon: "⚙️", color: "from-emerald-600/20 to-teal-600/20" },
  "enterprise": { title: "Enterprise Solutions", desc: "Scale-ready tools for large organizations", icon: "🏢", color: "from-zinc-600/20 to-slate-600/20" },
  "marketing": { title: "Marketing Tools", desc: "Grow your audience and drive conversions", icon: "📣", color: "from-pink-600/20 to-rose-600/20" },
  "analytics": { title: "Analytics & Data", desc: "Insights, dashboards, and business intelligence", icon: "📊", color: "from-indigo-600/20 to-violet-600/20" },
  "digital": { title: "Digital Products", desc: "Templates, assets, and digital downloads", icon: "💾", color: "from-teal-600/20 to-green-600/20" },
}

// Map URL slug to DB values
function categoryToDbFilter(category: string) {
  const map: Record<string, any> = {
    "ai-agents": { type: "AI_AGENT" },
    "saas": { type: "SAAS" },
    "api-tools": { type: "API" },
    "automation": { type: "AUTOMATION" },
    "enterprise": { type: "ENTERPRISE" },
    "digital": { type: "DIGITAL" },
    "marketing": { category: "Marketing" },
    "analytics": { category: "Analytics" },
  }
  return map[category] || { category: category.replace(/-/g, " ") }
}

export async function generateStaticParams() {
  return Object.keys(CATEGORY_META).map(c => ({ category: c }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const meta = CATEGORY_META[category]
  if (!meta) return { title: "Category — NexusAI" }
  return {
    title: `${meta.title} — NexusAI Marketplace`,
    description: meta.desc,
  }
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  const meta = CATEGORY_META[category]
  if (!meta) notFound()

  const filter = categoryToDbFilter(category)
  const products = await db.product.findMany({
    where: { status: ProductStatus.PUBLISHED, ...filter },
    include: { tiers: { orderBy: { price: "asc" }, take: 1 }, _count: { select: { subscriptions: true } } },
    orderBy: [{ isFeatured: "desc" }, { isTrending: "desc" }, { viewCount: "desc" }],
    take: 48,
  })

  function toCardProps(p: any) {
    const tier = p.tiers?.[0]
    return {
      id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, type: p.type, category: p.category,
      thumbnailUrl: p.thumbnailUrl, isFeatured: p.isFeatured, isTrending: p.isTrending, isBestSeller: p.isBestSeller,
      badgeText: p.badgeText, averageRating: p.averageRating, reviewCount: p.reviewCount, viewCount: p.viewCount,
      tags: p.tags, demoUrl: p.demoUrl, activeUsers: p._count?.subscriptions ?? 0,
      startingPrice: tier ? Number(tier.price) : undefined, discountPrice: tier?.discountPrice ? Number(tier.discountPrice) : undefined,
      flashSalePrice: tier?.flashSalePrice ? Number(tier.flashSalePrice) : undefined,
      flashSaleEndsAt: tier?.flashSaleEndsAt ? tier.flashSaleEndsAt.toISOString() : undefined,
      currency: tier?.currency, interval: tier?.interval,
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}
        .text-gradient{background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
      `}</style>

      {/* Hero */}
      <section className={`py-20 px-4 border-b border-white/5 bg-gradient-to-br ${meta.color} relative overflow-hidden`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-zinc-600 mb-6">
            <Link href="/marketplace" className="hover:text-zinc-400 transition-colors">Marketplace</Link>
            <span>/</span>
            <span className="text-zinc-400">{meta.title}</span>
          </div>
          <div className="text-6xl mb-5">{meta.icon}</div>
          <h1 className="text-5xl font-black mb-4">{meta.title}</h1>
          <p className="text-xl text-zinc-400 max-w-2xl mb-4">{meta.desc}</p>
          <p className="text-zinc-600 text-sm">{products.length} products available</p>
        </div>
      </section>

      {/* Products grid */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map(p => <ProductCard key={p.id} {...toCardProps(p)} variant="grid" />)}
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">{meta.icon}</div>
              <h3 className="text-xl font-bold mb-2">No {meta.title.toLowerCase()} yet</h3>
              <p className="text-zinc-600 mb-6">Be the first to list a product in this category.</p>
              <Link href="/dashboard/products/new">
                <button className="glass px-6 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-all">
                  Submit a product →
                </button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Other categories */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-black mb-8">Browse other categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(CATEGORY_META).filter(([k]) => k !== category).slice(0, 8).map(([k, m]) => (
              <Link key={k} href={`/categories/${k}`}>
                <div className="glass rounded-xl p-4 hover:border-purple-500/40 transition-all cursor-pointer">
                  <span className="text-2xl block mb-2">{m.icon}</span>
                  <p className="text-sm font-bold">{m.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
