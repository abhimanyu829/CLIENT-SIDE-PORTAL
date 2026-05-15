import Link from "next/link"
import { Metadata } from "next"
import { db } from "@/lib/db"
import { ProductStatus, ProductType } from "@prisma/client"
import { formatCurrency } from "@/lib/utils"

export const metadata: Metadata = {
  title: "AI Agents — NexusAI",
  description: "Discover and deploy AI agents for coding, research, automation, writing, and more.",
}

async function getAgents() {
  try {
    return await db.product.findMany({
      where: { status: ProductStatus.PUBLISHED, type: ProductType.AI_AGENT },
      include: { tiers: { take: 1, orderBy: { price: "asc" } } },
      orderBy: { viewCount: "desc" },
    })
  } catch { return [] }
}

const CAPABILITIES = ["Coding","Research","Automation","Writing","Design","Marketing","Data Analysis","Finance","Education","Customer Support"]

export default async function AIAgentsPage() {
  const agents = await getAgents()

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .text-gradient { background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .btn-gradient { background: linear-gradient(135deg,#6366f1,#8b5cf6); }
        .glow-agent { box-shadow: 0 0 30px rgba(139,92,246,0.12), 0 0 60px rgba(59,130,246,0.06); }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .float-card { animation: float 4s ease-in-out infinite; }
        .status-dot { animation: blink 2s ease-in-out infinite; }
      `}</style>

      {/* Hero */}
      <section className="relative py-28 px-4 text-center overflow-hidden">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        {/* Grid */}
        <div className="absolute inset-0 opacity-20" style={{backgroundImage:"linear-gradient(rgba(139,92,246,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.1) 1px,transparent 1px)",backgroundSize:"60px 60px"}} />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-zinc-400 mb-8">
            <span className="w-2 h-2 bg-purple-400 rounded-full status-dot" />
            {agents.length} AI agents live & running
          </div>
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-6">
            <span className="text-white">Deploy</span><br />
            <span className="text-gradient">AI Agents</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Browse, customize, and deploy AI agents built by the world&apos;s best AI engineers. From research assistants to full automation pipelines.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/marketplace">
              <button className="btn-gradient px-8 py-4 rounded-xl font-bold text-white hover:scale-105 transition-all">
                Browse All Agents
              </button>
            </Link>
            <Link href="/demo">
              <button className="glass px-8 py-4 rounded-xl font-bold text-white hover:border-purple-500/50 transition-all">
                ▶ Try Live Demo
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Capability Filters */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto">
          <button className="glass rounded-lg px-4 py-2 text-xs font-medium text-purple-300 border-purple-500/50 whitespace-nowrap">
            All Agents
          </button>
          {CAPABILITIES.map(c=>(
            <button key={c} className="glass rounded-lg px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-all whitespace-nowrap">
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">

        {/* Featured Agent Banner */}
        <div className="glass rounded-3xl p-8 mb-12 relative overflow-hidden glow-agent">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/10 pointer-events-none" />
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-mono tracking-widest text-purple-400 uppercase mb-3 block">⭐ Featured Agent</span>
              <h2 className="text-3xl font-black mb-3">The Ultimate AI Workspace</h2>
              <p className="text-zinc-400 mb-6">An all-in-one AI agent that handles research, writing, coding, and analysis. Powered by GPT-4 with custom tooling.</p>
              <div className="flex items-center gap-4">
                <Link href="/demo">
                  <button className="btn-gradient px-6 py-3 rounded-xl font-bold text-white text-sm hover:scale-105 transition-all">
                    Try Free Demo
                  </button>
                </Link>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full status-dot" />
                  <span className="text-xs text-zinc-500">1,240 active users</span>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-5 space-y-3">
              {["📝 Write & edit documents","🔍 Deep research & analysis","💻 Generate & review code","📊 Analyze data & create charts"].map(c=>(
                <div key={c} className="flex items-center gap-3 glass rounded-xl p-3">
                  <span className="text-sm">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trending */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xl">🔥</span>
          <h2 className="text-2xl font-bold">Trending Agents</h2>
          <span className="glass text-xs px-2.5 py-1 rounded-full text-zinc-400">Updated hourly</span>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {agents.length > 0 ? agents.map((agent, idx) => (
            <Link key={agent.id} href={`/ai-agents/${agent.slug}`}>
              <article className="glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10 group cursor-pointer" style={{animationDelay:`${idx*0.1}s`}}>
                {/* Agent Avatar */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600/40 to-blue-600/40 flex items-center justify-center text-2xl border border-purple-500/30 glow-agent">
                    🤖
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-green-400 rounded-full status-dot" />
                      <span className="text-xs text-zinc-600">Online</span>
                    </div>
                    {agent.tiers[0] && (
                      <span className="text-xs bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full border border-purple-500/20">
                        ${Number(agent.tiers[0].price)/100}/mo
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-lg mb-2 group-hover:text-purple-300 transition-colors">{agent.name}</h3>
                <p className="text-zinc-500 text-sm mb-4 line-clamp-2">{agent.tagline}</p>

                {/* Capability chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(["Fast","GPT-4","API Ready"]).map(tag=>(
                    <span key={tag} className="text-xs glass px-2 py-0.5 rounded-full text-zinc-500">{tag}</span>
                  ))}
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s=>(
                      <span key={s} className={`text-xs ${agent.averageRating >= s ? "text-amber-400" : "text-zinc-700"}`}>★</span>
                    ))}
                    <span className="text-xs text-zinc-600 ml-1">({agent.reviewCount})</span>
                  </div>
                  <span className="text-xs text-purple-400 font-medium group-hover:gap-2 transition-all">
                    Try Agent →
                  </span>
                </div>
              </article>
            </Link>
          )) : (
            /* Empty state placeholder cards */
            [1,2,3,4,5,6].map(i=>(
              <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800" />
                  <div className="h-5 w-16 bg-zinc-800 rounded-full" />
                </div>
                <div className="h-5 bg-zinc-800 rounded w-2/3 mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-full mb-1" />
                <div className="h-3 bg-zinc-800 rounded w-3/4" />
              </div>
            ))
          )}
        </div>

        {/* CTA */}
        <div className="glass rounded-3xl p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/10 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-4xl font-black mb-4">Build your own AI Agent</h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">Deploy any LLM-powered agent to our global infrastructure. Earn revenue from every user.</p>
            <Link href="/register">
              <button className="btn-gradient px-8 py-4 rounded-xl font-bold text-white text-lg hover:scale-105 transition-all">
                Start Building Free →
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
