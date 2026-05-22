"use client"

import Link from "next/link"
import CountdownTimer from "./CountdownTimer"
import { cn } from "@/lib/utils"

export interface ProductCardProps {
  id: string
  slug: string
  name: string
  tagline?: string | null
  description?: string | null
  type: string
  category?: string | null
  thumbnailUrl?: string | null
  iconUrl?: string | null
  isPremium?: boolean
  isFeatured?: boolean
  isTrending?: boolean
  isBestSeller?: boolean
  badgeText?: string | null
  averageRating?: number
  reviewCount?: number
  viewCount?: number
  activeUsers?: number
  startingPrice?: number
  discountPrice?: number | null
  flashSalePrice?: number | null
  flashSaleEndsAt?: Date | string | null
  currency?: string
  interval?: string
  demoUrl?: string | null
  tags?: string[]
  variant?: "grid" | "featured" | "spotlight" | "compact"
}

const TYPE_ICONS: Record<string, string> = {
  AI_AGENT: "🤖", SAAS: "⚡", API: "🔗", AUTOMATION: "⚙️",
  WEBSITE: "🌐", DIGITAL: "💾", ADDON: "🔌", CREDIT_PACK: "🪙",
  ENTERPRISE: "🏢", SERVICE: "🎯", AI_TOOL: "🧠", CUSTOM: "✨",
}

const TYPE_LABELS: Record<string, string> = {
  AI_AGENT: "AI Agent", SAAS: "SaaS", API: "API", AUTOMATION: "Automation",
  WEBSITE: "Website", DIGITAL: "Digital", ADDON: "Addon", CREDIT_PACK: "Credits",
  ENTERPRISE: "Enterprise", SERVICE: "Service", AI_TOOL: "AI Tool", CUSTOM: "Custom",
}

function PriceDisplay({ price, discount, flash, flashEnd, currency = "USD", interval }: {
  price?: number; discount?: number | null; flash?: number | null
  flashEnd?: Date | string | null; currency?: string; interval?: string
}) {
  const intervalLabel = interval === "MONTHLY" ? "/mo" : interval === "YEARLY" ? "/yr"
    : interval === "LIFETIME" ? " lifetime" : interval === "ONE_TIME" ? "" : "/mo"

  if (flash && flash > 0 && flashEnd && new Date(flashEnd) > new Date()) {
    return (
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className="text-red-400 font-bold text-sm">
            ${flash.toFixed(0)}{intervalLabel}
          </span>
          {price && <span className="text-zinc-600 text-xs line-through">${price.toFixed(0)}</span>}
        </div>
      </div>
    )
  }
  if (!price) return <span className="text-xs text-zinc-500">Free</span>
  if (discount && discount < price) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-emerald-400 font-bold text-sm">${discount.toFixed(0)}{intervalLabel}</span>
        <span className="text-zinc-600 text-xs line-through">${price.toFixed(0)}</span>
      </div>
    )
  }
  return <span className="font-bold text-sm text-white">${price.toFixed(0)}{intervalLabel}</span>
}

function Stars({ rating, count }: { rating?: number; count?: number }) {
  const r = rating || 0
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <span key={s} className={`text-xs ${r >= s ? "text-amber-400" : "text-zinc-700"}`}>★</span>
        ))}
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] text-zinc-600">({count})</span>
      )}
    </div>
  )
}

