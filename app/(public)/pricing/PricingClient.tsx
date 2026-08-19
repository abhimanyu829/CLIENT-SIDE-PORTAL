"use client"

import { useState } from "react"
import Link from "next/link"
import CountdownTimer from "@/components/marketplace/CountdownTimer"
import { Search, Sparkles, Layers, ArrowRight, Check, ShieldCheck, HelpCircle, Building2, Grid, ListFilter } from "lucide-react"

interface Tier {
  id: string
  name: string
  price: any
  discountPrice: any | null
  flashSalePrice: any | null
  flashSaleEndsAt: Date | string | null
  interval: string
  trialDays: number
  isPopular: boolean
  features: any
}

interface Product {
  id: string
  name: string
  slug: string
  tagline: string | null
  thumbnailUrl: string | null
  tiers: Tier[]
}

interface Props {
  products: Product[]
}

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "/month",
  YEARLY: "/year",
  ONE_TIME: " one-time",
  LIFETIME: " lifetime",
  WEEKLY: "/week",
  PER_SEAT: "/seat",
  USAGE_BASED: " usage",
  TOKEN_BASED: "/1K tokens",
}

export default function PricingClient({ products }: Props) {
  const validProducts = products.filter(p => p.tiers.length > 0)
  const [selectedProductId, setSelectedProductId] = useState<string>(validProducts[0]?.id || "")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"side-by-side" | "grid">("side-by-side")

  const now = new Date()

  const filteredProducts = validProducts.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.tagline && p.tagline.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const activeProduct = filteredProducts.find(p => p.id === selectedProductId) || filteredProducts[0] || validProducts[0]

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-violet-500/20">
      <style>{`
        .glass { background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
        .glass-card { background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04); }
        .glass-active { background: #f5f3ff; border: 1px solid #8b5cf6 !important; box-shadow: 0 4px 16px rgba(139, 92, 246, 0.12); }
        .text-gradient { background: linear-gradient(135deg, #7c3aed, #4f46e5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .btn-primary { background: linear-gradient(135deg, #7c3aed, #6366f1); transition: all 0.2s; border: 1px solid rgba(124, 58, 237, 0.3); }
        .btn-primary:hover { transform: scale(1.02); box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3); }
        .popular-card { background: #faf5ff; border-color: #c084fc !important; }
        .section-label { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; background: linear-gradient(90deg, #7c3aed, #4f46e5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
        @keyframes float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
        .float { animation: float 8s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f3f4f6; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      `}</style>

      {/* HERO */}
      <section className="relative py-20 px-4 overflow-hidden border-b border-gray-100 text-center bg-gray-50/50">
        <div className="absolute top-12 left-1/3 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl float pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10">
          <p className="section-label mb-4">Pricing & Plans</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6 text-violet-600">
            Simple, transparent pricing
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Start free, scale when you grow. No hidden fees. Cancel anytime. Every plan includes our 14-day money-back guarantee.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {["No credit card required", "Free plan available", "14-day money back", "Cancel anytime"].map(b => (
              <span key={b} className="bg-white border border-gray-200 px-4 py-1.5 rounded-full text-xs font-medium text-gray-600 shadow-xs flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CONTROLS BAR */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl mb-8 border border-gray-200 shadow-sm">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <span className="text-xs font-semibold text-gray-500 hidden sm:inline">Layout View:</span>
            <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
              <button
                onClick={() => setViewMode("side-by-side")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "side-by-side"
                    ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/70"
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" /> Side-by-Side View
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "grid"
                    ? "bg-violet-600 text-white shadow-sm shadow-violet-600/30"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/70"
                }`}
              >
                <Grid className="w-3.5 h-3.5" /> All Products Grid
              </button>
            </div>
          </div>
        </div>

        {/* SIDE-BY-SIDE TABS VIEW */}
        {viewMode === "side-by-side" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-24">
            {/* LEFT COLUMN: SIDEBAR PRODUCT NAVIGATION */}
            <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-600" /> Select Product ({filteredProducts.length})
                </span>
              </div>

              {/* Horizontal Scroll on Mobile, Vertical List on Desktop */}
              <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 custom-scrollbar">
                {filteredProducts.map(product => {
                  const isSelected = activeProduct?.id === product.id
                  const lowestPrice = Math.min(...product.tiers.map(t => Number(t.discountPrice || t.price)))
                  
                  return (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProductId(product.id)}
                      className={`text-left p-4 rounded-2xl transition-all min-w-[260px] lg:min-w-0 flex items-start gap-3.5 cursor-pointer ${
                        isSelected ? "glass-active" : "glass hover:bg-gray-50"
                      }`}
                    >
                      {product.thumbnailUrl ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200 mt-0.5">
                          <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 flex-shrink-0 mt-0.5">
                          <Sparkles className="w-5 h-5" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-bold text-sm text-gray-900 truncate">{product.name}</h3>
                          <span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full shrink-0">
                            From ${lowestPrice.toFixed(0)}
                          </span>
                        </div>
                        {product.tagline && (
                          <p className="text-xs text-gray-500 line-clamp-1 mb-2">{product.tagline}</p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span>{product.tiers.length} {product.tiers.length === 1 ? "Tier" : "Tiers"}</span>
                          <span>•</span>
                          <span className="text-violet-600 font-medium hover:underline flex items-center gap-0.5">
                            View Tiers <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <div className="p-8 text-center glass rounded-2xl text-gray-500 text-sm">
                    No products matching "{searchQuery}"
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: ACTIVE PRODUCT & TIERS SIDE-BY-SIDE GRID */}
            <div className="lg:col-span-8">
              {activeProduct ? (
                <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-8 border border-gray-200">
                  {/* Product Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      {activeProduct.thumbnailUrl && (
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                          <img src={activeProduct.thumbnailUrl} alt={activeProduct.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-black text-gray-900">{activeProduct.name}</h2>
                          <span className="bg-violet-50 border border-violet-200 text-violet-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            Available Now
                          </span>
                        </div>
                        {activeProduct.tagline && (
                          <p className="text-gray-500 text-sm mt-1">{activeProduct.tagline}</p>
                        )}
                      </div>
                    </div>
                    <Link href={`/marketplace/${activeProduct.slug}`}>
                      <button className="glass px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:border-violet-400 hover:bg-gray-50 transition-all flex items-center gap-1.5 shrink-0">
                        View Product <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                  </div>

                  {/* Side-by-Side Tiers Cards Grid */}
                  <div className={`grid gap-6 ${
                    activeProduct.tiers.length === 1
                      ? "max-w-md mx-auto"
                      : activeProduct.tiers.length === 2
                      ? "grid-cols-1 md:grid-cols-2"
                      : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                  }`}>
                    {activeProduct.tiers.map(tier => {
                      const hasFlash = !!(tier.flashSalePrice && tier.flashSaleEndsAt && new Date(tier.flashSaleEndsAt) > now)
                      const effectivePrice = hasFlash ? Number(tier.flashSalePrice) : tier.discountPrice ? Number(tier.discountPrice) : Number(tier.price)
                      const tf: string[] = Array.isArray(tier.features) ? tier.features as string[] : []

                      return (
                        <div
                          key={tier.id}
                          className={`relative glass rounded-2xl p-6 flex flex-col justify-between card-hover ${
                            tier.isPopular ? "popular-card" : ""
                          }`}
                        >
                          {tier.isPopular && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-extrabold px-4 py-1 rounded-full shadow-md whitespace-nowrap tracking-wider uppercase">
                              Most Popular
                            </span>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{tier.name}</p>
                              {tier.trialDays > 0 && (
                                <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                  {tier.trialDays}d Trial
                                </span>
                              )}
                            </div>

                            {/* Flash sale countdown */}
                            {hasFlash && tier.flashSaleEndsAt && (
                              <div className="flex items-center gap-2 text-xs text-red-600 mb-3 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl font-medium">
                                <span>⚡ Ends:</span>
                                <CountdownTimer endDate={tier.flashSaleEndsAt} variant="compact" />
                              </div>
                            )}

                            <div className="mb-6">
                              <div className="flex items-baseline gap-2">
                                <span className={`text-3xl sm:text-4xl font-black ${hasFlash ? "text-red-600" : "text-gray-900"}`}>
                                  ${effectivePrice.toFixed(0)}
                                </span>
                                {(hasFlash || tier.discountPrice) && (
                                  <span className="text-gray-400 line-through text-base sm:text-lg">
                                    ${Number(tier.price).toFixed(0)}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-500 text-xs mt-1">
                                {INTERVAL_LABELS[tier.interval] || "/month"}
                              </p>
                            </div>

                            <ul className="space-y-2.5 mb-6 border-t border-gray-100 pt-4">
                              {tf.map((f, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-700">
                                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <Link href={`/checkout?tierId=${tier.id}&product=${activeProduct.slug}`}>
                            <button
                              className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                                tier.isPopular
                                  ? "btn-primary text-white"
                                  : "bg-white border border-gray-200 text-gray-900 hover:border-violet-400 hover:bg-gray-50"
                              }`}
                            >
                              <span>Get {tier.name} {tier.trialDays > 0 ? "— Free Trial" : ""}</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center glass rounded-3xl text-gray-500">
                  Select a product to view pricing details.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* MULTI-PRODUCT GRID VIEW (Side-by-Side Horizontal Product Cards) */
          <div className="space-y-12 mb-24">
            {filteredProducts.map(product => (
              <div key={product.id} className="glass-card rounded-3xl p-6 sm:p-8 space-y-6 border border-gray-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    {product.thumbnailUrl && (
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                        <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-gray-900">{product.name}</h2>
                      {product.tagline && <p className="text-gray-500 text-xs sm:text-sm">{product.tagline}</p>}
                    </div>
                  </div>
                  <Link href={`/marketplace/${product.slug}`}>
                    <button className="glass px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:border-violet-400 hover:bg-gray-50 transition-all flex items-center gap-1.5 shrink-0">
                      View Product <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                </div>

                <div className={`grid gap-6 ${
                  product.tiers.length === 1
                    ? "max-w-md"
                    : product.tiers.length === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                }`}>
                  {product.tiers.map(tier => {
                    const hasFlash = !!(tier.flashSalePrice && tier.flashSaleEndsAt && new Date(tier.flashSaleEndsAt) > now)
                    const effectivePrice = hasFlash ? Number(tier.flashSalePrice) : tier.discountPrice ? Number(tier.discountPrice) : Number(tier.price)
                    const tf: string[] = Array.isArray(tier.features) ? tier.features as string[] : []

                    return (
                      <div
                        key={tier.id}
                        className={`relative glass rounded-2xl p-6 flex flex-col justify-between card-hover ${
                          tier.isPopular ? "popular-card" : ""
                        }`}
                      >
                        {tier.isPopular && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-extrabold px-4 py-1 rounded-full shadow-md whitespace-nowrap uppercase tracking-wider">
                            Most Popular
                          </span>
                        )}

                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{tier.name}</p>

                          {hasFlash && tier.flashSaleEndsAt && (
                            <div className="flex items-center gap-2 text-xs text-red-600 mb-3 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl font-medium">
                              <span>⚡ Sale ends:</span>
                              <CountdownTimer endDate={tier.flashSaleEndsAt} variant="compact" />
                            </div>
                          )}

                          <div className="mb-6">
                            <div className="flex items-baseline gap-2">
                              <span className={`text-3xl font-black ${hasFlash ? "text-red-600" : "text-gray-900"}`}>
                                ₹{effectivePrice.toFixed(0)}
                              </span>
                              {(hasFlash || tier.discountPrice) && (
                                <span className="text-gray-400 line-through text-base">₹{Number(tier.price).toFixed(0)}</span>
                              )}
                            </div>
                            <p className="text-gray-500 text-xs mt-1">{INTERVAL_LABELS[tier.interval] || "/month"}</p>
                            {tier.trialDays > 0 && <p className="text-xs text-emerald-600 font-medium mt-1">✓ {tier.trialDays}-day free trial</p>}
                          </div>

                          <ul className="space-y-2 mb-6 border-t border-gray-100 pt-4">
                            {tf.map((f, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Link href={`/checkout?tierId=${tier.id}&product=${product.slug}`}>
                          <button className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                            tier.isPopular ? "btn-primary text-white" : "bg-white border border-gray-200 text-gray-900 hover:border-violet-400 hover:bg-gray-50"
                          }`}>
                            <span>Get {tier.name} {tier.trialDays > 0 ? "— Free Trial" : ""}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ENTERPRISE CTA */}
      <section className="py-20 px-4 border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden border border-gray-200 shadow-sm">
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 mx-auto mb-5">
                <Building2 className="w-7 h-7" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4 text-gray-900">Need an enterprise plan?</h2>
              <p className="text-gray-600 mb-8 max-w-xl mx-auto leading-relaxed text-sm sm:text-base">
                Custom pricing for large teams. Volume discounts, dedicated support, SLA guarantees, SSO, and compliance features.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link href="/contact">
                  <button className="btn-primary px-8 py-3.5 rounded-xl text-white font-bold text-sm flex items-center gap-2">
                    Contact Sales <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link href="/solutions/enterprise">
                  <button className="bg-white border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-bold text-sm hover:border-violet-400 hover:bg-gray-50 transition-all">
                    View Enterprise Features
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 text-violet-600 mb-3">
            <HelpCircle className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">FAQ</span>
          </div>
          <h2 className="text-3xl font-black text-center mb-12 text-gray-900">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              { q: "Can I change my plan later?", a: "Yes, you can upgrade, downgrade, or cancel at any time. Changes take effect at the start of your next billing cycle." },
              { q: "Is there a free trial?", a: "Most products offer a 14-day free trial. No credit card is required to start your trial." },
              { q: "What payment methods do you accept?", a: "We accept all major credit cards via Stripe, and Razorpay for India-based payments. We also support UPI, net banking, and wallets." },
              { q: "What is your refund policy?", a: "We offer a 14-day money-back guarantee on all paid plans. No questions asked." },
              { q: "Do you offer discounts for yearly billing?", a: "Yes — switching to yearly billing saves you up to 40% compared to monthly billing." },
              { q: "Can I get a custom plan for my team?", a: "Absolutely. Contact our sales team for volume discounts, custom SLAs, and enterprise features." },
            ].map((faq, i) => (
              <details key={i} className="bg-white rounded-2xl overflow-hidden group border border-gray-200 shadow-xs">
                <summary className="px-6 py-5 font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between hover:text-violet-600 transition-colors text-sm sm:text-base">
                  {faq.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
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
