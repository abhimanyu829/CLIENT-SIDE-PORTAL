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
    <main className="min-h-screen bg-white text-zinc-900 overflow-x-hidden selection:bg-rose-100 selection:text-rose-900">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative isolate pt-32 pb-24 px-4 text-center bg-gradient-to-b from-rose-50/40 via-white to-white border-b border-zinc-100">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-rose-500/10 blur-[130px]" />
          <div className="absolute top-60 -right-32 w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
          <div className="absolute top-40 -left-32 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[120px]" />
        </div>

        <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-rose-500" />
          For Creators, Educators &amp; Digital Entrepreneurs
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-none text-zinc-950">
          Turn your audience into{" "}
          <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-violet-600 bg-clip-text text-transparent">
            recurring revenue.
          </span>
          <br />
          <span className="text-3xl sm:text-4xl font-bold text-zinc-600 mt-4 block">
            With AI working for you around the clock.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-zinc-600 text-lg sm:text-xl leading-relaxed mb-10">
          Sell digital products, courses, templates, and AI tools on the Abhibhi
          marketplace. Automate your support. Grow subscriptions. Keep more of
          what you earn.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35 hover:-translate-y-0.5"
          >
            <Palette className="w-4 h-4" />
            Start Selling — Free
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 font-semibold px-8 py-4 rounded-2xl text-base transition-all shadow-xs"
          >
            <Globe2 className="w-4 h-4" />
            Browse Marketplace
            <ArrowRight className="w-4 h-4 text-zinc-400" />
          </Link>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-zinc-600 text-sm font-medium">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> No coding needed</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Instant payouts</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> UPI &amp; Razorpay supported</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 500+ creators earning</span>
        </div>
      </section>

      {/* ── WHAT YOU CAN SELL ────────────────────────────── */}
      <section className="py-16 px-4 bg-zinc-50/60 border-b border-zinc-200/80">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-3">Sell anything digital</p>
          <h2 className="text-3xl font-black text-zinc-950 mb-10">What creators list on Abhibhi</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PRODUCT_TYPES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-3 bg-white border border-zinc-200/90 rounded-2xl p-5 hover:border-rose-300 hover:shadow-md transition-all group shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-rose-600" />
                </div>
                <span className="text-sm font-semibold text-zinc-800">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN → SOLUTION ──────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-3">We get it</p>
          <h2 className="text-4xl font-black text-zinc-950">
            Creator problems.{" "}
            <span className="text-zinc-500">Solved by AI.</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PAIN_POINTS.map(({ icon: Icon, pain, fix }) => (
            <div
              key={pain}
              className="group bg-white border border-zinc-200/90 rounded-2xl p-6 hover:border-rose-300 hover:shadow-md transition-all shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2 line-through decoration-rose-500/70">
                {pain}
              </p>
              <p className="text-zinc-800 text-sm leading-relaxed font-medium">{fix}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PLATFORM FEATURES ────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto border-t border-zinc-100">
        <div className="text-center mb-14">
          <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-3">Platform</p>
          <h2 className="text-4xl font-black mb-4 text-zinc-950">
            Your complete creator{" "}
            <span className="bg-gradient-to-r from-rose-600 to-violet-600 bg-clip-text text-transparent">
              business stack.
            </span>
          </h2>
          <p className="text-zinc-600 max-w-xl mx-auto">
            Everything you need — marketplace, billing, AI, analytics — in one place. No 12-tab juggling.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, badge, color }) => (
            <div
              key={title}
              className="group relative bg-white border border-zinc-200/90 rounded-2xl p-6 hover:border-zinc-300 hover:shadow-lg transition-all hover:-translate-y-1 shadow-xs"
            >
              {badge && (
                <span className="absolute top-4 right-4 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-md`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-zinc-950 text-base mb-2">{title}</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section className="py-20 px-4 bg-zinc-50/60 border-y border-zinc-200/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl font-black text-zinc-950">Live and earning in 4 steps.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-rose-300 to-transparent" />
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center mx-auto mb-4 text-xl font-black text-white shadow-lg shadow-rose-500/20">
                  {n}
                </div>
                <h3 className="font-bold text-zinc-950 mb-2">{title}</h3>
                <p className="text-zinc-600 text-sm">{desc}</p>
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
            <div key={label} className="bg-white border border-zinc-200/90 rounded-2xl p-8 hover:border-rose-300 hover:shadow-md transition-all shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-4xl font-black text-zinc-950 mb-1">{value}</p>
              <p className="text-zinc-600 text-sm font-medium">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto border-t border-zinc-100">
        <div className="text-center mb-14">
          <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-3">Creator stories</p>
          <h2 className="text-4xl font-black text-zinc-950">Real creators. Real income.</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, author, role, stars }) => (
            <div
              key={author}
              className="bg-white border border-zinc-200/90 rounded-2xl p-6 hover:border-zinc-300 hover:shadow-md transition-all shadow-xs"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-zinc-700 text-sm leading-relaxed mb-5 italic">"{quote}"</p>
              <div>
                <p className="font-bold text-zinc-950 text-sm">{author}</p>
                <p className="text-zinc-500 text-xs">{role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────── */}
      <section className="py-20 px-4 max-w-4xl mx-auto text-center">
        <div className="relative bg-gradient-to-br from-rose-50 via-pink-50/70 to-violet-50 border border-rose-200/80 rounded-3xl p-10 sm:p-14 overflow-hidden shadow-sm">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-rose-400/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-violet-400/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 mb-6 shadow-lg shadow-rose-500/30">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4 text-zinc-950">
              Your content deserves{" "}
              <span className="bg-gradient-to-r from-rose-600 to-violet-600 bg-clip-text text-transparent">
                a business.
              </span>
            </h2>
            <p className="text-zinc-600 text-lg mb-8 max-w-xl mx-auto">
              Join 500+ creators already earning with Abhibhi Developers. List your first product in under 10 minutes — completely free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-rose-500/25 hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                List Your First Product Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors font-semibold"
              >
                Explore the marketplace
                <ArrowRight className="w-4 h-4 text-zinc-400" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