// ── GRID VARIANT (default) ───────────────────────────────────────────────────
function GridCard(p: ProductCardProps) {
  const isNewProduct = false // caller can pass createdAt if needed
  const hasFlash = !!(p.flashSalePrice && p.flashSaleEndsAt && new Date(p.flashSaleEndsAt) > new Date())

  return (
    <article className="group relative glass rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10 cursor-pointer">
      <Link href={`/marketplace/${p.slug}`} className="absolute inset-0 z-10" aria-label={`View ${p.name}`} />
        {/* Thumbnail */}
        <div className="aspect-video relative overflow-hidden bg-zinc-900">
          {p.thumbnailUrl ? (
            <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center">
              <span className="text-5xl">{TYPE_ICONS[p.type] || "⚡"}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            <span className="bg-black/70 backdrop-blur-sm text-[10px] font-bold px-2 py-0.5 rounded-full text-purple-300 border border-white/10">
              {TYPE_ICONS[p.type]} {TYPE_LABELS[p.type] || p.type}
            </span>
            {p.isFeatured && <span className="bg-amber-500/90 text-[10px] font-bold px-2 py-0.5 rounded-full text-white">⭐ Featured</span>}
            {p.isTrending && <span className="bg-red-500/90 text-[10px] font-bold px-2 py-0.5 rounded-full text-white">🔥 Trending</span>}
            {p.isBestSeller && <span className="bg-orange-500/90 text-[10px] font-bold px-2 py-0.5 rounded-full text-white">🏆 Best Seller</span>}
            {p.badgeText && <span className="bg-purple-500/90 text-[10px] font-bold px-2 py-0.5 rounded-full text-white">{p.badgeText}</span>}
            {p.isPremium && <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold px-2 py-0.5 rounded-full text-white">👑 PRO</span>}
          </div>

          {/* Price badge */}
          <div className="absolute bottom-2.5 right-2.5">
            <span className={cn("backdrop-blur text-[10px] font-bold px-2 py-1 rounded-full", hasFlash ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white")}>
              <PriceDisplay
                price={p.startingPrice}
                discount={p.discountPrice}
                flash={p.flashSalePrice}
                flashEnd={p.flashSaleEndsAt}
                currency={p.currency}
                interval={p.interval}
              />
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-bold text-white text-sm mb-1 group-hover:text-purple-300 transition-colors line-clamp-1">{p.name}</h3>
          <p className="text-zinc-500 text-xs mb-3 line-clamp-2">{p.tagline}</p>

          {/* Flash countdown */}
          {hasFlash && p.flashSaleEndsAt && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-red-400">
              <span>⏰</span>
              <CountdownTimer endDate={p.flashSaleEndsAt} variant="compact" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Stars rating={p.averageRating} count={p.reviewCount} />
            {p.activeUsers !== undefined && p.activeUsers > 0 && (
              <span className="text-[10px] text-zinc-600">{p.activeUsers.toLocaleString()} users</span>
            )}
          </div>
        </div>

        {/* Hover actions */}
        <div className="absolute inset-x-0 bottom-0 z-20 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-8 flex gap-2">
          <Link href={`/marketplace/${p.slug}`} className="flex-1 w-full py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all text-center">
            Buy Now
          </Link>
          {p.demoUrl && (
            <Link href={`/demo?product=${p.slug}`} className="px-3 py-2 rounded-xl text-xs font-bold glass text-zinc-300 hover:text-white transition-all">
              Demo
            </Link>
          )}
        </div>
      </article>
  )
}

// ── FEATURED VARIANT ─────────────────────────────────────────────────────────
function FeaturedCard(p: ProductCardProps) {
  const hasFlash = !!(p.flashSalePrice && p.flashSaleEndsAt && new Date(p.flashSaleEndsAt) > new Date())

  return (
    <article className="group relative glass rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20 cursor-pointer">
      <Link href={`/marketplace/${p.slug}`} className="absolute inset-0 z-10" aria-label={`View ${p.name}`} />
        <div className="aspect-[4/3] relative overflow-hidden bg-zinc-900">
          {p.thumbnailUrl ? (
            <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex items-center justify-center">
              <span className="text-7xl">{TYPE_ICONS[p.type] || "⚡"}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute top-3 left-3 flex gap-1.5">
            {p.isFeatured && <span className="bg-amber-500 text-[10px] font-bold px-2.5 py-1 rounded-full text-white shadow-lg">⭐ Featured</span>}
            {p.isTrending && <span className="bg-red-500 text-[10px] font-bold px-2.5 py-1 rounded-full text-white shadow-lg">🔥 Trending</span>}
          </div>

          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="font-black text-white text-xl mb-1 group-hover:text-purple-300 transition-colors">{p.name}</h3>
            <p className="text-zinc-400 text-xs line-clamp-2">{p.tagline}</p>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Stars rating={p.averageRating} count={p.reviewCount} />
            <PriceDisplay price={p.startingPrice} discount={p.discountPrice} flash={p.flashSalePrice} flashEnd={p.flashSaleEndsAt} currency={p.currency} interval={p.interval} />
          </div>
          {hasFlash && p.flashSaleEndsAt && (
            <div className="flex items-center gap-2 mb-3 text-xs text-red-400 font-medium">
              <span>⏰ Flash sale ends in</span>
              <CountdownTimer endDate={p.flashSaleEndsAt} variant="compact" />
            </div>
          )}
          <div className="flex gap-2">
            <Link href={`/marketplace/${p.slug}`} className="relative z-20 flex-1 w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all shadow-lg shadow-purple-500/20 text-center">
              Get Started
            </Link>
            {p.demoUrl && (
              <Link href={`/demo?product=${p.slug}`} className="relative z-20 px-4 py-2.5 rounded-xl text-sm font-bold glass text-zinc-300 hover:text-white hover:border-purple-500/50 transition-all">
                ▶
              </Link>
            )}
          </div>
        </div>
    </article>
  )
}

// ── SPOTLIGHT VARIANT ────────────────────────────────────────────────────────
function SpotlightCard(p: ProductCardProps) {
  const hasFlash = !!(p.flashSalePrice && p.flashSaleEndsAt && new Date(p.flashSaleEndsAt) > new Date())

  return (
    <article className="group relative glass rounded-2xl overflow-hidden transition-all duration-300 hover:border-purple-500/40 cursor-pointer grid grid-cols-1 md:grid-cols-2 gap-0">
      <Link href={`/marketplace/${p.slug}`} className="absolute inset-0 z-10" aria-label={`View ${p.name}`} />
        <div className="aspect-video md:aspect-auto relative overflow-hidden bg-zinc-900">
          {p.thumbnailUrl ? (
            <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex items-center justify-center min-h-[200px]">
              <span className="text-8xl">{TYPE_ICONS[p.type] || "⚡"}</span>
            </div>
          )}
        </div>
        <div className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-purple-500/30">
                {TYPE_ICONS[p.type]} {TYPE_LABELS[p.type]}
              </span>
              {p.isFeatured && <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-500/30">⭐ Featured</span>}
            </div>
            <h3 className="font-black text-white text-2xl mb-2 group-hover:text-purple-300 transition-colors">{p.name}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4 line-clamp-3">{p.tagline}</p>
            {p.tags && p.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {p.tags.slice(0, 4).map(t => <span key={t} className="glass text-[10px] px-2 py-0.5 rounded-full text-zinc-500">{t}</span>)}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <Stars rating={p.averageRating} count={p.reviewCount} />
              <PriceDisplay price={p.startingPrice} discount={p.discountPrice} flash={p.flashSalePrice} flashEnd={p.flashSaleEndsAt} currency={p.currency} interval={p.interval} />
            </div>
            {hasFlash && p.flashSaleEndsAt && (
              <div className="flex items-center gap-2 mb-3 text-xs text-red-400">
                <span>🔥 Sale ends in</span>
                <CountdownTimer endDate={p.flashSaleEndsAt} variant="compact" />
              </div>
            )}
            <div className="flex gap-2">
              <Link href={`/marketplace/${p.slug}`} className="relative z-20 flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all text-center">
                View Product
              </Link>
              {p.demoUrl && (
                <Link href={`/demo?product=${p.slug}`} className="relative z-20 px-4 py-2.5 rounded-xl text-sm glass text-zinc-300 hover:border-purple-500/50 transition-all">
                  ▶ Demo
                </Link>
              )}
            </div>
          </div>
        </div>
    </article>
  )
}

// ── COMPACT VARIANT ──────────────────────────────────────────────────────────
function CompactCard(p: ProductCardProps) {
  return (
    <Link href={`/marketplace/${p.slug}`}>
      <article className="group flex items-center gap-3 glass rounded-xl p-3 transition-all hover:border-purple-500/40 cursor-pointer">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 overflow-hidden flex-shrink-0">
          {p.thumbnailUrl ? (
            <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center text-xl">
              {TYPE_ICONS[p.type] || "⚡"}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white line-clamp-1 group-hover:text-purple-300 transition-colors">{p.name}</p>
          <p className="text-zinc-600 text-xs line-clamp-1">{p.tagline}</p>
          <Stars rating={p.averageRating} count={p.reviewCount} />
        </div>
        <div className="flex-shrink-0 text-right">
          <PriceDisplay price={p.startingPrice} discount={p.discountPrice} flash={p.flashSalePrice} flashEnd={p.flashSaleEndsAt} currency={p.currency} interval={p.interval} />
        </div>
      </article>
    </Link>
  )
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function ProductCard(props: ProductCardProps) {
  const { variant = "grid" } = props
  if (variant === "featured") return <FeaturedCard {...props} />
  if (variant === "spotlight") return <SpotlightCard {...props} />
  if (variant === "compact") return <CompactCard {...props} />
  return <GridCard {...props} />
}
