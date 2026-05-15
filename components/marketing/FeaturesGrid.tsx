const S = `
.fg-glass{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:1.25rem;padding:1.5rem;transition:all .3s ease}
.fg-glass:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);transform:translateY(-3px)}
.fg-icon{width:2.5rem;height:2.5rem;border-radius:.875rem;display:flex;align-items:center;justify-content:center;font-size:1.25rem;margin-bottom:1rem}
.fg-gradient{background:linear-gradient(135deg,#fff,#a78bfa 60%,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
`

const FEATURES = [
  { icon:"✦", label:"AI Agents", title:"Deploy Intelligent Agents", desc:"Launch trained AI agents to your marketplace in minutes. Auto-scale, monitor usage, and monetize effortlessly.", color:"rgba(139,92,246,.15)", border:"rgba(139,92,246,.2)" },
  { icon:"⬡", label:"Marketplace", title:"Publish & Sell Products", desc:"List SaaS tools, APIs, and AI workflows. Built-in pricing tiers, reviews, and one-click checkout with Stripe.", color:"rgba(59,130,246,.12)", border:"rgba(59,130,246,.2)" },
  { icon:"◎", label:"Support", title:"Unified Support Center", desc:"Real-time threaded ticketing with AI reply suggestions, SLA tracking, and team collaboration built-in.", color:"rgba(16,185,129,.12)", border:"rgba(16,185,129,.2)" },
  { icon:"◑", label:"Billing", title:"Stripe-Powered Billing", desc:"Subscriptions, invoices, usage metering, and prorated upgrades — all connected and automated.", color:"rgba(245,158,11,.12)", border:"rgba(245,158,11,.2)" },
  { icon:"◻", label:"Projects", title:"Project Delivery Tracking", desc:"Kanban boards, milestones, and delivery timelines. Keep clients updated and teams aligned.", color:"rgba(236,72,153,.12)", border:"rgba(236,72,153,.2)" },
  { icon:"◈", label:"Analytics", title:"Real-Time Intelligence", desc:"Token usage, revenue metrics, agent performance, and user behavior — all surfaced in one dashboard.", color:"rgba(6,182,212,.12)", border:"rgba(6,182,212,.2)" },
]

export default function FeaturesGrid() {
  return (
    <section className="py-24 px-4 bg-[#080808]">
      <style>{S}</style>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="text-xs font-black text-purple-400 uppercase tracking-widest">Platform</span>
          <h2 className="text-4xl sm:text-5xl font-black mt-3 mb-4 leading-tight">
            Everything you need.<br /><span className="fg-gradient">Nothing you don&apos;t.</span>
          </h2>
          <p className="text-zinc-500 text-lg max-w-xl mx-auto">One platform to build, ship, sell, and scale AI-native products.</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="fg-glass">
              <div className="fg-icon" style={{background:f.color, border:`1px solid ${f.border}`}}>
                <span className="text-white opacity-90">{f.icon}</span>
              </div>
              <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{f.label}</span>
              <h3 className="text-lg font-black text-white mt-1 mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
