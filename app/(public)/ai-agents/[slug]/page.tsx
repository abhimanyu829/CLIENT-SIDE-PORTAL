import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { formatCurrency } from "@/lib/utils"
import { ProductStatus, ProductType } from "@prisma/client"

interface Props { params: Promise<{ slug: string }> }

async function getAgent(slug: string) {
  return db.product.findFirst({
    where: { slug, status: ProductStatus.PUBLISHED, type: ProductType.AI_AGENT },
    include: {
      tiers: { orderBy: { price: "asc" } },
      reviews: {
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      _count: { select: { reviews: true } },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const agent = await db.product.findFirst({ where: { slug }, select: { name: true, description: true } })
  if (!agent) return { title: "Agent Not Found" }
  return { title: `${agent.name} — AI Agent | NexusAI`, description: agent.description ?? undefined }
}

const SAMPLE_CONVERSATIONS = [
  { role: "user", content: "Analyze our Q3 sales data and identify top opportunities." },
  { role: "agent", content: "Based on your Q3 data, I found 3 high-priority opportunities: 1) Enterprise segment grew 42% — expand outreach. 2) Churn spike in SMB tier — recommend retention campaign. 3) APAC region untapped — potential $200K ARR." },
  { role: "user", content: "Generate a targeted email campaign for the APAC region." },
  { role: "agent", content: "Draft ready. Subject: 'Scale your team with AI — tailored for APAC teams.' Personalized in 4 languages, optimized send times per timezone. Open rate prediction: 34%." },
]

export default async function AIAgentDetailPage({ params }: Props) {
  const { slug } = await params
  const agent = await getAgent(slug)
  if (!agent) notFound()

  db.product.update({ where: { id: agent.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

  const features: string[] = Array.isArray(agent.features) ? agent.features as string[] : []
  const techStack: string[] = Array.isArray(agent.techStack) ? agent.techStack as string[] : []

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .text-gradient { background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .btn-gradient { background: linear-gradient(135deg,#6366f1,#8b5cf6); }
        .glow-purple { box-shadow: 0 0 40px rgba(139,92,246,0.15); }
        .glow-blue { box-shadow: 0 0 40px rgba(59,130,246,0.12); }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .status-dot { animation: blink 2s ease-in-out infinite; }
        @keyframes typing { 0%,100%{opacity:0} 50%{opacity:1} }
        .typing { animation: typing 1s ease-in-out infinite; }
        .terminal { font-family: 'Courier New', monospace; }
      `}</style>

      {/* Breadcrumb */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-zinc-600">
          <Link href="/ai-agents" className="hover:text-zinc-400 transition-colors">AI Agents</Link>
          <span>/</span>
          <span className="text-zinc-400">{agent.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* LEFT: Main Content */}
          <div className="lg:col-span-2 space-y-12">

            {/* Hero */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/50 to-blue-600/50 flex items-center justify-center text-3xl border border-purple-500/30 glow-purple">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full status-dot" />
                    <span className="text-xs text-zinc-500">Live · 1,240 users active</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="glass text-xs px-2.5 py-1 rounded-full text-purple-300">🤖 AI Agent</span>
                    <span className="glass text-xs px-2.5 py-1 rounded-full text-blue-300">⚡ GPT-4</span>
                    <span className="glass text-xs px-2.5 py-1 rounded-full text-emerald-300">🔗 API Ready</span>
                  </div>
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tight">{agent.name}</h1>
              <p className="text-zinc-400 text-xl">{agent.tagline}</p>

              {agent.averageRating > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s=>(
                      <span key={s} className={`text-xl ${agent.averageRating >= s ? "text-amber-400" : "text-zinc-700"}`}>★</span>
                    ))}
                  </div>
                  <span className="font-bold">{agent.averageRating.toFixed(1)}</span>
                  <span className="text-zinc-500">({agent._count.reviews} reviews)</span>
                </div>
              )}

              <p className="text-zinc-400 leading-relaxed text-lg">{agent.description}</p>

              <div className="flex gap-3">
                <Link href={`/demo?agent=${agent.slug}`}>
                  <button className="btn-gradient px-6 py-3 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center gap-2">
                    ▶ Try Live Demo
                  </button>
                </Link>
                <Link href={`/marketplace/${agent.slug}`}>
                  <button className="glass px-6 py-3 rounded-xl font-bold text-white hover:border-purple-500/50 transition-all">
                    View Pricing
                  </button>
                </Link>
              </div>
            </div>

            {/* Live Playground Preview */}
            <div>
              <h2 className="text-2xl font-black mb-5 flex items-center gap-2">
                <span className="text-purple-400">⚡</span>
                Live Playground
              </h2>
              <div className="glass rounded-2xl overflow-hidden glow-blue">
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-950">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                      <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    </div>
                    <span className="text-xs text-zinc-600 ml-2">Agent Playground — {agent.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full status-dot" />
                    <span className="text-xs text-zinc-600">Connected</span>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="p-6 space-y-4 max-h-72 overflow-y-auto">
                  {SAMPLE_CONVERSATIONS.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${msg.role === "user" ? "bg-purple-600" : "bg-gradient-to-br from-blue-600/50 to-purple-600/50 border border-purple-500/30"}`}>
                        {msg.role === "user" ? "U" : "🤖"}
                      </div>
                      <div className={`glass rounded-xl px-4 py-3 max-w-sm text-sm ${msg.role === "user" ? "bg-purple-900/30 border-purple-500/20" : ""}`}>
                        <p className={msg.role === "agent" ? "text-zinc-300" : "text-white"}>{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {/* Typing indicator */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600/50 to-purple-600/50 border border-purple-500/30 flex items-center justify-center text-sm">🤖</div>
                    <div className="glass rounded-xl px-4 py-3">
                      <div className="flex gap-1">
                        {[0,1,2].map(i=>(
                          <div key={i} className="w-2 h-2 rounded-full bg-purple-400 typing" style={{animationDelay:`${i*0.2}s`}} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="border-t border-white/5 p-4">
                  <div className="flex gap-3">
                    <input
                      placeholder="Send a message to the agent..."
                      className="flex-1 glass rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50"
                    />
                    <Link href={`/demo?agent=${agent.slug}`}>
                      <button className="btn-gradient px-5 py-3 rounded-xl text-white font-bold text-sm hover:scale-105 transition-all">
                        Send →
                      </button>
                    </Link>
                  </div>
                  <p className="text-xs text-zinc-700 mt-2 text-center">Try the full experience — <Link href="/register" className="text-purple-400 hover:underline">sign up free</Link></p>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            {features.length > 0 && (
              <div>
                <h2 className="text-2xl font-black mb-5">Capabilities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {features.map((f,i)=>(
                    <div key={i} className="glass rounded-xl p-4 flex items-center gap-3 hover:border-purple-500/30 transition-all">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-zinc-300 text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* API Preview */}
            <div>
              <h2 className="text-2xl font-black mb-5 flex items-center gap-2">
                <span className="text-blue-400">{"</>"}</span>
                API Integration
              </h2>
              <div className="glass rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-zinc-950">
                  <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">POST</span>
                  <span className="text-xs text-zinc-500 terminal">/api/agents/{agent.slug}/invoke</span>
                </div>
                <div className="p-5">
                  <pre className="text-xs text-zinc-400 terminal overflow-x-auto leading-relaxed">{`const response = await fetch('/api/agents/${agent.slug}/invoke', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Analyze my sales data...",
    context: { user_id: "usr_123" }
  })
})

const { reply, usage } = await response.json()`}</pre>
                </div>
              </div>
            </div>

            {/* Reviews */}
            {agent.reviews.length > 0 && (
              <div>
                <h2 className="text-2xl font-black mb-6">What users say</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agent.reviews.map(review=>(
                    <div key={review.id} className="glass rounded-2xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">
                          {(review.user.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{review.user.name ?? "Anonymous"}</p>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s=><span key={s} className={`text-xs ${review.rating >= s ? "text-amber-400" : "text-zinc-700"}`}>★</span>)}
                          </div>
                        </div>
                      </div>
                      {review.title && <p className="font-medium text-sm mb-1">{review.title}</p>}
                      <p className="text-zinc-500 text-sm">{review.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-5">

            {/* Metrics */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-4 text-zinc-400 uppercase tracking-wider">Performance</h3>
              <div className="space-y-3">
                {[["Response Speed","< 200ms","text-emerald-400"],["Uptime","99.97%","text-blue-400"],["Daily Requests",agent.viewCount.toLocaleString(),"text-purple-400"],["Avg Rating",(agent.averageRating||5).toFixed(1)+" / 5","text-amber-400"]].map(([k,v,c])=>(
                  <div key={k} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-sm text-zinc-500">{k}</span>
                    <span className={`text-sm font-bold ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing quick view */}
            {agent.tiers.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-4 text-zinc-400 uppercase tracking-wider">Pricing Plans</h3>
                <div className="space-y-3">
                  {agent.tiers.map(tier=>(
                    <div key={tier.id} className={`rounded-xl p-4 flex items-center justify-between ${tier.isPopular ? "bg-purple-900/30 border border-purple-500/30" : "glass"}`}>
                      <div>
                        <p className="font-bold text-sm">{tier.name}</p>
                        {tier.isPopular && <p className="text-xs text-purple-400">Popular</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg">{formatCurrency(Number(tier.price)/100, tier.currency)}</p>
                        <p className="text-xs text-zinc-600">/{tier.interval === "MONTHLY" ? "mo" : tier.interval === "YEARLY" ? "yr" : "once"}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href={`/marketplace/${agent.slug}`}>
                  <button className="w-full btn-gradient py-3 rounded-xl font-bold text-white mt-4 hover:scale-105 transition-all">
                    Get Started
                  </button>
                </Link>
              </div>
            )}

            {/* Tech stack */}
            {techStack.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-3 text-zinc-400 uppercase tracking-wider">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {techStack.map(t=>(
                    <span key={t} className="glass text-xs px-3 py-1.5 rounded-full text-zinc-400">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Share */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-3 text-zinc-400 uppercase tracking-wider">Share</h3>
              <div className="flex gap-2">
                {["𝕏","in","🔗"].map(s=>(
                  <button key={s} className="flex-1 glass py-2.5 rounded-xl text-sm hover:border-white/20 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
