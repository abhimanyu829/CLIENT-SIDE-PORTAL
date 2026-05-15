import Link from "next/link"
import { Metadata } from "next"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

export const metadata: Metadata = {
  title: "Live Demos — NexusAI Platform",
  description: "Launch interactive 5-minute demos of CRM, AI Chatbot, Analytics, and Automation. No account required.",
}

const DEMOS = [
  {
    id: "crm",
    title: "Sales CRM",
    description: "Real-time sales pipeline with AI-powered lead scoring, deal tracking, and automated follow-ups.",
    icon: "🏢",
    badge: "Live",
    badgeColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    gradient: "from-emerald-900/40 to-teal-900/20",
    accentColor: "text-emerald-400",
    glowColor: "rgba(16,185,129,0.1)",
    features: ["Pipeline view","AI lead scoring","Email automation","Revenue forecasting"],
    time: "5 min demo",
    users: "3,200+ tried",
  },
  {
    id: "ai-agent",
    title: "AI Chatbot",
    description: "Conversational AI agent powered by GPT-4. Ask anything, automate tasks, generate content.",
    icon: "🤖",
    badge: "Live",
    badgeColor: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    gradient: "from-purple-900/40 to-indigo-900/20",
    accentColor: "text-purple-400",
    glowColor: "rgba(139,92,246,0.1)",
    features: ["GPT-4 powered","Streaming responses","Custom prompts","File analysis"],
    time: "5 min demo",
    users: "8,500+ tried",
  },
  {
    id: "analytics",
    title: "Analytics Dashboard",
    description: "Real-time metrics, user funnels, revenue charts, and cohort analysis with AI insights.",
    icon: "📊",
    badge: "Preview",
    badgeColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    gradient: "from-blue-900/40 to-cyan-900/20",
    accentColor: "text-blue-400",
    glowColor: "rgba(59,130,246,0.1)",
    features: ["Real-time data","Revenue charts","User funnels","AI insights"],
    time: "5 min demo",
    users: "2,100+ tried",
  },
  {
    id: "crm",
    title: "Workflow Automation",
    description: "Visual drag-and-drop automation builder. Trigger actions from events, schedule tasks, connect APIs.",
    icon: "⚡",
    badge: "Beta",
    badgeColor: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    gradient: "from-amber-900/40 to-orange-900/20",
    accentColor: "text-amber-400",
    glowColor: "rgba(245,158,11,0.08)",
    features: ["Visual builder","100+ triggers","API connectors","Scheduling"],
    time: "5 min demo",
    users: "1,400+ tried",
  },
]

