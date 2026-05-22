"use client"

import { useState } from "react"
import Link from "next/link"
import CountdownTimer from "@/components/marketplace/CountdownTimer"
import ProductCard from "@/components/marketplace/ProductCard"

const TYPE_ICONS: Record<string, string> = {
  AI_AGENT: "🤖", SAAS: "⚡", API: "🔗", AUTOMATION: "⚙️",
  WEBSITE: "🌐", DIGITAL: "💾", AI_TOOL: "🧠", ENTERPRISE: "🏢",
  SERVICE: "🎯", ADDON: "🔌", CREDIT_PACK: "🪙", CUSTOM: "✨",
}

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "/month", YEARLY: "/year", ONE_TIME: "", LIFETIME: " lifetime",
  WEEKLY: "/week", PER_SEAT: "/seat", USAGE_BASED: " usage-based", TOKEN_BASED: "/1K tokens",
}

interface Tier {
  id: string; name: string; description?: string | null
  price: number; discountPrice?: number | null; flashSalePrice?: number | null
  flashSaleEndsAt?: string | null; currency: string; interval: string
  features: string[]; limits?: Record<string, any> | null; trialDays: number
  isPopular: boolean; isRecommended: boolean; isActive: boolean
  maxSeats?: number | null; usageUnit?: string | null; setupFee?: number | null
}

interface Review {
  id: string; rating: number; title: string; body: string
  verifiedPurchase: boolean; helpfulCount: number; createdAt: string
  user: { name?: string | null; avatarUrl?: string | null }
}

interface Product {
  id: string; slug: string; name: string; tagline: string; description: string
  longDescription?: string | null; type: string; category?: string | null; subcategory?: string | null
  thumbnailUrl?: string | null; iconUrl?: string | null; bannerUrl?: string | null
  screenshotUrls: string[]; videoUrls: string[]; demoUrl?: string | null; documentationUrl?: string | null
  features: any; techStack: string[]; tags: string[]; isPremium: boolean
  isFeatured: boolean; isTrending: boolean; isBestSeller: boolean; badgeText?: string | null
  averageRating: number; reviewCount: number; viewCount: number; activeUsers: number
  createdAt: string; updatedAt: string; tiers: Tier[]; reviews: Review[]
  versions: { id: string; version: number; createdAt: string }[]
  campaign?: { id: string; bannerText?: string | null; ctaText?: string | null; discountPercent: number; endsAt: string; flatDiscount?: number | null } | null
  related: { id: string; slug: string; name: string; tagline?: string | null; type: string; thumbnailUrl?: string | null; averageRating: number; startingPrice?: number | null; interval?: string | null }[]
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const [activeScreenshot, setActiveScreenshot] = useState(0)
  const [activeTab, setActiveTab] = useState<"overview" | "pricing" | "reviews" | "changelog">("overview")
  const [wishlisted, setWishlisted] = useState(false)

  const features: string[] = Array.isArray(product.features) ? product.features as string[] : []
  const cheapestTier = product.tiers[0]
  const hasFlash = !!(cheapestTier?.flashSalePrice && cheapestTier.flashSaleEndsAt && new Date(cheapestTier.flashSaleEndsAt) > new Date())
  const allScreenshots = [
    ...(product.thumbnailUrl ? [product.thumbnailUrl] : []),
    ...product.screenshotUrls,
  ].filter(Boolean)

  const displayPrice = (tier: Tier) => {
    const now = new Date()
    if (tier.flashSalePrice && tier.flashSaleEndsAt && new Date(tier.flashSaleEndsAt) > now) return tier.flashSalePrice
    if (tier.discountPrice) return tier.discountPrice
    return tier.price
  }

