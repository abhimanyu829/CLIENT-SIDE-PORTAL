import { db } from "@/lib/db"
import { ProductStatus, ProductType } from "@prisma/client"
import { unstable_cache } from "next/cache"
import Link from "next/link"
import ProductCard from "@/components/marketplace/ProductCard"
import AIAgentsClient from "./AIAgentsClient"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { StatsRow } from "@/components/public/StatsRow"
import { FAQSection } from "@/components/public/FAQSection"
import { CallToAction } from "@/components/public/CallToAction"
import { Cpu, Workflow, Network, Server, Lock, Bot } from "lucide-react"

export const revalidate = 30

export const metadata = {
  title: "AI Agents Store — NexusAI | Deploy Intelligent AI Agents",
  description: "Browse and deploy production-ready AI agents. Coding, research, writing, marketing, analytics, customer support, and enterprise AI agents.",
}

const getAgentData = unstable_cache(async () => {
  const [featured, allAgents, newThisWeek, agentCount] = await Promise.all([
    db.product.findFirst({
      where: { status: ProductStatus.PUBLISHED, type: ProductType.AI_AGENT, isFeatured: true },
      include: {
        tiers: { orderBy: { price: "asc" }, take: 1 },
        _count: { select: { subscriptions: true, reviews: true } },
      },
      orderBy: { viewCount: "desc" },
    }),
    db.product.findMany({
      where: { status: ProductStatus.PUBLISHED, type: ProductType.AI_AGENT },
      include: {
        tiers: { orderBy: { price: "asc" }, take: 1 },
        _count: { select: { subscriptions: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { isTrending: "desc" }, { viewCount: "desc" }],
      take: 50,
    }),
    db.product.findMany({
      where: { status: ProductStatus.PUBLISHED, type: ProductType.AI_AGENT },
      include: { tiers: { orderBy: { price: "asc" }, take: 1 }, _count: { select: { subscriptions: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.product.count({ where: { status: ProductStatus.PUBLISHED, type: ProductType.AI_AGENT } }),
  ])

  return { featured, allAgents, newThisWeek, agentCount }
}, ["agent-data"], { revalidate: 30, tags: ["agents", "products"] })

function serialize(p: any) {
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
    isFeatured: p.isFeatured,
    isTrending: p.isTrending,
    isBestSeller: p.isBestSeller,
    badgeText: p.badgeText,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    viewCount: p.viewCount,
    tags: p.tags,
    techStack: p.techStack,
    features: p.features,
    demoUrl: p.demoUrl,
    activeUsers: p._count?.subscriptions ?? 0,
    createdAt: p.createdAt.toISOString(),
    startingPrice: tier ? Number(tier.price) : undefined,
    discountPrice: tier?.discountPrice ? Number(tier.discountPrice) : undefined,
    flashSalePrice: tier?.flashSalePrice ? Number(tier.flashSalePrice) : undefined,
    flashSaleEndsAt: tier?.flashSaleEndsAt ? tier.flashSaleEndsAt.toISOString() : undefined,
    currency: tier?.currency,
    interval: tier?.interval,
    limits: tier?.limits ?? null,
  }
}

export default async function AIAgentsPage() {
  const { featured, allAgents, newThisWeek, agentCount } = await getAgentData()

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}
        .text-gradient{background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);transition:all .2s;border:1px solid rgba(139,92,246,.3)}
        .btn-primary:hover{transform:scale(1.04);box-shadow:0 0 24px rgba(139,92,246,.4)}
        .card-hover{transition:all .3s}
        .card-hover:hover{transform:translateY(-4px);border-color:rgba(139,92,246,.35)}
        .section-label{font-size:.7rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
        .float{animation:float 6s ease-in-out infinite}
      `}</style>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-4 overflow-hidden border-b border-white/5">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl float pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl float pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2.5 glass rounded-full px-5 py-2.5 text-sm text-zinc-400 mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {agentCount} AI Agents Live &amp; Ready to Deploy
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
              <span className="text-gradient">The World&apos;s Best</span>
              <br />AI Agent Store
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Deploy intelligent AI agents in one click. Coding, research, sales, marketing — every workflow automated.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="#all-agents">
                <button className="btn-primary px-8 py-4 rounded-xl text-white font-bold">
                  🤖 Browse {agentCount} Agents
                </button>
              </Link>
              <Link href="/marketplace?type=AI_TOOL">
                <button className="glass px-8 py-4 rounded-xl text-white font-bold hover:border-purple-500/50 transition-all">
                  🧠 AI Tools →
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURED AGENT SPOTLIGHT ────────────────────────────────────────── */}
      {featured && (
        <section className="py-12 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <p className="section-label mb-6 text-center">⭐ Agent Spotlight</p>
            <div className="glass rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="relative min-h-[280px] bg-gradient-to-br from-purple-900/50 to-blue-900/50 overflow-hidden">
                {featured.thumbnailUrl ? (
                  <img src={featured.thumbnailUrl} alt={featured.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[120px] opacity-30">🤖</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50" />
              </div>
              <div className="p-10 flex flex-col justify-center">
                <div className="flex flex-wrap gap-2 mb-5">
                  <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1.5 rounded-full border border-purple-500/30">🤖 AI Agent</span>
                  <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/30">⭐ Featured</span>
                  {featured.isTrending && <span className="bg-red-500/20 text-red-300 text-xs font-bold px-3 py-1.5 rounded-full border border-red-500/30">🔥 Trending</span>}
                </div>
                <h2 className="text-3xl font-black mb-3">{featured.name}</h2>
                <p className="text-zinc-400 mb-5 leading-relaxed">{featured.tagline}</p>
                {featured.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {featured.tags.slice(0, 5).map(t => (
                      <span key={t} className="glass text-xs px-2.5 py-1 rounded-full text-zinc-500">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 mb-6 text-sm">
                  <span className="text-zinc-500">👥 {featured._count.subscriptions.toLocaleString()} deployments</span>
                  {featured.averageRating > 0 && <span className="text-amber-400">★ {featured.averageRating.toFixed(1)}</span>}
                  {featured.tiers[0] && <span className="text-emerald-400 font-bold">From ${Number(featured.tiers[0].price).toFixed(0)}/mo</span>}
                </div>
                <div className="flex gap-3">
                  <Link href={`/marketplace/${featured.slug}`}>
                    <button className="btn-primary px-8 py-3.5 rounded-xl text-white font-bold">Deploy Agent →</button>
                  </Link>
                  {featured.demoUrl && (
                    <Link href={`/demo?product=${featured.slug}`}>
                      <button className="glass px-6 py-3.5 rounded-xl text-zinc-300 font-semibold text-sm hover:border-purple-500/50 transition-all">▶ Try Agent</button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── NEW THIS WEEK ────────────────────────────────────────────────────── */}
      {newThisWeek.length > 0 && (
        <section className="py-12 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="section-label mb-2">🚀 New This Week</p>
                <h2 className="text-2xl font-black">Recently launched agents</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {newThisWeek.map(p => <ProductCard key={p.id} {...serialize(p)} variant="grid" />)}
            </div>
          </div>
        </section>
      )}

      {/* ── ALL AGENTS (client-side filterable) ──────────────────────────────── */}
      <div id="all-agents">
        <AIAgentsClient agents={allAgents.map(serialize)} />
      </div>

      {/* ── BUILD YOUR OWN AGENT CTA ─────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/10 to-transparent" />
            <div className="relative z-10">
              <div className="text-5xl mb-6">🛠️</div>
              <h2 className="text-4xl font-black mb-4">Build &amp; Sell Your Own AI Agent</h2>
              <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
                Have an AI model or workflow? List it on NexusAI and reach {agentCount > 0 ? agentCount.toLocaleString() : "thousands of"} buyers. Full billing, hosting, and analytics included.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link href="/dashboard/products/new">
                  <button className="btn-primary px-8 py-4 rounded-xl text-white font-bold">Submit Your Agent →</button>
                </Link>
                <Link href="/docs/agent-publishing">
                  <button className="glass px-8 py-4 rounded-xl text-zinc-300 font-bold hover:border-purple-500/50 transition-all">Read Publishing Guide</button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <StatsRow stats={[
        { value: "45M+", label: "Tasks Automated" },
        { value: "99.9%", label: "Agent Uptime" },
        { value: "Sub-1s", label: "Average Response" },
        { value: "Enterprise", label: "Security Grade" }
      ]} />

      <FeatureGrid 
        title="Enterprise AI Orchestration"
        description="Deploy, monitor, and scale AI agents across your organization."
        features={[
          { icon: Bot, title: "Autonomous Workflows", description: "Agents can interact with each other and external APIs to complete complex, multi-step tasks without human intervention." },
          { icon: Network, title: "Seamless Integrations", description: "Connect agents directly to Slack, GitHub, Jira, Salesforce, and 100+ other enterprise platforms out of the box." },
          { icon: Server, title: "Dedicated Infrastructure", description: "Enterprise agents run on isolated, dedicated compute clusters ensuring zero noisy-neighbor performance drops." },
          { icon: Lock, title: "Data Governance", description: "Granular RBAC controls ensure agents only access the data and systems they are explicitly authorized to use." },
          { icon: Workflow, title: "Custom Agent Builder", description: "Use our drag-and-drop workflow builder to combine LLMs with Python scripts and custom API calls." },
          { icon: Cpu, title: "Cost Optimization", description: "Automatically route requests to the most cost-effective model (e.g. GPT-4o-mini vs GPT-4o) based on task complexity." }
        ]}
      />

      <FAQSection 
        title="AI Agents FAQs"
        faqs={[
          { question: "What exactly is an AI Agent?", answer: "Unlike a standard chatbot, an AI Agent can take autonomous actions, use tools, read APIs, and execute workflows to accomplish a goal." },
          { question: "Are my company's files secure?", answer: "Absolutely. We enforce strict data isolation. Data processed by your agents is never used to train foundational models." },
          { question: "How do I monitor agent spending?", answer: "The NexusAI dashboard provides real-time token tracking and cost analytics. You can set hard limits to prevent cost overruns." },
          { question: "Can I bring my own API keys?", answer: "Yes, Enterprise customers can use their own OpenAI, Anthropic, or HuggingFace API keys to bypass platform rate limits." }
        ]}
      />

      <CallToAction 
        title="Automate Your Enterprise"
        description="Deploy your first autonomous AI agent in less than 5 minutes."
        ctaText="Start Free Trial"
        ctaHref="/register"
      />
    </div>
  )
}
