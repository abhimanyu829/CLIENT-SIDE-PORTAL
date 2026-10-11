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
  Star,
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

const TIERS = [
  {
    name: "Seed",
    price: "Free",
    sub: "Forever free while you validate",
    highlight: false,
    features: [
      "1 AI Agent",
      "500 AI calls / month",
      "Basic analytics",
      "Community support",
      "Marketplace listing",
    ],
    cta: "Start Free",
    href: "/register",
  },
  {
    name: "Growth",
    price: "₹999",
    sub: "per month · billed monthly",
    highlight: true,
    features: [
      "10 AI Agents",
      "25,000 AI calls / month",
      "Advanced analytics + MRR tracking",
      "Subscription engine (Stripe + Razorpay)",
      "Custom domain",
      "Priority email support",
      "50+ integrations",
    ],
    cta: "Start 14-day Trial",
    href: "/register?plan=growth",
  },
  {
    name: "Scale",
    price: "₹4,999",
    sub: "per month · cancel anytime",
    highlight: false,
    features: [
      "Unlimited AI Agents",
      "Unlimited AI calls",
      "White-label marketplace",
      "Dedicated Slack support",
      "Custom SLA",
      "Founder program access",
      "SOC 2 compliance docs",
    ],
    cta: "Talk to Founder",
    href: "/contact-sales",
  },
]

const TESTIMONIALS = [
  {
    quote:
      "We replaced a 3-person support team with one AI agent built on Abhibhi. Our response time went from 6 hours to 12 seconds.",
    author: "Priya Mehta",
    role: "CEO, QuickShip.in",
    stars: 5,
  },
  {
    quote:
      "Launched our SaaS subscription billing in a weekend. The Razorpay integration just worked. Saved us 3 weeks of engineering time.",
    author: "Arjun Kapoor",
    role: "CTO, Nestara AI",
    stars: 5,
  },
  {
    quote:
      "The founder support is real. They shipped a custom feature for us in 48 hours when we had an enterprise deal on the line.",
    author: "Sneha Reddy",
    role: "Founder, DataBridge",
    stars: 5,
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
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative isolate pt-32 pb-24 px-4 text-center">
        {/* ambient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute top-60 -right-32 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[100px]" />
          <div className="absolute top-40 -left-32 w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[100px]" />
        </div>

        {/* badge */}
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          Built for Founders &amp; Early-Stage Startups
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-none">
          Ship Your AI Product{" "}
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            10× Faster.
          </span>
          <br />
          <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-400 mt-2 block">
            Without the enterprise price tag.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-zinc-400 text-lg sm:text-xl leading-relaxed mb-10">
          Abhibhi Developers gives startups AI agents, subscription billing,
          analytics, and marketplace distribution — in one platform. Go from
          idea to revenue in a weekend.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5"
          >
            <Rocket className="w-4 h-4" />
            Start Building — Free
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:border-violet-500/40 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all"
          >
            <Globe2 className="w-4 h-4" />
            Browse Marketplace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* social proof strip */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-zinc-500 text-sm">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No credit card required</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Free tier forever</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Deploy in &lt; 5 minutes</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 200+ startups growing</span>
        </div>
      </section>

      {/* ── PAIN → SOLUTION ──────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">We get it</p>
          <h2 className="text-4xl font-black">
            Every founder hits these walls.{" "}
            <span className="text-zinc-400">We tear them down.</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PAIN_POINTS.map(({ icon: Icon, pain, fix }) => (
            <div
              key={pain}
              className="group relative bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-violet-500/40 hover:bg-white/5 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-violet-400" />
              </div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2 line-through decoration-red-500/60">
                {pain}
              </p>
              <p className="text-white text-sm leading-relaxed">{fix}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Platform</p>
          <h2 className="text-4xl font-black mb-4">
            Everything a startup needs.{" "}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              Nothing it doesn't.
            </span>
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Stop stitching together 12 SaaS tools. One platform. One bill. All the AI power.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, badge, color }) => (
            <div
              key={title}
              className="group relative bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-white/20 hover:bg-white/5 transition-all hover:-translate-y-1"
            >
              {badge && (
                <span className="absolute top-4 right-4 text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-white text-base mb-2">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="py-20 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl font-black">From zero to live in 4 steps.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* connecting line */}
            <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mx-auto mb-4 text-xl font-black shadow-lg shadow-violet-500/20">
                  {n}
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-zinc-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Founders love us</p>
          <h2 className="text-4xl font-black">Real results from real startups.</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, author, role, stars }) => (
            <div
              key={author}
              className="bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-violet-500/30 transition-all"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed mb-5 italic">"{quote}"</p>
              <div>
                <p className="font-bold text-white text-sm">{author}</p>
                <p className="text-zinc-500 text-xs">{role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-black mb-3">Pricing that scales with you.</h2>
            <p className="text-zinc-500">Start free. Upgrade when you're ready.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 items-stretch">
            {TIERS.map(({ name, price, sub, highlight, features, cta, href }) => (
              <div
                key={name}
                className={`relative rounded-2xl p-6 flex flex-col transition-all ${
                  highlight
                    ? "bg-gradient-to-b from-violet-600/20 to-purple-900/20 border-2 border-violet-500/60 shadow-xl shadow-violet-500/10"
                    : "bg-white/3 border border-white/8 hover:border-white/15"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-black text-white text-xl mb-1">{name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-black text-white">{price}</span>
                    {price !== "Free" && <span className="text-zinc-500 text-sm">/mo</span>}
                  </div>
                  <p className="text-zinc-500 text-xs">{sub}</p>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={`w-full text-center font-bold py-3 rounded-xl transition-all text-sm ${
                    highlight
                      ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25"
                      : "bg-white/8 hover:bg-white/15 text-white border border-white/10"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IDEA SPARK SECTION ────────────────────────────── */}
      <section className="py-20 px-4 max-w-4xl mx-auto text-center">
        <div className="relative bg-gradient-to-br from-violet-600/10 via-purple-600/10 to-pink-600/10 border border-violet-500/20 rounded-3xl p-14 overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 mb-6 shadow-lg shadow-violet-500/30">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Your idea deserves{" "}
              <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                the best tools.
              </span>
            </h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
              Join 200+ startups already using Abhibhi Developers to ship faster, automate smarter, and grow without limits.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact-sales"
                className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors font-medium"
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
