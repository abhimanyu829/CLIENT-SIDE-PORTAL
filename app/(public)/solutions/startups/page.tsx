import Link from "next/link"
import {
  Rocket,
  Zap,
  TrendingUp,
  ShieldCheck,
  Users,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Bot,
  Globe2,
  Clock,
  Flame,
  Code2,
  HeartHandshake,
  Lightbulb,
} from "lucide-react"

export const metadata = {
  title: "Abhibhi Developers for Startups — Launch Faster, Scale Smarter",
  description:
    "Purpose-built AI tools for founders and early-stage startups. Ship your first AI-powered product in hours, not months. Flexible pricing that scales with your growth.",
}

const PAIN_POINTS = [
  {
    icon: Clock,
    pain: "Months to ship",
    fix: "Deploy production-ready AI in hours with our pre-built agent templates.",
  },
  {
    icon: DollarSign,
    pain: "VC runway burning fast",
    fix: "Start free. Pay only when you grow. No hidden infra costs.",
  },
  {
    icon: Users,
    pain: "Can't afford a full team",
    fix: "AI agents act as your 24/7 sales, support & ops team.",
  },
  {
    icon: Code2,
    pain: "Complex integrations",
    fix: "One SDK. 50+ integrations. Connect your stack in minutes.",
  },
]

const FEATURES = [
  {
    icon: Bot,
    title: "AI Agent Studio",
    description:
      "Build customer-facing AI agents for support, sales, and onboarding — no ML expertise needed. Deploy in one click.",
    badge: "Most Used",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: BarChart3,
    title: "Growth Analytics",
    description:
      "Real-time dashboards showing MRR, churn, activation rates, and AI agent ROI. Make data-driven decisions from day one.",
    badge: "New",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Zap,
    title: "Instant Automations",
    description:
      "Automate lead qualification, invoice generation, ticket routing, and onboarding flows with zero code.",
    badge: "Popular",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise-Grade Security",
    description:
      "SOC 2-ready infrastructure from day one. Impress enterprise buyers before your Series A.",
    badge: "",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: TrendingUp,
    title: "Subscription Engine",
    description:
      "Launch subscriptions, trials, and tiered pricing in minutes. Razorpay, Stripe & UPI supported out of the box.",
    badge: "India-first",
    color: "from-rose-500 to-pink-500",
  },
  {
    icon: HeartHandshake,
    title: "Founder Support",
    description:
      "Direct Slack access to our engineering team. We ship custom features for startups in our accelerator program.",
    badge: "",
    color: "from-indigo-500 to-blue-600",
  },
]


const STEPS = [
  {
    n: "01",
    title: "Sign up free",
    desc: "No credit card. No lock-in. Get your account in 30 seconds.",
  },
  {
    n: "02",
    title: "Pick a template",
    desc: "Choose from 20+ startup-specific AI agent templates.",
  },
  {
    n: "03",
    title: "Connect your stack",
    desc: "Integrate Slack, Notion, CRM, or payment gateway in minutes.",
  },
  {
    n: "04",
    title: "Go live",
    desc: "Ship to production with one click. We handle scaling.",
  },
]

export default function StartupsPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative isolate pt-32 pb-24 px-4 text-center bg-gradient-to-b from-violet-50/50 via-white to-white">
        {/* ambient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-violet-500/10 blur-[120px]" />
          <div className="absolute top-40 -left-32 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
        </div>

        {/* badge */}
        <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          Built for Founders &amp; Early-Stage Startups
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-none text-zinc-900">
          Ship Your AI Product{" "}
          <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            10× Faster.
          </span>
          <br />
          <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-600 mt-2 block">
            Without the enterprise price tag.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-zinc-600 text-lg sm:text-xl leading-relaxed mb-10">
          Abhibhi Developers gives startups AI agents, subscription billing,
          analytics, and marketplace distribution — in one platform. Go from
          idea to revenue in a weekend.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 hover:-translate-y-0.5"
          >
            <Rocket className="w-4 h-4" />
            Start Building — Free
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 bg-white border border-zinc-200 hover:border-violet-400 hover:bg-zinc-50 text-zinc-800 font-semibold px-8 py-4 rounded-2xl text-base transition-all shadow-xs"
          >
            <Globe2 className="w-4 h-4" />
            Browse Marketplace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* social proof strip */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-zinc-600 text-sm font-medium">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> No credit card required</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Free tier forever</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Deploy in &lt; 5 minutes</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 200+ startups growing</span>
        </div>
      </section>

      {/* ── PAIN → SOLUTION ──────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-violet-600 text-sm font-semibold uppercase tracking-widest mb-3">We get it</p>
          <h2 className="text-4xl font-black text-zinc-900">
            Every founder hits these walls.{" "}
            <span className="text-zinc-500">We tear them down.</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PAIN_POINTS.map(({ icon: Icon, pain, fix }) => (
            <div
              key={pain}
              className="group relative bg-zinc-50/80 border border-zinc-200 rounded-2xl p-6 hover:border-violet-300 hover:bg-white hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-violet-600" />
              </div>
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2 line-through decoration-red-500">
                {pain}
              </p>
              <p className="text-zinc-900 text-sm leading-relaxed font-medium">{fix}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-violet-600 text-sm font-semibold uppercase tracking-widest mb-3">Platform</p>
          <h2 className="text-4xl font-black mb-4 text-zinc-900">
            Everything a startup needs.{" "}
            <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
              Nothing it doesn't.
            </span>
          </h2>
          <p className="text-zinc-600 max-w-xl mx-auto">
            Stop stitching together 12 SaaS tools. One platform. One bill. All the AI power.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, badge, color }) => (
            <div
              key={title}
              className="group relative bg-white border border-zinc-200 rounded-2xl p-6 hover:border-violet-300 hover:shadow-lg transition-all hover:-translate-y-1"
            >
              {badge && (
                <span className="absolute top-4 right-4 text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-md text-white`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-zinc-900 text-base mb-2">{title}</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="py-20 px-4 bg-zinc-50/80 border-y border-zinc-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-violet-600 text-sm font-semibold uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl font-black text-zinc-900">From zero to live in 4 steps.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* connecting line */}
            <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center mx-auto mb-4 text-xl font-black text-white shadow-md shadow-violet-500/20">
                  {n}
                </div>
                <h3 className="font-bold text-zinc-900 mb-2">{title}</h3>
                <p className="text-zinc-600 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── IDEA SPARK SECTION ────────────────────────────── */}
      <section className="py-20 px-4 max-w-4xl mx-auto text-center">
        <div className="relative bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 border border-violet-200 rounded-3xl p-14 overflow-hidden shadow-xs">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-violet-400/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-400/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 mb-6 shadow-md shadow-violet-500/25 text-white">
              <Lightbulb className="w-8 h-8" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4 text-zinc-900">
              Your idea deserves{" "}
              <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                the best tools.
              </span>
            </h2>
            <p className="text-zinc-600 text-lg mb-8 max-w-xl mx-auto">
              Join 200+ startups already using Abhibhi Developers to ship faster, automate smarter, and grow without limits.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-violet-500/20 hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact-sales"
                className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors font-medium"
              >
                Talk to a founder
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