  const ratingDist = [5,4,3,2,1].map(r => ({
    r,
    count: product.reviews.filter(rv => rv.rating === r).length,
    pct: product.reviews.length > 0 ? (product.reviews.filter(rv => rv.rating === r).length / product.reviews.length) * 100 : 0,
  }))

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}
        .text-gradient{background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);transition:all .2s;border:1px solid rgba(139,92,246,.3)}
        .btn-primary:hover{transform:scale(1.03);box-shadow:0 0 24px rgba(139,92,246,.4)}
        .tab-item{padding:.625rem 1.25rem;font-size:.875rem;font-weight:600;color:rgba(255,255,255,.45);border-bottom:2px solid transparent;transition:all .2s;cursor:pointer;white-space:nowrap}
        .tab-item:hover{color:rgba(255,255,255,.8)}
        .tab-active{color:#fff!important;border-bottom-color:#8b5cf6!important}
        .thumb-btn{border-radius:.5rem;overflow:hidden;border:2px solid transparent;transition:all .2s;cursor:pointer;aspect-video}
        .thumb-active{border-color:#8b5cf6!important}
        .star{color:#f59e0b}
        .rating-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden}
        .rating-fill{height:100%;background:linear-gradient(90deg,#f59e0b,#fbbf24);border-radius:3px;transition:width .5s ease}
        .sticky-sidebar{position:sticky;top:80px;align-self:flex-start}
      `}</style>

      {/* ── BREADCRUMB ─────────────────────────────────────────────────────── */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-zinc-600">
          <Link href="/marketplace" className="hover:text-zinc-400 transition-colors">Marketplace</Link>
          {product.category && <>
            <span>/</span>
            <Link href={`/marketplace?category=${product.category}`} className="hover:text-zinc-400 transition-colors">{product.category}</Link>
          </>}
          <span>/</span>
          <span className="text-zinc-400 truncate max-w-[200px]">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* ── LEFT: MAIN CONTENT (2/3) ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-10">

            {/* Product hero */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="glass text-xs font-bold px-3 py-1.5 rounded-full text-purple-300">
                  {TYPE_ICONS[product.type] || "⚡"} {product.type.replace("_", " ")}
                </span>
                {product.isFeatured && <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/30">⭐ Featured</span>}
                {product.isTrending && <span className="bg-red-500/20 text-red-300 text-xs font-bold px-3 py-1.5 rounded-full border border-red-500/30">🔥 Trending</span>}
                {product.isBestSeller && <span className="bg-orange-500/20 text-orange-300 text-xs font-bold px-3 py-1.5 rounded-full border border-orange-500/30">🏆 Best Seller</span>}
                {product.isPremium && <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold px-3 py-1.5 rounded-full text-white">👑 Premium</span>}
                <span className="glass text-xs px-3 py-1.5 rounded-full text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Live
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">{product.name}</h1>
              <p className="text-zinc-400 text-xl mb-5">{product.tagline}</p>

              {/* Ratings + stats row */}
              <div className="flex flex-wrap items-center gap-6 text-sm">
                {product.averageRating > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => <span key={s} className={`text-base ${product.averageRating >= s ? "star" : "text-zinc-700"}`}>★</span>)}
                    </div>
                    <span className="font-bold">{product.averageRating.toFixed(1)}</span>
                    <span className="text-zinc-500">({product.reviewCount} reviews)</span>
                  </div>
                )}
                <span className="text-zinc-600">👁 {product.viewCount.toLocaleString()} views</span>
                <span className="text-zinc-600">👥 {product.activeUsers.toLocaleString()} users</span>
                {product.category && <span className="text-zinc-600">📂 {product.category}</span>}
              </div>
            </div>

            {/* Screenshot gallery */}
            {allScreenshots.length > 0 && (
              <div className="space-y-3">
                <div className="aspect-video glass rounded-2xl overflow-hidden">
                  <img
                    src={allScreenshots[activeScreenshot]}
                    alt={`${product.name} screenshot ${activeScreenshot + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                {allScreenshots.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {allScreenshots.map((src, idx) => (
                      <button key={idx} onClick={() => setActiveScreenshot(idx)}
                        className={`flex-shrink-0 w-20 h-14 thumb-btn bg-zinc-900 ${activeScreenshot === idx ? "thumb-active" : "border-white/10"}`}>
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div>
              <div className="flex border-b border-white/5 overflow-x-auto">
                {(["overview", "pricing", "reviews", "changelog"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`tab-item capitalize ${activeTab === tab ? "tab-active" : ""}`}>
                    {tab === "reviews" ? `Reviews (${product.reviewCount})` : tab === "pricing" ? `Pricing (${product.tiers.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Overview tab */}
              {activeTab === "overview" && (
                <div className="space-y-10 pt-8">
                  {/* Description */}
                  <div>
                    <h2 className="text-2xl font-black mb-4">About this product</h2>
                    <p className="text-zinc-400 text-base leading-relaxed">
                      {product.longDescription || product.description}
                    </p>
                  </div>

                  {/* Features */}
                  {features.length > 0 && (
                    <div>
                      <h2 className="text-2xl font-black mb-5">What&apos;s included</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {features.map((f: string, i: number) => (
                          <div key={i} className="flex items-center gap-3 glass rounded-xl p-4">
                            <span className="text-emerald-400 font-bold flex-shrink-0">✓</span>
                            <span className="text-zinc-300 text-sm">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tech Stack */}
                  {product.techStack.length > 0 && (
                    <div>
                      <h2 className="text-2xl font-black mb-5">Tech Stack</h2>
                      <div className="flex flex-wrap gap-2">
                        {product.techStack.map(t => (
                          <span key={t} className="glass px-4 py-2 rounded-xl text-sm text-zinc-300 font-medium">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {product.tags.length > 0 && (
                    <div>
                      <h2 className="text-xl font-black mb-4">Tags</h2>
                      <div className="flex flex-wrap gap-2">
                        {product.tags.map(t => (
                          <Link key={t} href={`/marketplace?q=${encodeURIComponent(t)}`}>
                            <span className="glass px-3 py-1.5 rounded-full text-xs text-zinc-500 hover:text-zinc-300 hover:border-purple-500/40 transition-all cursor-pointer">#{t}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/5 pt-8">
                    {[
                      { val: product.viewCount.toLocaleString(), label: "Total Views", icon: "👁" },
                      { val: product.reviewCount.toString(), label: "Reviews", icon: "⭐" },
                      { val: product.activeUsers.toLocaleString(), label: "Active Users", icon: "👥" },
                      { val: product.tiers.length.toString(), label: "Pricing Plans", icon: "💳" },
                    ].map(s => (
                      <div key={s.label} className="glass rounded-xl p-4 text-center">
                        <span className="text-xl block mb-1">{s.icon}</span>
                        <p className="text-xl font-black text-white">{s.val}</p>
                        <p className="text-xs text-zinc-600 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing tab */}
              {activeTab === "pricing" && (
                <div className="pt-8">
                  <p className="text-zinc-500 mb-8">
                    All plans include a {product.tiers[0]?.trialDays > 0 ? `${product.tiers[0].trialDays}-day free trial` : "14-day money-back guarantee"}.
                    No credit card required to start.
                  </p>
                  <div className={`grid gap-6 ${product.tiers.length === 1 ? "max-w-sm" : product.tiers.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                    {product.tiers.map(tier => {
                      const effectivePrice = displayPrice(tier)
                      const isFlash = !!(tier.flashSalePrice && tier.flashSaleEndsAt && new Date(tier.flashSaleEndsAt) > new Date())
                      return (
                        <div key={tier.id}
                          className={`relative rounded-2xl p-7 transition-all hover:-translate-y-1 ${tier.isPopular ? "bg-gradient-to-b from-purple-900/60 to-indigo-900/40 border border-purple-500/60 shadow-2xl shadow-purple-500/20" : "glass"}`}>
                          {tier.isPopular && (
                            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-indigo-500 text-xs font-bold px-5 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                              Most Popular
                            </span>
                          )}
                          {tier.isRecommended && !tier.isPopular && (
                            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold px-5 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                              Recommended
                            </span>
                          )}

                          <p className="font-bold text-sm text-zinc-500 uppercase tracking-wider mb-3">{tier.name}</p>
                          {tier.description && <p className="text-zinc-600 text-xs mb-4">{tier.description}</p>}

                          <div className="mb-6">
                            {isFlash && (
                              <div className="flex items-center gap-2 mb-1 text-red-400 text-xs font-medium">
                                <span>🔥 Flash Sale</span>
                                {tier.flashSaleEndsAt && <CountdownTimer endDate={tier.flashSaleEndsAt} variant="compact" />}
                              </div>
                            )}
                            <div className="flex items-baseline gap-2">
                              <span className={`text-4xl font-black ${isFlash ? "text-red-400" : "text-white"}`}>
                                ${effectivePrice.toFixed(0)}
                              </span>
                              {(isFlash || tier.discountPrice) && (
                                <span className="text-zinc-600 line-through text-lg">${tier.price.toFixed(0)}</span>
                              )}
                            </div>
                            <p className="text-zinc-500 text-sm mt-1">{INTERVAL_LABELS[tier.interval] || "/month"}</p>
                            {tier.trialDays > 0 && <p className="text-xs text-emerald-400 mt-1">✓ {tier.trialDays}-day free trial</p>}
                            {tier.setupFee && tier.setupFee > 0 && <p className="text-xs text-zinc-600 mt-1">+ ${tier.setupFee} setup fee</p>}
                            {tier.maxSeats && <p className="text-xs text-zinc-600 mt-1">Up to {tier.maxSeats} seats</p>}
                          </div>

                          {/* Limits */}
                          {tier.limits && (
                            <div className="mb-5 space-y-1.5">
                              {Object.entries(tier.limits).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-xs">
                                  <span className="text-zinc-600 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                                  <span className="text-zinc-300 font-medium">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <ul className="space-y-2.5 mb-7">
                            {tier.features.map((f, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>{f}
                              </li>
                            ))}
                          </ul>

                          <Link href={`/checkout?tierId=${tier.id}&product=${product.slug}`}>
                            <button className={`w-full py-3.5 rounded-xl font-bold transition-all hover:scale-105 text-sm ${tier.isPopular ? "btn-primary text-white" : "glass text-white hover:border-purple-500/50"}`}>
                              Get {tier.name} {tier.trialDays > 0 ? "— Free Trial" : "→"}
                            </button>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Reviews tab */}
              {activeTab === "reviews" && (
                <div className="pt-8 space-y-8">
                  {/* Rating distribution */}
                  {product.reviewCount > 0 && (
                    <div className="glass rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="text-center">
                        <div className="text-6xl font-black text-white mb-2">{product.averageRating.toFixed(1)}</div>
                        <div className="flex justify-center gap-1 mb-2">
                          {[1,2,3,4,5].map(s => <span key={s} className={`text-xl ${product.averageRating >= s ? "star" : "text-zinc-700"}`}>★</span>)}
                        </div>
                        <p className="text-zinc-600 text-sm">{product.reviewCount} reviews</p>
                      </div>
                      <div className="space-y-2">
                        {ratingDist.map(({ r, count, pct }) => (
                          <div key={r} className="flex items-center gap-3 text-sm">
                            <span className="text-zinc-500 w-4 flex-shrink-0">{r}</span>
                            <span className="star text-xs">★</span>
                            <div className="flex-1 rating-bar">
                              <div className="rating-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-zinc-600 w-5 text-right flex-shrink-0">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {product.reviews.length > 0 ? (
                    <div className="space-y-4">
                      {product.reviews.map(review => (
                        <div key={review.id} className="glass rounded-2xl p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                              {review.user.avatarUrl ? (
                                <img src={review.user.avatarUrl} alt={review.user.name || ""} className="w-full h-full object-cover" />
                              ) : (
                                (review.user.name || "?").charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1 flex-wrap">
                                <span className="font-semibold text-sm">{review.user.name || "Anonymous"}</span>
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(s => <span key={s} className={`text-xs ${review.rating >= s ? "star" : "text-zinc-700"}`}>★</span>)}
                                </div>
                                {review.verifiedPurchase && (
                                  <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">✓ Verified</span>
                                )}
                              </div>
                              {review.title && <p className="font-medium text-sm mb-2">{review.title}</p>}
                              <p className="text-sm text-zinc-400 leading-relaxed">{review.body}</p>
                              <div className="flex items-center gap-4 mt-3">
                                <p className="text-xs text-zinc-700">{new Date(review.createdAt).toLocaleDateString()}</p>
                                {review.helpfulCount > 0 && (
                                  <span className="text-xs text-zinc-600">👍 {review.helpfulCount} found helpful</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-zinc-600">
                      <div className="text-4xl mb-3">⭐</div>
                      <p>No reviews yet. Be the first to review this product.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Changelog tab */}
              {activeTab === "changelog" && (
                <div className="pt-8 space-y-4">
                  {product.versions.length > 0 ? (
                    product.versions.map(v => (
                      <div key={v.id} className="glass rounded-xl p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-purple-400 flex-shrink-0">
                          v{v.version}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">Version {v.version}</p>
                          <p className="text-xs text-zinc-600">{new Date(v.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-zinc-600">
                      <div className="text-4xl mb-3">📋</div>
                      <p>Changelog coming soon.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Related products */}
            {product.related.length > 0 && (
              <div className="border-t border-white/5 pt-10">
                <h2 className="text-2xl font-black mb-6">You might also like</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {product.related.map(r => (
                    <ProductCard key={r.id}
                      id={r.id} slug={r.slug} name={r.name} tagline={r.tagline || undefined}
                      type={r.type} thumbnailUrl={r.thumbnailUrl} averageRating={r.averageRating}
                      startingPrice={r.startingPrice || undefined} interval={r.interval || undefined}
                      variant="compact"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: STICKY SIDEBAR (1/3) ─────────────────────────────────── */}
          <div className="sticky-sidebar space-y-4">

            {/* Campaign offer */}
            {product.campaign && new Date(product.campaign.endsAt) > new Date() && (
              <div className="glass rounded-2xl p-5 border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-orange-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Limited Offer</span>
                </div>
                <p className="text-sm text-zinc-300 mb-3">{product.campaign.bannerText}</p>
                {product.campaign.discountPercent > 0 && (
                  <p className="text-2xl font-black text-amber-400 mb-2">{product.campaign.discountPercent}% OFF</p>
                )}
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>Ends in:</span>
                  <CountdownTimer endDate={product.campaign.endsAt} variant="compact" className="text-amber-400" />
                </div>
              </div>
            )}

            {/* Flash sale */}
            {hasFlash && cheapestTier.flashSaleEndsAt && (
              <div className="glass rounded-2xl p-5 border border-red-500/30 bg-gradient-to-br from-red-950/30 to-orange-950/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-red-400 text-xs font-bold uppercase tracking-wider">⚡ Flash Sale</span>
                </div>
                <CountdownTimer endDate={cheapestTier.flashSaleEndsAt} variant="default" />
              </div>
            )}

            {/* Main pricing card */}
            {cheapestTier && (
              <div className="glass rounded-2xl p-6 space-y-5">
                {/* Price display */}
                <div>
                  <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Starting from</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-black ${hasFlash ? "text-red-400" : "text-white"}`}>
                      ${displayPrice(cheapestTier).toFixed(0)}
                    </span>
                    {(hasFlash || cheapestTier.discountPrice) && (
                      <span className="text-zinc-600 line-through text-lg">${cheapestTier.price.toFixed(0)}</span>
                    )}
                    <span className="text-zinc-500 text-sm">{INTERVAL_LABELS[cheapestTier.interval]}</span>
                  </div>
                  {cheapestTier.trialDays > 0 && (
                    <p className="text-xs text-emerald-400 mt-1">✓ {cheapestTier.trialDays}-day free trial included</p>
                  )}
                </div>

                {/* CTA Buttons */}
                <div className="space-y-2.5">
                  <Link href={`/checkout?tierId=${cheapestTier.id}&product=${product.slug}`}>
                    <button className="btn-primary w-full py-4 rounded-xl text-white font-bold text-base">
                      {cheapestTier.trialDays > 0 ? `Start ${cheapestTier.trialDays}-day Free Trial` : "Get Started →"}
                    </button>
                  </Link>
                  {product.demoUrl && (
                    <Link href={`/demo?product=${product.slug}`}>
                      <button className="w-full glass py-3.5 rounded-xl text-zinc-300 font-semibold text-sm hover:border-purple-500/50 transition-all">
                        ▶ Try Live Demo
                      </button>
                    </Link>
                  )}
                </div>

                {/* Wishlist + Share */}
                <div className="flex gap-2">
                  <button onClick={() => setWishlisted(w => !w)}
                    className={`flex-1 glass py-2.5 rounded-xl text-sm font-medium transition-all ${wishlisted ? "text-red-400 border-red-500/40" : "text-zinc-500 hover:text-white"}`}>
                    {wishlisted ? "❤️ Saved" : "♡ Wishlist"}
                  </button>
                  <button onClick={() => navigator.share ? navigator.share({ title: product.name, url: window.location.href }) : navigator.clipboard.writeText(window.location.href)}
                    className="flex-1 glass py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-white transition-all">
                    ↗ Share
                  </button>
                </div>

                {/* Trust signals */}
                <div className="border-t border-white/5 pt-4 space-y-2">
                  {["14-day money-back guarantee", "Cancel anytime, no lock-in", "Secure checkout via Stripe", "Instant access after purchase"].map(s => (
                    <div key={s} className="flex items-center gap-2 text-xs text-zinc-600">
                      <span className="text-emerald-400">✓</span>{s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tech stack mini */}
            {product.techStack.length > 0 && (
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Built With</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.techStack.map(t => (
                    <span key={t} className="glass text-xs px-2.5 py-1 rounded-full text-zinc-400">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Support info */}
            <div className="glass rounded-xl p-4 space-y-2.5">
              <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Support</p>
              {[
                { icon: "⚡", text: "< 2hr response time" },
                { icon: "📖", text: product.documentationUrl ? "Full documentation" : "Docs included" },
                { icon: "💬", text: "Community Discord" },
                { icon: "🔄", text: "Free updates" },
              ].map(s => (
                <div key={s.text} className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{s.icon}</span>{s.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
