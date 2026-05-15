import Link from "next/link"

const S = `
.hero-bg{background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(139,92,246,.18) 0%,transparent 70%)}
.hero-glow{position:absolute;border-radius:50%;filter:blur(100px);pointer-events:none}
.hero-badge{background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.3);border-radius:9999px;padding:.35rem 1rem;display:inline-flex;align-items:center;gap:.5rem}
.hero-gradient{background:linear-gradient(135deg,#fff 0%,#a78bfa 50%,#60a5fa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.875rem;padding:.875rem 2rem;font-size:1rem;font-weight:800;color:#fff;display:inline-flex;align-items:center;gap:.625rem;transition:all .25s}
.hero-btn-primary:hover{transform:scale(1.04);box-shadow:0 0 40px rgba(139,92,246,.35)}
.hero-btn-ghost{border:1px solid rgba(255,255,255,.1);border-radius:.875rem;padding:.875rem 2rem;font-size:1rem;font-weight:700;color:rgba(255,255,255,.75);display:inline-flex;align-items:center;gap:.625rem;transition:all .25s;backdrop-filter:blur(10px)}
.hero-btn-ghost:hover{border-color:rgba(255,255,255,.25);color:#fff}
.hero-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:1.25rem;backdrop-filter:blur(20px);padding:1.25rem 1.5rem}
@keyframes hfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}.h-float{animation:hfloat 5s ease-in-out infinite}
@keyframes hfloat2{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}.h-float2{animation:hfloat2 4s 1s ease-in-out infinite}
@keyframes hpulse{0%,100%{opacity:.4}50%{opacity:1}}.h-pulse{animation:hpulse 3s ease-in-out infinite}
`

const STATS = [
  { value:"50k+", label:"Developers" },
  { value:"2,400", label:"AI Agents" },
  { value:"99.9%", label:"Uptime SLA" },
  { value:"$12M+", label:"Revenue generated" },
]

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#080808] px-4 pt-16 pb-24">
      <style>{S}</style>

      {/* Background orbs */}
      <div className="hero-glow hero-bg absolute inset-0" />
      <div className="hero-glow w-96 h-96 bg-violet-600/15 -top-32 -left-32" />
      <div className="hero-glow w-80 h-80 bg-blue-600/10 -bottom-20 -right-20" />
      <div className="hero-glow w-64 h-64 bg-purple-500/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Floating UI Cards — decorative */}
      <div className="absolute top-28 right-8 lg:right-24 hero-card h-float hidden lg:block w-52">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-green-400 rounded-full h-pulse" />
          <span className="text-xs text-zinc-500">AI Agent Active</span>
        </div>
        <p className="text-sm font-bold text-white">CRM Automation v2.1</p>
        <p className="text-xs text-zinc-600 mt-0.5">4,200 tokens · 99ms</p>
      </div>
      <div className="absolute bottom-36 left-8 lg:left-24 hero-card h-float2 hidden lg:block w-56">
        <p className="text-xs text-zinc-600 mb-2">Monthly Revenue</p>
        <p className="text-2xl font-black text-white">$24,891</p>
        <p className="text-xs text-emerald-400 mt-0.5">▲ 32% from last month</p>
      </div>

      {/* Main Content */}
      <div className="relative text-center max-w-4xl mx-auto">
        {/* Badge */}
        <div className="hero-badge mb-8 mx-auto w-fit">
          <span className="text-purple-400 text-xs">✦</span>
          <span className="text-xs font-bold text-zinc-300">AI-Native SaaS Platform — Now in GA</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
          The AI Infrastructure<br />
          <span className="hero-gradient">for Modern SaaS</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
          Deploy AI agents, manage subscriptions, and scale your product to enterprise — with a single, unified platform built for the next generation of software.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/register">
            <button className="hero-btn-primary">
              Start building free <span>→</span>
            </button>
          </Link>
          <Link href="/demo">
            <button className="hero-btn-ghost">
              <span>▶</span> Live demo
            </button>
          </Link>
        </div>

        {/* Social proof */}
        <p className="text-xs text-zinc-700 mb-12">No credit card required · Free tier always available · SOC 2 compliant</p>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {STATS.map((s, i) => (
            <div key={i} className="hero-card text-center">
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
