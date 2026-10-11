import Link from "next/link"
import {
  Palette,
  Zap,
  ShoppingBag,
  Star,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  DollarSign,
  Users,
  BarChart3,
  Bot,
  Globe2,
  Megaphone,
  ImageIcon,
  Layers,
  Repeat2,
  MessageSquare,
  Gift,
  PlayCircle,
  TrendingUp,
} from "lucide-react"

export const metadata = {
  title: "Abhibhi Developers for Creators — Monetise Your Audience with AI",
  description:
    "Turn your audience into recurring revenue. Sell digital products, SaaS tools, and AI agents on the Abhibhi marketplace — no coding required.",
}

const PAIN_POINTS = [
  {
    icon: DollarSign,
    pain: "One-time sales only",
    fix: "Launch subscriptions, memberships & recurring revenue streams in minutes.",
  },
  {
    icon: Bot,
    pain: "Always answering DMs",
    fix: "Deploy an AI agent that handles FAQs, bookings & support 24/7 for you.",
  },
  {
    icon: ShoppingBag,
    pain: "No storefront",
    fix: "Get a beautiful marketplace listing seen by thousands of buyers instantly.",
  },
  {
    icon: BarChart3,
    pain: "No idea what sells",
    fix: "Real-time analytics: views, conversions, MRR, and buyer demographics.",
  },
]

const FEATURES = [
  {
    icon: ShoppingBag,
    title: "Marketplace Storefront",
    description:
      "List your digital products, AI tools, templates, or services on our curated marketplace. Your work — discoverable by thousands of buyers.",
    badge: "Core",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Repeat2,
    title: "Subscription & Memberships",
    description:
      "Set up monthly or annual subscriptions for your content, community, or software. Razorpay, Stripe & UPI supported for Indian creators.",
    badge: "India-first",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Bot,
    title: "Your Own AI Assistant",
    description:
      "Build a branded AI chatbot that knows your content, answers fan questions, and upsells your products automatically — no code needed.",
    badge: "Popular",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Megaphone,
    title: "Automated Marketing",
    description:
      "Schedule email campaigns, trigger personalized follow-ups, and recover abandoned carts — all on autopilot while you create.",
    badge: "",
    color: "from-rose-500 to-pink-500",
  },
  {
    icon: Layers,
    title: "Digital Product Studio",
    description:
      "Package your knowledge into courses, eBooks, prompt packs, Notion templates, or SaaS tools and sell them with one-click checkout.",
    badge: "New",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: BarChart3,
    title: "Creator Analytics",
    description:
      "Track earnings, top-selling products, subscriber growth, and audience behaviour in a single beautiful dashboard.",
    badge: "",
    color: "from-indigo-500 to-blue-600",
  },
]

const PRODUCT_TYPES = [
  { icon: ImageIcon, label: "Prompt Packs" },
  { icon: Layers, label: "Notion Templates" },
  { icon: PlayCircle, label: "Video Courses" },
  { icon: Bot, label: "AI Agents" },
  { icon: Globe2, label: "SaaS Tools" },
  { icon: Gift, label: "Digital Bundles" },
  { icon: MessageSquare, label: "Community Access" },
  { icon: Palette, label: "Design Assets" },
]

const STEPS = [
  {
    n: "01",
    title: "Create your profile",
    desc: "Sign up, set your brand colours, bio, and payment details in under 5 minutes.",
  },
  {
    n: "02",
    title: "Upload your product",
    desc: "Add a digital product, tool, or service. Set price, description, and preview.",
  },
  {
    n: "03",
    title: "Go live on marketplace",
    desc: "Your listing appears in our curated marketplace with built-in SEO.",
  },
  {
    n: "04",
    title: "Earn while you sleep",
    desc: "AI handles support & follow-ups. You collect payments automatically.",
  },
]

const TIERS = [
  {
    name: "Free Creator",
    price: "₹0",
    sub: "Start selling today — no upfront cost",
    highlight: false,
    features: [
      "1 marketplace listing",
      "Up to ₹10,000 / month revenue",
      "Basic analytics",
      "5% platform fee",
      "Community support",
    ],
    cta: "Start for Free",
    href: "/register",
  },
  {
    name: "Pro Creator",
    price: "₹799",
    sub: "per month · cancel anytime",
    highlight: true,
    features: [
      "Unlimited listings",
      "Unlimited revenue",
      "2% platform fee (vs 5%)",
      "AI assistant for your store",
      "Email marketing automation",
      "Advanced analytics + MRR",
      "Priority support",
      "Custom storefront domain",
    ],
    cta: "Try 14 Days Free",
    href: "/register?plan=pro-creator",
  },
  {
    name: "Creator Agency",
    price: "₹2,999",
    sub: "per month · for teams & agencies",
    highlight: false,
    features: [
      "Everything in Pro",
      "5 team seats",
      "White-label storefront",
      "0% platform fee",
      "Dedicated account manager",
      "Custom integrations",
    ],
    cta: "Talk to Us",
    href: "/contact-sales",
  },
]

const TESTIMONIALS = [
  {
    quote:
      "I listed my Notion template pack and made ₹45,000 in the first month. The AI agent handles all buyer queries — I barely check my inbox.",
    author: "Ritika Sharma",
    role: "Notion Creator, 82K followers",
    stars: 5,
  },
  {
    quote:
      "The subscription billing saved me from manually chasing payments every month. My community membership now generates stable recurring income.",
    author: "Devraj Nair",
    role: "Tech Educator & YouTuber",
    stars: 5,
  },
  {
    quote:
      "Went from zero to ₹1.2L/month selling AI prompt packs. The marketplace gave me instant distribution without running any ads.",
    author: "Aisha Khan",
    role: "AI Prompt Engineer",
    stars: 5,
  },
]

