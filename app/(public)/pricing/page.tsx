import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"
import { unstable_cache } from "next/cache"
import Link from "next/link"
import CountdownTimer from "@/components/marketplace/CountdownTimer"

export const revalidate = 30

export const metadata = {
  title: "Pricing — NexusAI | Transparent, Flexible Pricing for Every Team",
  description: "Choose the right plan for your team. Flexible monthly and yearly pricing for all NexusAI products. Start free, scale when you're ready.",
}

const getPricingData = unstable_cache(async () => {
  return db.product.findMany({
    where: { status: ProductStatus.PUBLISHED },
    include: { tiers: { where: { isActive: true }, orderBy: { price: "asc" } } },
    orderBy: [{ isFeatured: "desc" }, { viewCount: "desc" }],
    take: 10,
  })
}, ["pricing-data"], { revalidate: 30, tags: ["pricing", "products"] })

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "/month", YEARLY: "/year", ONE_TIME: " one-time", LIFETIME: " lifetime",
  WEEKLY: "/week", PER_SEAT: "/seat", USAGE_BASED: " usage", TOKEN_BASED: "/1K tokens",
}

export default async function PricingPage() {
  const products = await getPricingData()
  const now = new Date()

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}
        .text-gradient{background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);transition:all .2s;border:1px solid rgba(139,92,246,.3)}
        .btn-primary:hover{transform:scale(1.03);box-shadow:0 0 24px rgba(139,92,246,.4)}
        .popular-card{background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.1));border-color:rgba(139,92,246,.5)!important}
        .section-label{font-size:.7rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .card-hover{transition:all .3s}
        .card-hover:hover{transform:translateY(-4px)}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        .float{animation:float 8s ease-in-out infinite}
      `}</style>

      {/* HERO */}
      <section className="relative py-24 px-4 overflow-hidden border-b border-white/5 text-center">
        <div className="absolute top-20 left-1/3 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl float pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10">
          <p className="section-label mb-4">Pricing</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            Simple, <span className="text-gradient">transparent</span> pricing
          </h1>
          <p className="text-xl text-zinc-400 mb-6 max-w-2xl mx-auto leading-relaxed">
            Start free, scale when you grow. No hidden fees. Cancel anytime. Every plan includes our 14-day money-back guarantee.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {["No credit card required", "Free plan available", "14-day money back", "Cancel anytime"].map(b => (
              <span key={b} className="glass px-4 py-1.5 rounded-full text-xs text-zinc-500">✓ {b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT PRICING SECTIONS */}
      <div className="max-w-7xl mx-auto px-4 py-16 space-y-24">
        {products.map(product => {
          if (product.tiers.length === 0) return null
          return (
            <section key={product.id} id={product.slug}>
              {/* Product header */}
              <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  {product.thumbnailUrl && (
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0">
                      <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-black">{product.name}</h2>
                    <p className="text-zinc-500 text-sm">{product.tagline}</p>
                  </div>
                </div>
                <Link href={`/marketplace/${product.slug}`}>
                  <button className="glass px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:border-purple-500/40 transition-all">
                    View Product →
                  </button>
                </Link>
              </div>

              {/* Tiers grid */}
              <div className={`grid gap-6 ${product.tiers.length === 1 ? "max-w-sm" : product.tiers.length === 2 ? "sm:grid-cols-2 max-w-2xl" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                {product.tiers.map(tier => {
                  const hasFlash = !!(tier.flashSalePrice && tier.flashSaleEndsAt && new Date(tier.flashSaleEndsAt) > now)
                  const effectivePrice = hasFlash ? Number(tier.flashSalePrice) : tier.discountPrice ? Number(tier.discountPrice) : Number(tier.price)
                  const tf: string[] = Array.isArray(tier.features) ? tier.features as string[] : []

                  return (
                    <div key={tier.id}
                      className={`relative glass rounded-2xl p-7 card-hover ${tier.isPopular ? "popular-card" : ""}`}>
                      {tier.isPopular && (
                        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-indigo-500 text-xs font-bold px-5 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                          Most Popular
                        </span>
                      )}

                      <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">{tier.name}</p>

                      {/* Flash sale countdown */}
                      {hasFlash && tier.flashSaleEndsAt && (
                        <div className="flex items-center gap-2 text-xs text-red-400 mb-3">
                          <span>⚡ Sale ends:</span>
                          <CountdownTimer endDate={tier.flashSaleEndsAt} variant="compact" />
                        </div>
                      )}

                      <div className="mb-6">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-4xl font-black ${hasFlash ? "text-red-400" : "text-white"}`}>
                            ${effectivePrice.toFixed(0)}
                          </span>
                          {(hasFlash || tier.discountPrice) && (
                            <span className="text-zinc-600 line-through text-lg">${Number(tier.price).toFixed(0)}</span>
                          )}
                        </div>
                        <p className="text-zinc-500 text-sm mt-1">{INTERVAL_LABELS[tier.interval] || "/month"}</p>
                        {tier.trialDays > 0 && <p className="text-xs text-emerald-400 mt-1">✓ {tier.trialDays}-day free trial</p>}
                      </div>

                      <ul className="space-y-2.5 mb-7">
                        {tf.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                            <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>{f}
                          </li>
                        ))}
                      </ul>

                      <Link href={`/checkout?tierId=${tier.id}&product=${product.slug}`}>
                        <button className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-105 ${tier.isPopular ? "btn-primary text-white" : "glass text-white hover:border-purple-500/50"}`}>
                          Get {tier.name} {tier.trialDays > 0 ? "— Start Free" : "→"}
                        </button>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* ENTERPRISE CTA */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 via-purple-900/10 to-blue-900/10" />
            <div className="relative z-10">
              <div className="text-5xl mb-5">🏢</div>
              <h2 className="text-4xl font-black mb-4">Need an enterprise plan?</h2>
              <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
                Custom pricing for large teams. Volume discounts, dedicated support, SLA guarantees, SSO, and compliance features.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link href="/contact">
                  <button className="btn-primary px-8 py-4 rounded-xl text-white font-bold">Contact Sales →</button>
                </Link>
                <Link href="/solutions/enterprise">
                  <button className="glass px-8 py-4 rounded-xl text-zinc-300 font-bold hover:border-purple-500/50 transition-all">View Enterprise Features</button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              { q: "Can I change my plan later?", a: "Yes, you can upgrade, downgrade, or cancel at any time. Changes take effect at the start of your next billing cycle." },
              { q: "Is there a free trial?", a: "Most products offer a 14-day free trial. No credit card is required to start your trial." },
              { q: "What payment methods do you accept?", a: "We accept all major credit cards via Stripe, and Razorpay for India-based payments. We also support UPI, net banking, and wallets." },
              { q: "What is your refund policy?", a: "We offer a 14-day money-back guarantee on all paid plans. No questions asked." },
              { q: "Do you offer discounts for yearly billing?", a: "Yes — switching to yearly billing saves you up to 40% compared to monthly billing." },
              { q: "Can I get a custom plan for my team?", a: "Absolutely. Contact our sales team for volume discounts, custom SLAs, and enterprise features." },
            ].map((faq, i) => (
              <details key={i} className="glass rounded-xl overflow-hidden group">
                <summary className="px-6 py-5 font-semibold text-white cursor-pointer list-none flex items-center justify-between hover:text-purple-300 transition-colors">
                  {faq.q}
                  <span className="text-zinc-600 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-6 pb-5 text-zinc-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
