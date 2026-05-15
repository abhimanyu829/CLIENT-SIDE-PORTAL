import Link from "next/link"
import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"

async function getFeaturedProducts() {
  try {
    return await db.product.findMany({
      where: { status: ProductStatus.PUBLISHED },
      include: { tiers: { orderBy: { price: "asc" }, take: 1 } },
      orderBy: { viewCount: "desc" },
      take: 6,
    })
  } catch { return [] }
}

export const metadata = {
  title: "NexusAI — Build, Deploy & Scale AI Agents",
  description: "The world-class AI SaaS marketplace. Deploy AI agents, monetize tools, and scale your startup with enterprise-grade infrastructure.",
}

export default async function LandingPage() {
  const products = await getFeaturedProducts()

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        @keyframes pulse-glow { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes slide-up { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .float { animation: float 6s ease-in-out infinite; }
        .float-delay { animation: float 6s ease-in-out 2s infinite; }
        .pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
        .slide-up { animation: slide-up 0.8s ease-out forwards; }
        .spin-slow { animation: spin-slow 20s linear infinite; }
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .glow-blue { box-shadow: 0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(59,130,246,0.05); }
        .glow-purple { box-shadow: 0 0 40px rgba(139,92,246,0.15), 0 0 80px rgba(139,92,246,0.05); }
        .text-gradient { background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #60a5fa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .btn-gradient { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .btn-gradient:hover { background: linear-gradient(135deg, #4f46e5, #7c3aed); }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); border-color: rgba(139,92,246,0.4); box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(139,92,246,0.1); }
        .noise { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); }
      `}</style>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 noise pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl float pulse-glow" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl float-delay pulse-glow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />

        {/* Grid overlay */}
        <div className="absolute inset-0" style={{backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",backgroundSize:"60px 60px"}} />

        <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-zinc-400 mb-8 glow-purple">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Now in public beta — Join 12,000+ developers
            <span className="text-purple-400">→</span>
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-none">
            <span className="text-gradient">Build, Deploy</span>
            <br />
            <span className="text-white">&amp; Scale</span>
            <br />
            <span className="text-gradient">AI Agents</span>
          </h1>

          <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            The world-class AI SaaS marketplace. Monetize your AI tools, deploy agents to millions,
            and build the future of intelligent software.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/register">
              <button className="btn-gradient px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/30 flex items-center gap-2">
                Start Building Free
                <span>→</span>
              </button>
            </Link>
            <Link href="/marketplace">
              <button className="glass px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:border-purple-500/50 hover:bg-white/5 flex items-center gap-2">
                Explore Marketplace
                <span className="text-purple-400">↗</span>
              </button>
            </Link>
          </div>

          {/* Social Proof */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-zinc-500 text-sm">
            {[["12K+","Developers"],["500+","AI Agents"],["$2M+","Creator Revenue"],["99.9%","Uptime"]].map(([val,label])=>(
              <div key={label} className="flex flex-col items-center">
                <span className="text-2xl font-bold text-white">{val}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Floating Dashboard Preview */}
          <div className="mt-20 relative max-w-4xl mx-auto">
            <div className="glass rounded-2xl p-1 glow-blue">
              <div className="bg-zinc-950 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span className="text-xs text-zinc-500 ml-2">nexusai.dev/dashboard</span>
                </div>
                <div className="p-6 grid grid-cols-3 gap-4">
                  {[["AI Requests","128K","↑32%","blue"],["Revenue","$48.2K","↑18%","purple"],["Active Agents","24","↑8%","emerald"]].map(([label,val,change,color])=>(
                    <div key={label} className="glass rounded-xl p-4">
                      <p className="text-zinc-500 text-xs mb-1">{label}</p>
                      <p className="text-2xl font-bold text-white">{val}</p>
                      <p className={`text-xs text-${color}-400 mt-1`}>{change} this month</p>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6 grid grid-cols-4 gap-3">
                  {["Sales CRM","AI Chatbot","Analytics","Automation"].map(m=>(
                    <div key={m} className="glass rounded-lg p-3 text-center">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 mx-auto mb-2 flex items-center justify-center text-purple-400 text-lg">
                        {m==="Sales CRM"?"📊":m==="AI Chatbot"?"🤖":m==="Analytics"?"📈":"⚡"}
                      </div>
                      <p className="text-xs text-zinc-400">{m}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENTO FEATURES GRID ─────────────────────────────────────────── */}
      <section className="py-32 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-purple-400 font-mono text-sm mb-3 tracking-widest uppercase">Platform Features</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Everything you need to<br />
              <span className="text-gradient">build AI products</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Large card */}
            <div className="lg:col-span-2 glass rounded-2xl p-8 card-hover glow-blue relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl" />
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-2xl font-bold mb-3">AI Agent Hosting</h3>
              <p className="text-zinc-400 leading-relaxed">Deploy any AI agent to our global infrastructure. Scale from 0 to millions of requests with zero config. Supports OpenAI, Anthropic, custom models.</p>
              <div className="mt-6 flex gap-2 flex-wrap">
                {["Auto-scaling","99.9% SLA","Edge deployment","API access"].map(t=>(
                  <span key={t} className="glass text-xs px-3 py-1 rounded-full text-zinc-300">{t}</span>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-8 card-hover glow-purple relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-xl" />
              <div className="text-4xl mb-4">🛒</div>
              <h3 className="text-2xl font-bold mb-3">SaaS Marketplace</h3>
              <p className="text-zinc-400">List and sell your SaaS products. Built-in Stripe integration, subscriptions, and payout system.</p>
            </div>

            <div className="glass rounded-2xl p-8 card-hover relative overflow-hidden">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold mb-3">One-click Deploy</h3>
              <p className="text-zinc-400">Push to deploy on Vercel, Railway, or Coolify. Docker support included.</p>
            </div>

            <div className="glass rounded-2xl p-8 card-hover relative overflow-hidden">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-2xl font-bold mb-3">Stripe Monetization</h3>
              <p className="text-zinc-400">Subscriptions, one-time payments, usage billing, creator payouts. Everything configured.</p>
            </div>

            <div className="glass rounded-2xl p-8 card-hover relative overflow-hidden">
              <div className="text-4xl mb-4">🔴</div>
              <h3 className="text-2xl font-bold mb-3">Live Sandboxed Demos</h3>
              <p className="text-zinc-400">Let users try your product before buying with 5-minute interactive demo sessions.</p>
            </div>

            <div className="lg:col-span-2 glass rounded-2xl p-8 card-hover relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-2xl font-bold mb-3">Analytics Dashboard</h3>
              <p className="text-zinc-400 leading-relaxed">Track revenue, user behavior, API usage, and AI request metrics in real time. Built-in CRM, support tickets, and audit logs.</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[["Revenue","$48K"],["Users","12K"],["Agents","500"]].map(([k,v])=>(
                  <div key={k} className="glass rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-purple-400">{v}</p>
                    <p className="text-xs text-zinc-500">{k}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-8 card-hover">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-2xl font-bold mb-3">API Marketplace</h3>
              <p className="text-zinc-400">Expose your AI as an API. Monetize endpoints with usage-based billing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKETPLACE PREVIEW ─────────────────────────────────────────── */}
      <section className="py-32 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-purple-400 font-mono text-sm mb-3 tracking-widest uppercase">Marketplace</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                Featured <span className="text-gradient">AI Products</span>
              </h2>
            </div>
            <Link href="/marketplace" className="glass px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:border-purple-500/50 transition-all">
              Browse All →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.length > 0 ? products.map((p) => (
              <Link key={p.id} href={`/marketplace/${p.slug}`}>
                <div className="glass rounded-2xl overflow-hidden card-hover group">
                  <div className="aspect-video bg-gradient-to-br from-zinc-900 to-zinc-800 relative overflow-hidden">
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center text-3xl">
                          {p.type === "AI_AGENT" ? "🤖" : "⚡"}
                        </div>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className="glass text-xs font-bold px-2.5 py-1 rounded-full text-purple-300">
                        {p.type === "AI_AGENT" ? "AI Agent" : p.type === "SERVICE" ? "Service" : p.type}
                      </span>
                    </div>
                    {p.tiers[0] && (
                      <div className="absolute top-3 right-3">
                        <span className="bg-black/80 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full text-green-400">
                          ${Number(p.tiers[0].price)/100}/mo
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-1 group-hover:text-purple-400 transition-colors">{p.name}</h3>
                    <p className="text-zinc-500 text-sm mb-4 line-clamp-2">{p.tagline}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {"★★★★★".split("").map((s,i)=>(
                          <span key={i} className={`text-sm ${p.averageRating > i ? "text-amber-400":"text-zinc-700"}`}>{s}</span>
                        ))}
                        <span className="text-xs text-zinc-500 ml-1">({p.reviewCount})</span>
                      </div>
                      <span className="text-xs text-zinc-500">{p.viewCount.toLocaleString()} views</span>
                    </div>
                  </div>
                </div>
              </Link>
            )) : (
              /* Skeleton cards if no DB data */
              [1,2,3].map(i=>(
                <div key={i} className="glass rounded-2xl overflow-hidden">
                  <div className="aspect-video bg-zinc-900 animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-zinc-800 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-zinc-800 rounded animate-pulse" />
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── DEMO SECTION ────────────────────────────────────────────────── */}
      <section className="py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl p-12 md:p-16 relative overflow-hidden glow-purple">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <p className="text-purple-400 font-mono text-sm mb-4 tracking-widest uppercase">Live Platform Demos</p>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
                    Try before you<br /><span className="text-gradient">build</span>
                  </h2>
                  <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                    Launch interactive 5-minute demos of CRM, AI Chatbot, and Analytics. No account needed.
                  </p>
                  <Link href="/demo">
                    <button className="btn-gradient px-8 py-4 rounded-xl text-white font-bold text-lg hover:scale-105 transition-all">
                      Launch Demo →
                    </button>
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[["🏢","Sales CRM","Real-time pipeline, lead scoring, AI insights"],["🤖","AI Chatbot","GPT-4 powered, custom prompts, streaming"],["📊","Analytics","Revenue charts, user funnels, heatmaps"],["⚡","Workflows","Visual automation, triggers, actions"]].map(([icon,title,desc])=>(
                    <div key={title} className="glass rounded-xl p-4 card-hover">
                      <span className="text-2xl mb-2 block">{icon}</span>
                      <h4 className="font-bold text-sm mb-1">{title}</h4>
                      <p className="text-zinc-500 text-xs">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING TEASER ──────────────────────────────────────────────── */}
      <section className="py-32 px-4 relative">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-purple-400 font-mono text-sm mb-3 tracking-widest uppercase">Pricing</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Simple, <span className="text-gradient">honest pricing</span>
          </h2>
          <p className="text-zinc-400 text-xl mb-16">Start free. Scale as you grow. No hidden fees.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{name:"Free",price:"$0",period:"/forever",features:["1 AI Agent","5K requests/mo","Community support","Basic analytics"],cta:"Get Started",highlight:false},{name:"Pro",price:"$49",period:"/month",features:["Unlimited agents","500K requests/mo","Priority support","Advanced analytics","Custom domains","API access"],cta:"Start Pro",highlight:true},{name:"Enterprise",price:"Custom",period:"",features:["Unlimited everything","Dedicated infra","SLA guarantee","White-label","SSO/SAML","Custom billing"],cta:"Contact Sales",highlight:false}].map((plan)=>(
              <div key={plan.name} className={`rounded-2xl p-8 card-hover relative overflow-hidden ${plan.highlight ? "bg-gradient-to-b from-purple-900/50 to-indigo-900/30 border border-purple-500/50 glow-purple":"glass"}`}>
                {plan.highlight && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-500 text-xs font-bold px-4 py-1 rounded-full">Most Popular</div>}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-zinc-400">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8 text-left">
                  {plan.features.map(f=>(
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <span className="text-green-400">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.name==="Enterprise"?"/contact":"/register"}>
                  <button className={`w-full py-3 rounded-xl font-bold transition-all hover:scale-105 ${plan.highlight?"btn-gradient text-white":"glass text-white hover:border-purple-500/50"}`}>
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────────── */}
      <section className="py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-purple-400 font-mono text-sm mb-3 tracking-widest uppercase">Social Proof</p>
            <h2 className="text-4xl font-black">Loved by developers<br /><span className="text-gradient">around the world</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{name:"Sarah Chen",role:"ML Engineer @ Stripe",quote:"NexusAI cut our AI deployment time from weeks to hours. The sandbox demos alone converted 40% more enterprise clients.",avatar:"SC"},{name:"Marcus Williams",role:"Founder @ AutomateHQ",quote:"We went from 0 to $50K MRR in 3 months using the marketplace. The Stripe integration is flawless.",avatar:"MW"},{name:"Priya Patel",role:"CTO @ DevStudio",quote:"The best AI infrastructure I've worked with. Scales perfectly and the agent hosting is rock solid.",avatar:"PP"}].map(t=>(
              <div key={t.name} className="glass rounded-2xl p-6 card-hover">
                <div className="flex gap-1 mb-4">{"★★★★★".split("").map((s,i)=><span key={i} className="text-amber-400">{s}</span>)}</div>
                <p className="text-zinc-300 mb-6 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">{t.avatar}</div>
                  <div>
                    <p className="font-bold text-sm">{t.name}</p>
                    <p className="text-zinc-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass rounded-3xl p-16 relative overflow-hidden glow-blue">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20" />
            <div className="relative z-10">
              <h2 className="text-5xl font-black mb-6">Ready to build<br /><span className="text-gradient">the future?</span></h2>
              <p className="text-zinc-400 text-xl mb-10">Join thousands of AI developers deploying agents that matter.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <button className="btn-gradient px-10 py-4 rounded-xl text-white font-bold text-lg hover:scale-105 transition-all hover:shadow-2xl hover:shadow-purple-500/30">
                    Start Building Free
                  </button>
                </Link>
                <Link href="/marketplace">
                  <button className="glass px-10 py-4 rounded-xl text-white font-bold text-lg hover:border-purple-500/50 transition-all">
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
