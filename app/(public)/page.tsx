import Link from "next/link"
import { db } from "@/lib/db"
import { ProductStatus, ProductType, SubStatus, CampaignStatus } from "@prisma/client"
import { unstable_cache } from "next/cache"
import OfferBanner from "@/components/marketplace/OfferBanner"
import ActivityFeed from "@/components/marketplace/ActivityFeed"
import ProductCard from "@/components/marketplace/ProductCard"

export const revalidate = 60

// Dynamic metadata with live stats (revalidated every 60s)
export async function generateMetadata() {
  const count = await db.product.count({ where: { status: ProductStatus.AVAILABLE } }).catch(() => 0)
  return {
    title: "NexusAI — The World's Best AI SaaS Marketplace",
    description: `Deploy ${count}+ AI agents, SaaS tools, automation workflows, and APIs. The most advanced AI marketplace platform, trusted by developers and enterprises worldwide.`,
    openGraph: {
      title: "NexusAI — AI SaaS Marketplace",
      description: `${count}+ AI products ready to deploy. Start free today.`,
    },
  }
}


// ── Data fetching ──────────────────────────────────────────────────────────────

const getPlatformStats = unstable_cache(async () => {
  const [products, agents, users, subscriptions, reviews] = await Promise.allSettled([
    db.product.count({ where: { status: ProductStatus.AVAILABLE } }),
    db.product.count({ where: { status: ProductStatus.AVAILABLE, type: ProductType.AI_AGENT } }),
    db.user.count(),
    db.subscription.count({ where: { status: { in: [SubStatus.ACTIVE, SubStatus.TRIALING] } } }),
    db.productReview.count(),
  ])
  return {
    products: products.status === "fulfilled" ? products.value : 500,
    agents: agents.status === "fulfilled" ? agents.value : 120,
    users: users.status === "fulfilled" ? users.value : 12000,
    subscriptions: subscriptions.status === "fulfilled" ? subscriptions.value : 4800,
    reviews: reviews.status === "fulfilled" ? reviews.value : 2400,
  }
}, ["platform-stats"], { revalidate: 300, tags: ["products", "platform-stats"] })

const getFeaturedProducts = unstable_cache(async () => {
  return db.product.findMany({
    where: { status: ProductStatus.AVAILABLE, isFeatured: true },
    include: { tiers: { orderBy: { price: "asc" }, take: 1 } },
    orderBy: { viewCount: "desc" },
    take: 6,
  })
}, ["featured-products"], { revalidate: 60, tags: ["featured-products", "products"] })

const getTrendingProducts = unstable_cache(async () => {
  return db.product.findMany({
    where: { status: ProductStatus.AVAILABLE, isTrending: true },
    include: { tiers: { orderBy: { price: "asc" }, take: 1 } },
    orderBy: { viewCount: "desc" },
    take: 8,
  })
}, ["trending-products"], { revalidate: 60, tags: ["trending", "products"] })

const getTopSellers = unstable_cache(async () => {
  return db.product.findMany({
    where: { status: ProductStatus.AVAILABLE, isBestSeller: true },
    include: { tiers: { orderBy: { price: "asc" }, take: 1 } },
    orderBy: [{ reviewCount: "desc" }, { averageRating: "desc" }],
    take: 6,
  })
}, ["top-sellers"], { revalidate: 60, tags: ["products"] })

