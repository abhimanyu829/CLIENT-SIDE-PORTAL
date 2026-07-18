import Link from "next/link"
import { db } from "@/lib/db"
import { ProductStatus, ProductType, SubStatus, CampaignStatus } from "@prisma/client"
import { unstable_cache } from "next/cache"
import OfferBanner from "@/components/marketplace/OfferBanner"
import ActivityFeed from "@/components/marketplace/ActivityFeed"
import ProductCard from "@/components/marketplace/ProductCard"
import { CtaVideoBackground } from "@/components/effects/CtaVideoBackground"
import { MotionWrapper } from "@/components/ui/MotionWrapper"
import { AuroraHero } from "@/components/ui/aurora-hero"

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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}
        @keyframes slide-up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .float{animation:float 7s ease-in-out infinite}
        .slide-up{animation:slide-up .8s ease-out forwards}
        .glass{background:rgba(25, 28, 33, 0.4);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);color:#fff}
        .card-hover{transition:all .3s ease}
        .card-hover:hover{transform:translateY(-4px);border-color:rgba(234,88,12,0.4);box-shadow:0 20px 40px rgba(0,0,0,.05),0 0 20px rgba(234,88,12,.1)}
        .section-label{color:#ea580c;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
        .ticker-track{display:flex;animation:ticker 40s linear infinite;will-change:transform;width:max-content}
        .ticker-track:hover{animation-play-state:paused}
        .stat-pill{background:rgba(25, 28, 33, 0.05);border:1px solid rgba(25, 28, 33, 0.1);border-radius:9999px;padding:.25rem .875rem;display:inline-flex;align-items:center;gap:.5rem;font-size:.8125rem;color:inherit}
        .badge-new{background:#ea580c;font-size:.65rem;font-weight:800;padding:.125rem .5rem;border-radius:9999px;color:#fff;letter-spacing:.05em}
      `}</style>

      {/* ── SECTION 3: Campaign Offer Banner ── */}
      <OfferBanner campaign={campaignForBanner} />

      {/* ── SECTION 1: HERO ──────────────────────────────────────────────────── */}
      <section className="aurora-dashboard-bg relative min-h-[80vh] flex items-center justify-center overflow-hidden py-20">
        <AuroraHero
          aria-hidden="true"
          title=""
          className="pointer-events-none absolute inset-0 h-full min-h-full"
        />

        <div className="relative z-10 text-center px-4 max-w-7xl mx-auto w-full">
          {/* Badge */}
          <MotionWrapper delay={0}>
            <div className="inline-flex items-center gap-2.5 bg-card text-card-foreground border border-border rounded-full px-5 py-2.5 text-sm mb-10 shadow-sm">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="uppercase tracking-widest text-xs font-bold">🔥 The #1 AI SaaS Platform</span>
            </div>
          </MotionWrapper>

          <MotionWrapper delay={0.1}>
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 leading-[1.1] text-black">
              Converse Naturally.<br />
              Beyond Boundaries.<br />
              Infinite Scale.
            </h1>
          </MotionWrapper>

          <MotionWrapper delay={0.2}>
            <p className="text-xl md:text-2xl font-light text-black max-w-3xl mx-auto mb-12 leading-relaxed">
              Generate highly realistic human audio instantly, replicating vocal signatures. 
              Deploy AI agents, SaaS tools, and intelligent software to our global edge infrastructure.
            </p>
          </MotionWrapper>

          <MotionWrapper delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
              <Link href="/marketplace">
                <button className="bg-white text-[#0a0520] uppercase tracking-widest px-10 py-4 rounded-lg font-bold text-sm flex items-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-transform hover:scale-105 active:scale-95">
                  Browse Marketplace
                </button>
              </Link>
              <Link href="/register">
                <button className="bg-transparent text-black border border-black/20 uppercase tracking-widest px-10 py-4 rounded-lg font-bold text-sm flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 group">
                  Sign in <span className="text-black transition-transform group-hover:translate-x-2">→</span>
                </button>
              </Link>
            </div>
          </MotionWrapper>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-16 slide-up" style={{ animationDelay: ".35s" }}>
            {["No credit card required", "Cancel anytime", "99.9% SLA", "SOC 2 Certified"].map(b => (
              <span key={b} className="stat-pill">
                <span className="text-primary">✓</span> {b}
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
              <div key={label} className="bg-card text-card-foreground border border-border rounded-xl p-6 text-center shadow-sm card-hover">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-2xl font-medium">{val}</div>
                <div className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LIVE SIGNAL TICKER ────────────────────────────────────── */}
      <section className="py-4 overflow-hidden border-y border-border bg-card">
        <div className="flex items-center overflow-hidden">
          <div className="flex-shrink-0 px-4 py-1 border-r border-border mr-4">
            <span className="text-[12px] font-mono text-primary uppercase tracking-widest whitespace-nowrap font-bold">🔴 Live</span>
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
              ].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground whitespace-nowrap px-6">
                  {item} <span className="text-border">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: FEATURED COLLECTIONS GRID ────────────────────────────── */}
      <section className="py-[80px] px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-label mb-3">Collections</p>
            <h2 className="text-4xl md:text-[48px] font-medium tracking-tight text-foreground">
              Browse by Category
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">Every category curated and updated daily by our editorial team</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
            {COLLECTIONS.map(col => (
              <Link key={col.title} href={col.href}>
                <div className={`bg-card text-card-foreground rounded-xl p-[24px] card-hover border border-border shadow-sm cursor-pointer h-full`}>
                  <div className="text-3xl mb-3">{col.icon}</div>
                  <h3 className="font-medium text-lg mb-1">{col.title}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{col.count}+ products</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: TRENDING NOW ──────────────────────────────────────────── */}
      {trending.length > 0 && (
        <section className="py-[80px] px-4 relative bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">Trending Now</p>
                <h2 className="text-3xl md:text-[40px] font-medium text-foreground">What developers are buying</h2>
              </div>
              <Link href="/marketplace?sort=trending" className="bg-card text-card-foreground px-5 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-accent/10 transition-all hidden sm:block">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
              {trending.slice(0, 4).map(p => (
                <ProductCard key={p.id} {...toCardProps(p)} variant="grid" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 6: TOP SELLERS ───────────────────────────────────────────── */}
      {topSellers.length > 0 && (
        <section className="py-[80px] px-4 bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">Best Sellers</p>
                <h2 className="text-3xl md:text-[40px] font-medium text-foreground">Most popular products</h2>
              </div>
              <Link href="/marketplace?filter=bestseller" className="bg-card text-card-foreground px-5 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-accent/10 transition-all hidden sm:block">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
              {topSellers.map((p, i) => (
                <div key={p.id} className="relative">
                  {i === 0 && <div className="absolute -top-2 -right-2 z-10 bg-primary text-[10px] font-bold text-primary-foreground px-3 py-1 rounded-full shadow-md font-mono tracking-wide">#1 SELLER</div>}
                  <ProductCard {...toCardProps(p)} variant={i === 0 ? "featured" : "grid"} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 7: RECENTLY LAUNCHED ────────────────────────────────────── */}
      {newLaunches.length > 0 && (
        <section className="py-[80px] px-4 bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-label mb-2">Just Launched</p>
                <h2 className="text-3xl md:text-[40px] font-medium text-foreground">Fresh new arrivals</h2>
              </div>
              <Link href="/marketplace?sort=newest" className="bg-card text-card-foreground px-5 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-accent/10 transition-all hidden sm:block">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[16px]">
              {newLaunches.map((p, idx) => {
                const daysAgo = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000)
                return (
                  <div key={p.id} className="relative">
                    <div className="absolute -top-2 left-4 z-10 badge-new font-mono">NEW {daysAgo === 0 ? "TODAY" : `${daysAgo}D AGO`}</div>
                    <ProductCard {...toCardProps(p)} variant="grid" />
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 8: DEMO SHOWCASE ─────────────────────────────────────────── */}
      <section className="py-[80px] px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="bg-card text-card-foreground rounded-2xl p-12 md:p-16 border border-border shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="section-label mb-4">Live Demos</p>
                <h2 className="text-4xl md:text-[48px] font-medium tracking-tight mb-6 text-foreground">
                  Try before<br />you buy
                </h2>
                <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                  Launch interactive 5-minute sandbox demos. No account required. No credit card. Real data, real experience.
                </p>
                <div className="flex gap-4 flex-wrap">
                  <Link href="/demo">
                    <button className="bg-primary text-primary-foreground px-8 py-4 rounded-lg font-medium text-base hover:bg-primary/90 transition-all">
                      ▶ Launch Demo
                    </button>
                  </Link>
                  <Link href="/marketplace">
                    <button className="bg-background text-foreground border border-border px-8 py-4 rounded-lg font-medium text-base hover:bg-accent/10 transition-all">
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
                    <div className="bg-background border border-border rounded-xl p-[24px] card-hover cursor-pointer group shadow-sm">
                      <span className="text-3xl block mb-3">{item.icon}</span>
                      <h4 className="font-medium text-[16px] mb-1 group-hover:text-primary transition-colors">{item.title}</h4>
                      <p className="text-muted-foreground text-[12px] font-mono leading-[1.2]">{item.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: TRUST & SOCIAL PROOF ────────────────────────────────── */}
      <section className="py-[80px] px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-label mb-3">Enterprise-Ready</p>
            <h2 className="text-4xl md:text-[48px] font-medium text-foreground tracking-tight">
              Loved by developers
            </h2>
          </div>

          {/* Logo carousel */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-16 opacity-60">
            {["Stripe", "Vercel", "OpenAI", "GitHub", "Figma", "Notion", "Linear", "Supabase"].map(company => (
              <div key={company} className="bg-card border border-border px-6 py-3 rounded-lg shadow-sm">
                <span className="text-sm font-bold text-card-foreground">{company}</span>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px] mb-16">
            {testimonials.length > 0 ? testimonials.map(t => (
              <div key={t.id} className="bg-card text-card-foreground rounded-xl p-[24px] border border-border card-hover shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(s => <span key={s} className="text-primary text-[12px]">★</span>)}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed text-[16px]">"{t.body}"</p>
                <div className="flex items-center gap-3">
                  {t.user.avatarUrl ? (
                    <img src={t.user.avatarUrl} alt={t.user.name || ""} className="w-10 h-10 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                      {(t.user.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-[16px]">{t.user.name || "Anonymous"}</p>
                    <p className="text-muted-foreground text-[12px] font-mono">Verified Customer · {t.product.name}</p>
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
                <div key={t.name} className="bg-card text-card-foreground rounded-xl p-[24px] border border-border card-hover shadow-sm">
                  <div className="flex gap-1 mb-4">
                    {[1,2,3,4,5].map(s => <span key={s} className="text-primary text-[12px]">★</span>)}
                  </div>
                  <p className="text-muted-foreground mb-6 leading-relaxed text-[16px]">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">{t.avatar}</div>
                    <div>
                      <p className="font-medium text-[16px]">{t.name}</p>
                      <p className="text-muted-foreground text-[12px] font-mono">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 12: FINAL CTA ───────────────────────────────────────────── */}
      <section className="py-[80px] px-4 bg-background border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card text-card-foreground rounded-2xl p-16 relative overflow-hidden text-center border border-border shadow-md">
            <CtaVideoBackground />
            <div className="relative z-10">
              <h2 className="text-5xl md:text-[64px] font-medium mb-6 leading-[1.04] tracking-tight">
                Seamless Streaming
              </h2>
              <p className="text-muted-foreground text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
                Join {stats.users.toLocaleString()}+ AI developers deploying agents and building products that matter.
                Start free, scale unlimited.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                <Link href="/register">
                  <button className="bg-primary text-primary-foreground px-12 py-5 rounded-lg font-medium text-lg shadow-lg hover:bg-primary/90 transition-all hover:-translate-y-0.5">
                    Start Building Free
                  </button>
                </Link>
                <Link href="/marketplace">
                  <button className="bg-background text-foreground px-12 py-5 rounded-lg border border-border font-medium text-lg hover:bg-accent/10 transition-all">
                    Explore Marketplace
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