export default function CreatorsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative isolate pt-32 pb-24 px-4 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-rose-600/15 blur-[120px]" />
          <div className="absolute top-60 -right-32 w-[500px] h-[500px] rounded-full bg-violet-500/10 blur-[100px]" />
          <div className="absolute top-40 -left-32 w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[100px]" />
        </div>

        <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          For Creators, Educators &amp; Digital Entrepreneurs
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-none">
          Turn your audience into{" "}
          <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
            recurring revenue.
          </span>
          <br />
          <span className="text-3xl sm:text-4xl font-bold text-zinc-400 mt-3 block">
            With AI working for you around the clock.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-zinc-400 text-lg sm:text-xl leading-relaxed mb-10">
          Sell digital products, courses, templates, and AI tools on the Abhibhi
          marketplace. Automate your support. Grow subscriptions. Keep more of
          what you earn.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 hover:-translate-y-0.5"
          >
            <Palette className="w-4 h-4" />
            Start Selling — Free
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:border-rose-500/40 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all"
          >
            <Globe2 className="w-4 h-4" />
            Browse Marketplace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-zinc-500 text-sm">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No coding needed</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Instant payouts</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> UPI &amp; Razorpay supported</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 500+ creators earning</span>
        </div>
      </section>

      {/* ── WHAT YOU CAN SELL ────────────────────────────── */}
      <section className="py-16 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-4">Sell anything digital</p>
          <h2 className="text-3xl font-black mb-10">What creators list on Abhibhi</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PRODUCT_TYPES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-3 bg-white/3 border border-white/8 rounded-2xl p-5 hover:border-rose-500/30 hover:bg-white/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-rose-400" />
                </div>
                <span className="text-sm font-semibold text-zinc-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN → SOLUTION ──────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-3">We get it</p>
          <h2 className="text-4xl font-black">
            Creator problems.{" "}
            <span className="text-zinc-400">Solved by AI.</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PAIN_POINTS.map(({ icon: Icon, pain, fix }) => (
            <div
              key={pain}
              className="group bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-rose-500/30 hover:bg-white/5 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-rose-400" />
              </div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2 line-through decoration-red-500/60">
                {pain}
              </p>
              <p className="text-white text-sm leading-relaxed">{fix}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PLATFORM FEATURES ────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-3">Platform</p>
          <h2 className="text-4xl font-black mb-4">
            Your complete creator{" "}
            <span className="bg-gradient-to-r from-rose-400 to-violet-400 bg-clip-text text-transparent">
              business stack.
            </span>
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Everything you need — marketplace, billing, AI, analytics — in one place. No 12-tab juggling.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, badge, color }) => (
            <div
              key={title}
              className="group relative bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-white/20 hover:bg-white/5 transition-all hover:-translate-y-1"
            >
              {badge && (
                <span className="absolute top-4 right-4 text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
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
            <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl font-black">Live and earning in 4 steps.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center mx-auto mb-4 text-xl font-black shadow-lg shadow-rose-500/20">
                  {n}
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-zinc-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EARNINGS HIGHLIGHT ───────────────────────────── */}
      <section className="py-16 px-4 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-6 text-center">
          {[
            { value: "₹45L+", label: "Paid out to creators", icon: DollarSign },
            { value: "500+", label: "Active creators", icon: Users },
            { value: "2%", label: "Platform fee (Pro)", icon: TrendingUp },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="bg-white/3 border border-white/8 rounded-2xl p-8 hover:border-rose-500/20 transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-rose-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">{value}</p>
              <p className="text-zinc-500 text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-3">Creator stories</p>
          <h2 className="text-4xl font-black">Real creators. Real income.</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, author, role, stars }) => (
            <div
              key={author}
              className="bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-rose-500/30 transition-all"
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
            <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-black mb-3">Keep more of what you earn.</h2>
            <p className="text-zinc-500">Start free. As you grow, your fee drops.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 items-stretch">
            {TIERS.map(({ name, price, sub, highlight, features, cta, href }) => (
              <div
                key={name}
                className={`relative rounded-2xl p-6 flex flex-col transition-all ${
                  highlight
                    ? "bg-gradient-to-b from-rose-600/20 to-pink-900/20 border-2 border-rose-500/60 shadow-xl shadow-rose-500/10"
                    : "bg-white/3 border border-white/8 hover:border-white/15"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                      BEST FOR CREATORS
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-black text-white text-xl mb-1">{name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-black text-white">{price}</span>
                    {price !== "₹0" && <span className="text-zinc-500 text-sm">/mo</span>}
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
                      ? "bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-lg shadow-rose-500/25"
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

      {/* ── FINAL CTA ────────────────────────────────────── */}
      <section className="py-20 px-4 max-w-4xl mx-auto text-center">
        <div className="relative bg-gradient-to-br from-rose-600/10 via-pink-600/10 to-violet-600/10 border border-rose-500/20 rounded-3xl p-14 overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 mb-6 shadow-lg shadow-rose-500/30">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Your content deserves{" "}
              <span className="bg-gradient-to-r from-rose-400 to-violet-400 bg-clip-text text-transparent">
                a business.
              </span>
            </h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
              Join 500+ creators already earning with Abhibhi Developers. List your first product in under 10 minutes — completely free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-rose-500/25 hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                List Your First Product Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors font-medium"
              >
                Explore the marketplace
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