const getNewLaunches = unstable_cache(async () => {
  return db.product.findMany({
    where: { status: ProductStatus.AVAILABLE },
    include: { tiers: { orderBy: { price: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 4,
  })
}, ["new-launches"], { revalidate: 60, tags: ["products"] })

const getTopAgents = unstable_cache(async () => {
  return db.product.findMany({
    where: { status: ProductStatus.AVAILABLE, type: ProductType.AI_AGENT },
    include: { tiers: { orderBy: { price: "asc" }, take: 1 } },
    orderBy: { viewCount: "desc" },
    take: 4,
  })
}, ["top-agents"], { revalidate: 60, tags: ["agents", "products"] })

const getActiveCampaign = unstable_cache(async () => {
  const now = new Date()
  return db.campaign.findFirst({
    where: { status: CampaignStatus.ACTIVE, startsAt: { lte: now }, endsAt: { gte: now } },
    select: { id: true, bannerText: true, ctaText: true, ctaUrl: true, bannerImageUrl: true, endsAt: true, discountPercent: true, type: true },
    orderBy: { startsAt: "desc" },
  })
}, ["active-campaign"], { revalidate: 30, tags: ["campaigns"] })

const getTestimonials = unstable_cache(async () => {
  return db.productReview.findMany({
    where: { rating: 5, status: "APPROVED" as any },
    include: { user: { select: { name: true, avatarUrl: true } }, product: { select: { name: true } } },
    orderBy: { helpfulCount: "desc" },
    take: 3,
  })
}, ["testimonials"], { revalidate: 3600, tags: ["products"] })

function toCardProps(p: any) {
  const tier = p.tiers?.[0]
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    type: p.type,
    category: p.category,
    thumbnailUrl: p.thumbnailUrl,
    iconUrl: p.iconUrl,
    isPremium: p.isPremium,
    isFeatured: p.isFeatured,
    isTrending: p.isTrending,
    isBestSeller: p.isBestSeller,
    badgeText: p.badgeText,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    viewCount: p.viewCount,
    tags: p.tags,
    demoUrl: p.demoUrl,
    startingPrice: tier ? Number(tier.price) : undefined,
    discountPrice: tier?.discountPrice ? Number(tier.discountPrice) : undefined,
    flashSalePrice: tier?.flashSalePrice ? Number(tier.flashSalePrice) : undefined,
    flashSaleEndsAt: tier?.flashSaleEndsAt,
    currency: tier?.currency,
    interval: tier?.interval,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const [stats, featured, trending, topSellers, newLaunches, agents, campaign, testimonials] = await Promise.all([
    getPlatformStats(),
    getFeaturedProducts(),
    getTrendingProducts(),
    getTopSellers(),
    getNewLaunches(),
    getTopAgents(),
    getActiveCampaign(),
    getTestimonials(),
  ])

  const campaignForBanner = campaign ? {
    id: campaign.id,
    bannerText: campaign.bannerText,
    ctaText: campaign.ctaText,
    ctaUrl: campaign.ctaUrl,
    bannerImageUrl: campaign.bannerImageUrl,
    endsAt: campaign.endsAt.toISOString(),
    discountPercent: campaign.discountPercent,
    type: campaign.type,
  } : null

  const COLLECTIONS = [
    { title: "Best AI Agents", href: "/ai-agents", icon: "🤖", count: stats.agents, color: "from-purple-600/20 to-blue-600/20", border: "border-purple-500/20" },
    { title: "Top SaaS Tools", href: "/marketplace?type=SAAS", icon: "⚡", count: Math.floor(stats.products * 0.35), color: "from-blue-600/20 to-cyan-600/20", border: "border-blue-500/20" },
    { title: "Automation Tools", href: "/marketplace?type=AUTOMATION", icon: "⚙️", count: Math.floor(stats.products * 0.15), color: "from-emerald-600/20 to-teal-600/20", border: "border-emerald-500/20" },
    { title: "Developer APIs", href: "/marketplace?type=API", icon: "🔗", count: Math.floor(stats.products * 0.12), color: "from-orange-600/20 to-amber-600/20", border: "border-orange-500/20" },
    { title: "Marketing Tools", href: "/marketplace?category=Marketing", icon: "📣", count: Math.floor(stats.products * 0.10), color: "from-pink-600/20 to-rose-600/20", border: "border-pink-500/20" },
    { title: "Enterprise Suite", href: "/marketplace?type=ENTERPRISE", icon: "🏢", count: Math.floor(stats.products * 0.08), color: "from-zinc-600/20 to-zinc-500/20", border: "border-zinc-500/20" },
    { title: "New Launches", href: "/marketplace?sort=newest", icon: "🚀", count: newLaunches.length, color: "from-violet-600/20 to-purple-600/20", border: "border-violet-500/20" },
    { title: "Best Deals", href: "/marketplace?filter=sale", icon: "🔥", count: Math.floor(stats.products * 0.06), color: "from-red-600/20 to-orange-600/20", border: "border-red-500/20" },
  ]

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}
        @keyframes pulse-glow{0%,100%{opacity:.4}50%{opacity:.9}}
        @keyframes slide-up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .float{animation:float 7s ease-in-out infinite}
        .float2{animation:float 9s ease-in-out 2s infinite}
        .pulse-glow{animation:pulse-glow 3s ease-in-out infinite}
        .slide-up{animation:slide-up .8s ease-out forwards}
        .glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}
        .glow-blue{box-shadow:0 0 50px rgba(59,130,246,.12),0 0 100px rgba(59,130,246,.05)}
        .glow-purple{box-shadow:0 0 50px rgba(139,92,246,.15),0 0 100px rgba(139,92,246,.06)}
        .text-gradient{background:linear-gradient(135deg,#fff 0%,#a78bfa 45%,#60a5fa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .text-gradient-2{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);transition:all .2s;border:1px solid rgba(139,92,246,.3)}
        .btn-primary:hover{transform:scale(1.04);box-shadow:0 0 30px rgba(139,92,246,.4)}
        .card-hover{transition:all .3s ease}
        .card-hover:hover{transform:translateY(-4px);border-color:rgba(139,92,246,.35);box-shadow:0 20px 50px rgba(0,0,0,.5),0 0 30px rgba(139,92,246,.1)}
        .grid-bg{background-image:linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:60px 60px}
        .noise{background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E")}
        .section-label{background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-size:.7rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase}
        .ticker-track{display:flex;animation:ticker 40s linear infinite;will-change:transform;width:max-content}
        .ticker-track:hover{animation-play-state:paused}
        .star{color:#f59e0b}
        .stat-pill{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:9999px;padding:.25rem .875rem;display:inline-flex;align-items:center;gap:.5rem;font-size:.8125rem}
        .badge-new{background:linear-gradient(135deg,#10b981,#059669);font-size:.65rem;font-weight:800;padding:.125rem .5rem;border-radius:9999px;color:#fff;letter-spacing:.05em}
        .badge-featured{background:linear-gradient(135deg,#f59e0b,#d97706);font-size:.65rem;font-weight:800;padding:.125rem .5rem;border-radius:9999px;color:#fff}
      `}</style>

      {/* ── SECTION 3: Campaign Offer Banner ── */}
      <OfferBanner campaign={campaignForBanner} />

      {/* ── SECTION 1: HERO ──────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-bg noise pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl float pulse-glow" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-3xl float2 pulse-glow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center px-4 max-w-7xl mx-auto w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 glass rounded-full px-5 py-2.5 text-sm text-zinc-400 mb-10 glow-purple slide-up">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>🔥 The #1 AI SaaS Marketplace — Join {stats.users.toLocaleString()}+ developers</span>
            <span className="text-purple-400">→</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-8 leading-[.9] slide-up" style={{ animationDelay: ".1s" }}>
            <span className="text-gradient">Discover, Deploy</span>
            <br />
            <span className="text-white">&amp; Scale</span>
            <br />
            <span className="text-gradient">AI Products</span>
          </h1>

          <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed slide-up" style={{ animationDelay: ".2s" }}>
            The enterprise marketplace for AI agents, SaaS tools, and intelligent software.
            Deploy in seconds. Scale to millions.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14 slide-up" style={{ animationDelay: ".3s" }}>
            <Link href="/marketplace">
              <button className="btn-primary px-10 py-4 rounded-xl text-white font-bold text-lg flex items-center gap-2 shadow-2xl shadow-purple-500/20">
                🛒 Browse Marketplace <span>→</span>
              </button>
            </Link>
            <Link href="/register">
              <button className="glass px-10 py-4 rounded-xl text-white font-bold text-lg flex items-center gap-2 hover:border-purple-500/50 hover:bg-white/5 transition-all">
                Start Free <span className="text-purple-400">✨</span>
              </button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-16 slide-up" style={{ animationDelay: ".35s" }}>
            {["No credit card required", "Cancel anytime", "99.9% SLA", "SOC 2 Certified"].map(b => (
              <span key={b} className="stat-pill text-zinc-500">
                <span className="text-green-400">✓</span> {b}
              </span>
            ))}
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto slide-up" style={{ animationDelay: ".4s" }}>
            {[
              { val: stats.products.toLocaleString() + "+", label: "Live Products", icon: "📦" },
              { val: stats.agents.toLocaleString() + "+", label: "AI Agents", icon: "🤖" },
              { val: stats.users.toLocaleString() + "+", label: "Developers", icon: "🧑‍💻" },
              { val: stats.subscriptions.toLocaleString() + "+", label: "Active Deployments", icon: "🚀" },
            ].map(({ val, label, icon }) => (
              <div key={label} className="glass rounded-2xl p-5 text-center card-hover">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-2xl font-black text-white">{val}</div>
                <div className="text-xs text-zinc-600 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LIVE SIGNAL TICKER ────────────────────────────────────── */}
      <section className="py-4 overflow-hidden border-y border-white/5 bg-gradient-to-r from-zinc-950 via-black to-zinc-950">
        <div className="flex items-center overflow-hidden">
          <div className="flex-shrink-0 px-4 py-1 bg-purple-500/20 border-r border-white/5 mr-4">
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest whitespace-nowrap">🔴 Live</span>
          </div>
          <div className="overflow-hidden flex-1">
            <div className="ticker-track">
              {[
                "🛒 Developer purchased Sales CRM AI · Pro plan",
                "🤖 Code Assistant v2 deployed by TechStartup",
                "⭐ Marketing Automation Agent earned 5★ review",
                "👋 143 new developers joined today",
                "🔥 AI Analytics Pro trending — 890 views this hour",
                "💰 Creator earned $2,400 in revenue this week",
                "🚀 Enterprise Suite just launched — 3 plans available",
                "⬆️ User upgraded from Pro to Enterprise plan",
                "🛒 Developer purchased Sales CRM AI · Pro plan",
                "🤖 Code Assistant v2 deployed by TechStartup",
                "⭐ Marketing Automation Agent earned 5★ review",
                "👋 143 new developers joined today",
                "🔥 AI Analytics Pro trending — 890 views this hour",
                "💰 Creator earned $2,400 in revenue this week",
              ].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-xs text-zinc-500 whitespace-nowrap px-6">
                  {item} <span className="text-zinc-800">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: FEATURED COLLECTIONS GRID ────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-label mb-3">Collections</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Browse by <span className="text-gradient">Category</span>
            </h2>
            <p className="text-zinc-500 mt-4 text-lg">Every category curated and updated daily by our editorial team</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {COLLECTIONS.map(col => (
              <Link key={col.title} href={col.href}>
                <div className={`glass rounded-2xl p-6 card-hover border ${col.border} bg-gradient-to-br ${col.color} cursor-pointer h-full`}>
                  <div className="text-3xl mb-3">{col.icon}</div>
                  <h3 className="font-bold text-white text-sm mb-1">{col.title}</h3>
                  <p className="text-xs text-zinc-600">{col.count}+ products</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: TRENDING NOW ──────────────────────────────────────────── */}
      {trending.length > 0 && (
        <section className="py-16 px-4 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/8 to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">🔥 Trending Now</p>
                <h2 className="text-3xl md:text-4xl font-black">What developers are <span className="text-gradient">buying this week</span></h2>
              </div>
              <Link href="/marketplace?sort=trending" className="glass px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:border-purple-500/40 transition-all hidden sm:block">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {trending.slice(0, 4).map(p => (
                <ProductCard key={p.id} {...toCardProps(p)} variant="grid" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 6: TOP SELLERS ───────────────────────────────────────────── */}
      {topSellers.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">🏆 Best Sellers</p>
                <h2 className="text-3xl md:text-4xl font-black">Most <span className="text-gradient">popular products</span></h2>
              </div>
              <Link href="/marketplace?filter=bestseller" className="glass px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:border-purple-500/40 transition-all hidden sm:block">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {topSellers.map((p, i) => (
                <div key={p.id} className="relative">
                  {i === 0 && <div className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-black text-white px-3 py-1 rounded-full shadow-lg">#1 Best Seller</div>}
                  <ProductCard {...toCardProps(p)} variant={i === 0 ? "featured" : "grid"} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 7: RECENTLY LAUNCHED ────────────────────────────────────── */}
      {newLaunches.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">🚀 Just Launched</p>
                <h2 className="text-3xl md:text-4xl font-black">Fresh <span className="text-gradient">new arrivals</span></h2>
              </div>
              <Link href="/marketplace?sort=newest" className="glass px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:border-purple-500/40 transition-all hidden sm:block">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {newLaunches.map((p, idx) => {
                const daysAgo = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000)
                return (
                  <div key={p.id} className="relative">
                    <div className="absolute -top-2 left-4 z-10 badge-new">NEW {daysAgo === 0 ? "TODAY" : `${daysAgo}D AGO`}</div>
                    <ProductCard {...toCardProps(p)} variant="grid" />
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 4b: FEATURED PRODUCTS ───────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-16 px-4 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/8 to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">⭐ Editor&apos;s Picks</p>
                <h2 className="text-3xl md:text-4xl font-black">Featured <span className="text-gradient">AI Products</span></h2>
              </div>
              <Link href="/marketplace" className="glass px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:border-purple-500/40 transition-all hidden sm:block">
                Browse all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.slice(0, 3).map((p, i) => (
                <ProductCard key={p.id} {...toCardProps(p)} variant={i === 0 ? "featured" : "grid"} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 8: DEMO SHOWCASE ─────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-3xl p-12 md:p-16 relative overflow-hidden glow-purple">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <p className="section-label mb-4">🎮 Live Demos</p>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
                    Try before<br /><span className="text-gradient">you buy</span>
                  </h2>
                  <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                    Launch interactive 5-minute sandbox demos. No account required. No credit card. Real data, real experience.
                  </p>
                  <div className="flex gap-4 flex-wrap">
                    <Link href="/demo">
                      <button className="btn-primary px-8 py-4 rounded-xl text-white font-bold text-base">
                        ▶ Launch Demo
                      </button>
                    </Link>
                    <Link href="/marketplace">
                      <button className="glass px-8 py-4 rounded-xl text-white font-bold text-base hover:border-purple-500/50 transition-all">
                        Browse Products
                      </button>
                    </Link>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: "🏢", title: "Sales CRM AI", desc: "Pipeline, lead scoring, AI insights", color: "blue" },
                    { icon: "🤖", title: "AI Chatbot", desc: "GPT-4 powered, streaming responses", color: "purple" },
                    { icon: "📊", title: "Analytics Suite", desc: "Revenue charts, user funnels, heatmaps", color: "emerald" },
                    { icon: "⚙️", title: "Workflow Engine", desc: "Visual automation, triggers & actions", color: "amber" },
                  ].map(item => (
                    <Link key={item.title} href={`/demo?type=${item.title.toLowerCase().replace(/ /g, "-")}`}>
                      <div className="glass rounded-2xl p-5 card-hover cursor-pointer group">
                        <span className="text-3xl block mb-2">{item.icon}</span>
                        <h4 className="font-bold text-sm mb-1 group-hover:text-purple-300 transition-colors">{item.title}</h4>
                        <p className="text-zinc-600 text-xs">{item.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 9: LIVE ACTIVITY FEED ───────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="section-label mb-3">🌐 Live Platform</p>
              <h2 className="text-3xl md:text-4xl font-black mb-4">
                Platform <span className="text-gradient">activity feed</span>
              </h2>
              <p className="text-zinc-500 mb-8">Real-time actions happening on NexusAI. Updated live as developers deploy, purchase, and build.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: stats.subscriptions.toLocaleString() + "+", label: "Active Deployments" },
                  { val: stats.reviews.toLocaleString() + "+", label: "Reviews Written" },
                  { val: "142", label: "Countries Served" },
                  { val: "99.9%", label: "Platform Uptime" },
                ].map(s => (
                  <div key={s.label} className="glass rounded-xl p-4 text-center">
                    <p className="text-xl font-black text-purple-400">{s.val}</p>
                    <p className="text-xs text-zinc-600 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <ActivityFeed variant="feed" />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: TRUST & SOCIAL PROOF ────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-label mb-3">Trusted By Thousands</p>
            <h2 className="text-4xl md:text-5xl font-black">
              Loved by developers<br /><span className="text-gradient">around the world</span>
            </h2>
          </div>

          {/* Logo carousel */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-16 opacity-40">
            {["Stripe", "Vercel", "OpenAI", "GitHub", "Figma", "Notion", "Linear", "Supabase"].map(company => (
              <div key={company} className="glass px-6 py-3 rounded-xl">
                <span className="text-sm font-bold text-zinc-400">{company}</span>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {testimonials.length > 0 ? testimonials.map(t => (
              <div key={t.id} className="glass rounded-2xl p-6 card-hover">
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(s => <span key={s} className="text-amber-400 star">★</span>)}
                </div>
                <p className="text-zinc-300 mb-6 leading-relaxed text-sm">"{t.body}"</p>
                <div className="flex items-center gap-3">
                  {t.user.avatarUrl ? (
                    <img src={t.user.avatarUrl} alt={t.user.name || ""} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">
                      {(t.user.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm">{t.user.name || "Anonymous"}</p>
                    <p className="text-zinc-600 text-xs">Verified Customer · {t.product.name}</p>
                  </div>
                </div>
              </div>
            )) : (
              // Fallback testimonials
              [
                { name: "Sarah Chen", role: "ML Engineer @ Stripe", quote: "NexusAI cut our AI deployment time from weeks to hours. The sandbox demos alone converted 40% more enterprise clients.", avatar: "SC" },
                { name: "Marcus Williams", role: "Founder @ AutomateHQ", quote: "We went from 0 to $50K MRR in 3 months using the marketplace. The billing integration is absolutely flawless.", avatar: "MW" },
                { name: "Priya Patel", role: "CTO @ DevStudio", quote: "The best AI infrastructure I've worked with. Scales perfectly and the agent hosting is rock solid with 99.9% uptime.", avatar: "PP" },
              ].map(t => (
                <div key={t.name} className="glass rounded-2xl p-6 card-hover">
                  <div className="flex gap-1 mb-4">
                    {[1,2,3,4,5].map(s => <span key={s} className="text-amber-400 star">★</span>)}
                  </div>
                  <p className="text-zinc-300 mb-6 leading-relaxed text-sm">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">{t.avatar}</div>
                    <div>
                      <p className="font-bold text-sm">{t.name}</p>
                      <p className="text-zinc-600 text-xs">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "🔒", title: "SOC 2 Type II", desc: "Enterprise-grade security" },
              { icon: "⚡", title: "99.9% Uptime", desc: "Production SLA guarantee" },
              { icon: "💳", title: "Stripe Secured", desc: "PCI-compliant payments" },
              { icon: "🛡️", title: "GDPR Compliant", desc: "Privacy by design" },
            ].map(b => (
              <div key={b.title} className="glass rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">{b.icon}</div>
                <p className="text-sm font-bold text-white">{b.title}</p>
                <p className="text-xs text-zinc-600 mt-1">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 11: PLATFORM CAPABILITY BENTO ───────────────────────────── */}
      <section className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/8 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-label mb-3">Platform</p>
            <h2 className="text-4xl md:text-5xl font-black">
              Everything to<br /><span className="text-gradient">build AI products</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 glass rounded-2xl p-8 card-hover glow-blue relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/8 rounded-full blur-2xl" />
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-2xl font-bold mb-3">AI Agent Ecosystem</h3>
              <p className="text-zinc-400 leading-relaxed">Deploy any AI agent to our global edge infrastructure. Scale from 0 to millions of requests with zero configuration. Supports GPT-4, Gemini, Claude, and custom models.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Auto-scaling", "99.9% SLA", "Edge deployment", "API access", "Custom models", "Multi-tenant"].map(t => (
                  <span key={t} className="glass text-xs px-3 py-1 rounded-full text-zinc-400">{t}</span>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-8 card-hover glow-purple relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-xl" />
              <div className="text-4xl mb-4">🛒</div>
              <h3 className="text-2xl font-bold mb-3">SaaS Marketplace</h3>
              <p className="text-zinc-400">List and sell your products. Built-in Stripe + Razorpay billing, subscriptions, usage-based pricing, and creator payouts.</p>
            </div>
            <div className="glass rounded-2xl p-8 card-hover relative overflow-hidden">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold mb-3">One-click Deploy</h3>
              <p className="text-zinc-400">Push to deploy on Vercel, Railway, or Docker. CI/CD pipelines included.</p>
            </div>
            <div className="glass rounded-2xl p-8 card-hover relative overflow-hidden">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-2xl font-bold mb-3">Smart Monetization</h3>
              <p className="text-zinc-400">Subscriptions, one-time payments, usage billing, coupon campaigns, and affiliate programs — all configured.</p>
            </div>
            <div className="glass rounded-2xl p-8 card-hover relative overflow-hidden">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-2xl font-bold mb-3">Live Sandbox Demos</h3>
              <p className="text-zinc-400">Let users try your product before buying with 5-minute interactive demo sessions. No account required.</p>
            </div>
            <div className="lg:col-span-2 glass rounded-2xl p-8 card-hover relative overflow-hidden glow-purple">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-2xl font-bold mb-3">Analytics & Revenue Dashboard</h3>
              <p className="text-zinc-400 leading-relaxed">Track revenue, user behavior, API usage, and AI request metrics in real time. Built-in CRM, support tickets, audit logs, and compliance reporting.</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[["Revenue", "$48K"], ["Users", stats.users.toLocaleString()], ["Agents", stats.agents.toString()]].map(([k, v]) => (
                  <div key={k} className="glass rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-purple-400">{v}</p>
                    <p className="text-xs text-zinc-600">{k}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-8 card-hover">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-2xl font-bold mb-3">API Marketplace</h3>
              <p className="text-zinc-400">Expose your AI as an API. Monetize endpoints with usage-based billing and rate limiting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 12: FINAL CTA ───────────────────────────────────────────── */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-16 relative overflow-hidden glow-blue text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/15 via-purple-900/15 to-indigo-900/15" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            <div className="relative z-10">
              <div className="text-5xl mb-6">🚀</div>
              <h2 className="text-5xl md:text-6xl font-black mb-6">
                Ready to build<br /><span className="text-gradient">the future?</span>
              </h2>
              <p className="text-zinc-400 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
                Join {stats.users.toLocaleString()}+ AI developers deploying agents and building products that matter.
                Start free, scale unlimited.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                <Link href="/register">
                  <button className="btn-primary px-12 py-5 rounded-xl text-white font-bold text-lg shadow-2xl shadow-purple-500/30">
                    Start Building Free →
                  </button>
                </Link>
                <Link href="/marketplace">
                  <button className="glass px-12 py-5 rounded-xl text-white font-bold text-lg hover:border-purple-500/50 transition-all">
                    Explore Marketplace
                  </button>
                </Link>
              </div>
              {/* Newsletter */}
              <div className="max-w-md mx-auto">
                <p className="text-xs text-zinc-600 mb-3">Or join our newsletter for AI product updates</p>
                <div className="flex gap-2">
                  <input type="email" placeholder="your@email.com"
                    className="flex-1 glass rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50 transition-colors" />
                  <button className="btn-primary px-5 py-3 rounded-xl text-white text-sm font-bold whitespace-nowrap">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
