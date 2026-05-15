const S = `
.bg-glass{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:1.25rem;padding:1.5rem}
.bg-gradient{background:linear-gradient(135deg,#fff,#a78bfa 50%,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.bg-cell{border-radius:1.25rem;overflow:hidden;transition:all .25s;position:relative}
.bg-cell:hover{transform:translateY(-3px)}
.cta-glow{background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.1));border:1px solid rgba(139,92,246,.25);border-radius:1.5rem;padding:4rem;text-align:center;position:relative;overflow:hidden}
.cta-glow::before{content:'';position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:400px;height:200px;background:radial-gradient(ellipse,rgba(139,92,246,.25),transparent 70%);pointer-events:none}
.cta-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.875rem;padding:.875rem 2rem;font-size:1rem;font-weight:800;color:#fff;display:inline-flex;align-items:center;gap:.625rem;transition:all .25s;cursor:pointer}
.cta-btn:hover{transform:scale(1.04);box-shadow:0 0 40px rgba(139,92,246,.35)}
.logo-item{filter:grayscale(1) brightness(.4);transition:filter .3s;display:flex;align-items:center;gap:.5rem}
.logo-item:hover{filter:grayscale(0) brightness(1)}
`

// ─── BENTO GRID ───────────────────────────────────────────────────────────────
export function BentoGrid() {
  const CELLS = [
    {
      size:"col-span-2 row-span-2",
      bg:"rgba(99,102,241,.1)", border:"rgba(99,102,241,.2)",
      content: (
        <div className="h-full flex flex-col justify-between p-6">
          <div className="text-4xl mb-4">✦</div>
          <div>
            <p className="text-xs text-purple-400 font-black uppercase tracking-widest mb-2">AI-Powered</p>
            <h3 className="text-2xl font-black mb-2">Deploy AI Agents in 60 seconds</h3>
            <p className="text-sm text-zinc-500">Upload your model, configure endpoints, publish to the marketplace. Done.</p>
          </div>
        </div>
      )
    },
    {
      size:"col-span-1",
      bg:"rgba(16,185,129,.08)", border:"rgba(16,185,129,.15)",
      content: (
        <div className="p-5">
          <div className="text-2xl mb-3">◑</div>
          <p className="font-black text-sm mb-1">Real-Time Analytics</p>
          <p className="text-xs text-zinc-600">Token usage, revenue, and performance in one view.</p>
          <div className="mt-3 flex items-end gap-1 h-8">
            {[40,65,45,80,60,95,72].map((h,i)=>(
              <div key={i} className="flex-1 rounded-sm" style={{height:`${h}%`,background:"rgba(16,185,129,.4)"}} />
            ))}
          </div>
        </div>
      )
    },
    {
      size:"col-span-1",
      bg:"rgba(245,158,11,.07)", border:"rgba(245,158,11,.15)",
      content: (
        <div className="p-5">
          <div className="text-2xl mb-3">⬡</div>
          <p className="font-black text-sm mb-1">Stripe Billing</p>
          <p className="text-xs text-zinc-600">Subscriptions, invoices, usage metering — automated.</p>
        </div>
      )
    },
    {
      size:"col-span-1 row-span-2",
      bg:"rgba(139,92,246,.08)", border:"rgba(139,92,246,.18)",
      content: (
        <div className="p-5 flex flex-col h-full">
          <div className="text-2xl mb-3">◈</div>
          <p className="font-black text-sm mb-2">AI Chat Support</p>
          <div className="flex-1 space-y-2 mt-2">
            {[["User","How do I upgrade my plan?",""],["AI","You can upgrade from /dashboard/subscriptions","bg-purple-500/10"]].map(([role,msg,bg])=>(
              <div key={role} className={`px-3 py-2 rounded-xl text-[11px] ${bg}`} style={{background:bg||"rgba(255,255,255,.04)"}}>
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mr-2">{role}</span>
                <span className="text-zinc-400">{msg}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      size:"col-span-1",
      bg:"rgba(59,130,246,.07)", border:"rgba(59,130,246,.15)",
      content: (
        <div className="p-5">
          <div className="text-2xl mb-2">◎</div>
          <p className="font-black text-sm mb-1">RBAC Security</p>
          <p className="text-xs text-zinc-600">Role-based access for clients, admins, and super admins.</p>
        </div>
      )
    },
    {
      size:"col-span-1",
      bg:"rgba(236,72,153,.07)", border:"rgba(236,72,153,.15)",
      content: (
        <div className="p-5">
          <div className="text-2xl mb-2">◻</div>
          <p className="font-black text-sm mb-1">Project Tracking</p>
          <p className="text-xs text-zinc-600">Kanban boards and milestone delivery timelines.</p>
        </div>
      )
    },
  ]

  return (
    <section className="py-24 px-4 bg-[#080808]">
      <style>{S}</style>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-black text-purple-400 uppercase tracking-widest">Platform</p>
          <h2 className="text-4xl sm:text-5xl font-black mt-2 mb-3">
            Built for <span className="bg-gradient">builders</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[160px]">
          {CELLS.map((cell, i) => (
            <div key={i} className={`bg-cell ${cell.size}`}
              style={{background:cell.bg,border:`1px solid ${cell.border}`}}>
              {cell.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA BANNER ───────────────────────────────────────────────────────────────
import Link from "next/link"

export function CTABanner() {
  return (
    <section className="py-20 px-4 bg-[#080808]">
      <style>{S}</style>
      <div className="max-w-3xl mx-auto">
        <div className="cta-glow">
          <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4">Ready?</p>
          <h2 className="text-4xl sm:text-5xl font-black mb-4">
            Start building<br /><span className="bg-gradient">the future today</span>
          </h2>
          <p className="text-zinc-500 text-lg mb-8 max-w-md mx-auto">
            Join 50,000+ developers shipping AI products with NexusAI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <button className="cta-btn">Get started free →</button>
            </Link>
            <Link href="/demo">
              <button style={{border:"1px solid rgba(255,255,255,.12)",borderRadius:".875rem",padding:".875rem 2rem",fontSize:"1rem",fontWeight:700,color:"rgba(255,255,255,.6)",transition:"all .2s",cursor:"pointer"}}>
                View live demo
              </button>
            </Link>
          </div>
          <p className="text-xs text-zinc-700 mt-6">No credit card required · Free forever plan · Cancel anytime</p>
        </div>
      </div>
    </section>
  )
}

// ─── LOGO CLOUD ───────────────────────────────────────────────────────────────
const LOGOS = [
  {name:"Vercel",   icon:"▲"},
  {name:"Stripe",   icon:"⬡"},
  {name:"OpenAI",   icon:"✦"},
  {name:"Supabase", icon:"⬢"},
  {name:"Linear",   icon:"◑"},
  {name:"Notion",   icon:"◻"},
  {name:"GitHub",   icon:"⊡"},
  {name:"AWS",      icon:"◈"},
]

export function LogoCloud() {
  return (
    <section className="py-16 px-4 border-y border-white/5 bg-[#060606]">
      <style>{S}</style>
      <p className="text-center text-xs text-zinc-700 uppercase tracking-widest font-bold mb-8">
        Trusted by teams using
      </p>
      <div className="flex flex-wrap justify-center gap-8 max-w-4xl mx-auto">
        {LOGOS.map(l => (
          <div key={l.name} className="logo-item">
            <span className="text-zinc-600 text-xl">{l.icon}</span>
            <span className="text-zinc-600 text-sm font-bold">{l.name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── STATS SECTION ────────────────────────────────────────────────────────────
const PLATFORM_STATS = [
  {value:"50K+",     label:"Developers",       sub:"building on NexusAI"},
  {value:"2,400+",   label:"AI Agents",         sub:"published to marketplace"},
  {value:"$12M+",    label:"Revenue generated", sub:"by our creators"},
  {value:"99.99%",   label:"Uptime SLA",        sub:"enterprise guarantee"},
]

export function StatsSection() {
  return (
    <section className="py-20 px-4 bg-[#080808]">
      <style>{S}</style>
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-10">Platform Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PLATFORM_STATS.map((s, i) => (
            <div key={i} className="bg-glass text-center">
              <p className="text-4xl font-black text-white mb-1" style={{background:"linear-gradient(135deg,#fff,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                {s.value}
              </p>
              <p className="font-black text-sm text-zinc-300 mb-0.5">{s.label}</p>
              <p className="text-xs text-zinc-700">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