async function createDemoSession(template: string) {
  try {
    const session = await db.demoSession.create({
      data: { template, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    })
    return session.id
  } catch {
    return randomUUID()
  }
}

export default async function DemoLandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .text-gradient { background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .btn-gradient { background: linear-gradient(135deg,#6366f1,#8b5cf6); }
        .card-hover { transition: all 0.4s ease; }
        .card-hover:hover { transform: translateY(-6px); }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .float { animation: float 5s ease-in-out infinite; }
        .blink { animation: blink 2s ease-in-out infinite; }
        @keyframes scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .scan-line { animation: scan 4s linear infinite; }
      `}</style>

      {/* Hero */}
      <section className="relative py-28 px-4 text-center overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-purple-500/20 to-transparent" />
        <div className="absolute inset-0" style={{backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",backgroundSize:"80px 80px"}} />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-zinc-400 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full blink" />
            All demos live · No account required · 5 min sessions
          </div>

          <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-6">
            <span className="text-white">Experience</span><br />
            <span className="text-gradient">Before You Build</span>
          </h1>

          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
            Launch fully interactive demos of our platform. Real data, real AI, real experience. No sign-up needed.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-600">
            {["⏱ 5-minute sessions","🔒 Isolated sandboxes","🤖 Real AI models","📊 Live data"].map(f=>(
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Cards */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEMOS.map((demo, idx) => (
            <div
              key={`${demo.id}-${idx}`}
              className="glass rounded-3xl overflow-hidden card-hover group relative"
              style={{boxShadow: `0 0 60px ${demo.glowColor}`}}
            >
              {/* Preview Window */}
              <div className={`relative aspect-video bg-gradient-to-br ${demo.gradient} overflow-hidden`}>
                {/* Mock UI */}
                <div className="absolute inset-0 p-6">
                  <div className="glass rounded-xl p-4 h-full flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                      </div>
                      <span className="text-xs text-zinc-600">{demo.title} — Demo</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full blink" />
                        <span className="text-xs text-zinc-600">Live</span>
                      </div>
                    </div>

                    {demo.id === "ai-agent" ? (
                      /* Chat UI */
                      <div className="flex-1 space-y-3 overflow-hidden">
                        {[["You","Summarize last month's sales","right"],["AI","Revenue up 24%. Top 3 deals closed: Acme ($45K), TechCorp ($32K), StartupXYZ ($18K). Q4 pipeline: $340K","left"]].map(([who,msg,side])=>(
                          <div key={who} className={`flex gap-2 ${side==="right" ? "flex-row-reverse" : ""}`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${side==="right" ? "bg-purple-600" : "bg-zinc-700"}`}>{side==="right"?"U":"🤖"}</div>
                            <div className={`glass rounded-xl px-3 py-2 text-xs max-w-48 ${side==="right" ? "bg-purple-900/40" : ""}`}>{msg}</div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-zinc-700 flex items-center justify-center text-xs">🤖</div>
                          <div className="glass rounded-xl px-3 py-2 flex gap-1">
                            {[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 blink" style={{animationDelay:`${i*0.2}s`}} />)}
                          </div>
                        </div>
                      </div>
                    ) : demo.id === "analytics" ? (
                      /* Analytics UI */
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        {[["$48K","Revenue"],["12K","Users"],["94%","Retention"]].map(([v,l])=>(
                          <div key={l} className="glass rounded-lg p-2 text-center">
                            <p className={`text-sm font-bold ${demo.accentColor}`}>{v}</p>
                            <p className="text-xs text-zinc-600">{l}</p>
                          </div>
                        ))}
                        <div className="col-span-3 glass rounded-lg p-2">
                          <div className="flex items-end gap-1 h-12">
                            {[40,65,45,80,60,90,75].map((h,i)=>(
                              <div key={i} className="flex-1 rounded-sm" style={{height:`${h}%`,background:`linear-gradient(to top, ${demo.glowColor.replace("0.","0.6").replace(",0.",",.6")}, transparent)`}} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* CRM / Generic UI */
                      <div className="flex-1 space-y-2">
                        {[["Lead: Acme Corp","$45,000","Proposal"],["Lead: TechCorp","$32,000","Negotiation"],["Lead: Startup","$18,000","Closed ✓"]].map(([name,val,stage])=>(
                          <div key={name} className="glass rounded-lg px-3 py-2 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                            <span className="text-xs text-zinc-400 flex-1">{name}</span>
                            <span className={`text-xs font-bold ${demo.accentColor}`}>{val}</span>
                            <span className="text-xs text-zinc-600">{stage}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Scan line effect */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="scan-line w-full h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
                </div>
              </div>

              {/* Content */}
              <div className="p-7">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{demo.icon}</span>
                    <div>
                      <h2 className="text-xl font-black">{demo.title}</h2>
                      <p className={`text-xs font-medium mt-0.5 ${demo.accentColor}`}>{demo.users}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${demo.badgeColor}`}>
                    {demo.badge}
                  </span>
                </div>

                <p className="text-zinc-400 text-sm mb-5 leading-relaxed">{demo.description}</p>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {demo.features.map(f=>(
                    <span key={f} className="glass text-xs px-2.5 py-1 rounded-full text-zinc-400">
                      ✓ {f}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Link href={`/demo/${demo.id}`} className="flex-1">
                    <button className="w-full btn-gradient py-3 rounded-xl font-bold text-white text-sm hover:scale-105 transition-all flex items-center justify-center gap-2">
                      ▶ Launch Demo
                      <span className="glass text-xs px-2 py-0.5 rounded-full font-normal">{demo.time}</span>
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-20 glass rounded-3xl p-10">
          <h2 className="text-3xl font-black text-center mb-10">How demos work</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[["01","Pick a demo","Choose from CRM, AI Chat, Analytics, or Automation"],["02","Launch sandbox","We spin up an isolated cloud environment instantly"],["03","Explore freely","Full interactivity. Real AI. Real-time data."],["04","Start building","Sign up and deploy your own in minutes"]].map(([n,title,desc])=>(
              <div key={n} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300 font-black text-sm mx-auto mb-4">
                  {n}
                </div>
                <h3 className="font-bold mb-2">{title}</h3>
                <p className="text-zinc-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
