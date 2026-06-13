"use client"

import { useState, useMemo, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ProductCard, { type ProductCardProps } from "@/components/marketplace/ProductCard"
import CountdownTimer from "@/components/marketplace/CountdownTimer"
import { useCart } from "@/providers/CartProvider"

const TYPES = [
  { label: "All", value: "ALL" },
  { label: "🤖 AI Agents", value: "AI_AGENT" },
  { label: "⚡ SaaS", value: "SAAS" },
  { label: "🔗 APIs", value: "API" },
  { label: "⚙️ Automation", value: "AUTOMATION" },
  { label: "🏢 Enterprise", value: "ENTERPRISE" },
  { label: "🧠 AI Tools", value: "AI_TOOL" },
  { label: "🌐 Websites", value: "WEBSITE" },
]

const SORT_OPTIONS = [
  { label: "Most Popular", value: "popular" },
  { label: "Highest Rated", value: "rating" },
  { label: "Newest First", value: "newest" },
  { label: "Lowest Price", value: "price_asc" },
  { label: "Highest Price", value: "price_desc" },
  { label: "Best Selling", value: "bestseller" },
  { label: "Trending", value: "trending" },
]

const S = `
.glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}
.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:1px solid rgba(139,92,246,.3)}
.btn-primary:hover{box-shadow:0 0 20px rgba(139,92,246,.3)}
.filter-chip{border:1px solid rgba(255,255,255,.08);border-radius:9999px;padding:.375rem 1rem;font-size:.8125rem;font-weight:500;transition:all .2s;cursor:pointer;color:rgba(255,255,255,.5);background:transparent}
.filter-chip:hover{border-color:rgba(139,92,246,.4);color:rgba(255,255,255,.9)}
.filter-chip-active{background:rgba(139,92,246,.15);border-color:rgba(139,92,246,.5)!important;color:#a78bfa!important}
.text-gradient{background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.section-label{font-size:.7rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.card-hover{transition:all .3s ease}
.card-hover:hover{transform:translateY(-4px)}
.filter-panel{background:rgba(8,8,8,.97);border:1px solid rgba(255,255,255,.08);border-radius:1rem;padding:1.25rem}
.range-slider{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:rgba(255,255,255,.1);outline:none}
.range-slider::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);cursor:pointer}
@keyframes flash-pulse{0%,100%{opacity:1}50%{opacity:.7}}
.flash-badge{animation:flash-pulse 1.5s ease-in-out infinite}
`

interface SerializedProduct extends ProductCardProps {
  createdAt?: string
}

interface Props {
  featured: SerializedProduct[]
  trending: SerializedProduct[]
  flashSale: SerializedProduct[]
  bestSellers: SerializedProduct[]
  allProducts: SerializedProduct[]
  totalCount: number
}

export default function MarketplaceClient({ featured, trending, flashSale, bestSellers, allProducts, totalCount }: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("ALL")
  const [sortBy, setSortBy] = useState("popular")
  const [showSale, setShowSale] = useState(false)
  const [showWithDemo, setShowWithDemo] = useState(false)
  const [minRating, setMinRating] = useState(0)
  const [priceMax, setPriceMax] = useState(1000)
  const [showFilters, setShowFilters] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null)
  const router = useRouter()
  const { addItem } = useCart()

  const showToast = useCallback((type: "success" | "error" | "info", msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const handlePreview = useCallback(async (productId: string) => {
    try {
      const res = await fetch("/api/preview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      if (res.status === 401) {
        router.push(`/login?callbackUrl=/marketplace?preview=${productId}`)
        return
      }
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "ALREADY_OWNED") {
          showToast("info", "You already own this product.")
          return
        }
        if (data.error === "PREVIEW_LIMIT_REACHED") {
          showToast("info", data.message || "Preview limit reached for this product")
          return
        }
        showToast("error", data.error || "Preview unavailable")
        return
      }
      router.push(`/preview/${productId}`)
    } catch {
      showToast("error", "Failed to start preview. Please try again.")
    }
  }, [router, showToast])

  const handleAddToCart = useCallback(async (productId: string, tierId?: string) => {
    if (addingToCart === productId) return
    setAddingToCart(productId)
    try {
      // Pre-validate (checks auth, ownership, inventory, tiers)
      const validateRes = await fetch("/api/products/validate-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, tierId }),
      })
      const validateData = await validateRes.json()

      if (validateRes.status === 401) {
        router.push("/login?callbackUrl=/marketplace")
        return
      }

      if (!validateData.valid) {
        const reason = validateData.reasons?.[0]
        if (reason === "ALREADY_OWNED") {
          showToast("info", "You already own this product.")
          return
        }
        if (reason === "SOLD_OUT") {
          showToast("error", "This product is currently sold out")
          return
        }
        showToast("error", validateData.reasons?.join(", ") || "Cannot add to cart")
        return
      }

      // Use the CartProvider addItem — triggers Pusher CART_UPDATED → navbar count updates instantly
      const result = await addItem(productId, tierId, 1)
      if (!result.success) {
        const code = result.code ?? result.error
        if (code === "ALREADY_OWNED") {
          showToast("info", "You already own this product.")
        } else if (code === "SOLD_OUT") {
          showToast("error", "This product is sold out")
        } else {
          showToast("error", result.error || "Failed to add to cart")
        }
        return
      }
      showToast("success", "Added to cart ✓")
      router.push("/cart")
    } catch {
      showToast("error", "Failed to add to cart. Please try again.")
    } finally {
      setAddingToCart(null)
    }
  }, [router, addItem, addingToCart, showToast])

  const filteredProducts = useMemo(() => {
    let list = [...allProducts]

    // Type filter
    if (selectedType !== "ALL") list = list.filter(p => p.type === selectedType)

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.tagline || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }

    // On sale filter
    if (showSale) list = list.filter(p => p.flashSalePrice || (p.discountPrice && p.discountPrice < (p.startingPrice || 9999)))

    // Demo filter
    if (showWithDemo) list = list.filter(p => p.demoUrl)

    // Rating filter
    if (minRating > 0) list = list.filter(p => (p.averageRating || 0) >= minRating)

    // Price filter
    if (priceMax < 1000) list = list.filter(p => !p.startingPrice || p.startingPrice <= priceMax)

    // Sort
    switch (sortBy) {
      case "rating": list.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break
      case "newest": list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()); break
      case "price_asc": list.sort((a, b) => (a.startingPrice || 0) - (b.startingPrice || 0)); break
      case "price_desc": list.sort((a, b) => (b.startingPrice || 0) - (a.startingPrice || 0)); break
      case "bestseller": list.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0)); break
      case "trending": list.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0)); break
      default: list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    }

    return list
  }, [allProducts, selectedType, searchQuery, showSale, showWithDemo, minRating, priceMax, sortBy])

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{S}</style>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold transition-all animate-in slide-in-from-bottom-4 ${
          toast.type === "success" ? "bg-emerald-500/90 text-white border border-emerald-400/30" :
          toast.type === "error" ? "bg-red-500/90 text-white border border-red-400/30" :
          "bg-zinc-800/95 text-white border border-white/10"
        } backdrop-blur-xl`}>
          <span>{toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <section className="relative py-16 px-4 border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/15 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-10">
            <p className="section-label mb-3">🛒 Marketplace</p>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
              <span className="text-gradient">{totalCount.toLocaleString()}+ Products</span>
              <br />Ready to Deploy
            </h1>
            <p className="text-zinc-500 text-lg max-w-2xl mx-auto">
              AI agents, SaaS tools, APIs, and developer products. Curated, reviewed, and production-ready.
            </p>
          </div>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 text-lg pointer-events-none">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => startTransition(() => setSearchQuery(e.target.value))}
                placeholder="Search products, AI agents, tools..."
                className="w-full glass rounded-2xl pl-14 pr-5 py-5 text-white placeholder-zinc-600 outline-none focus:border-purple-500/50 text-base transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors">✕</button>
              )}
            </div>
          </div>

          {/* Type filter chips */}
          <div className="flex flex-wrap gap-2 justify-center">
            {TYPES.map(t => (
              <button key={t.value}
                onClick={() => startTransition(() => setSelectedType(t.value))}
                className={`filter-chip ${selectedType === t.value ? "filter-chip-active" : ""}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── FLASH SALE SECTION ───────────────────────────────────────────────── */}
      {flashSale.length > 0 && (
        <section className="py-12 px-4 border-b border-red-500/10 bg-gradient-to-r from-red-950/20 to-orange-950/15">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-red-400 font-black uppercase tracking-wider text-sm flash-badge">⚡ Flash Sale</span>
                </div>
                <span className="text-zinc-600 text-sm">Limited time — ends soon</span>
              </div>
              <Link href="/marketplace?filter=sale" className="text-sm text-red-400 hover:text-red-300 transition-colors">View all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {flashSale.map(p => <ProductCard key={p.id} {...p} variant="grid" previewEnabled={p.previewEnabled ?? false} onPreview={() => handlePreview(p.id)} onAddToCart={() => handleAddToCart(p.id, p.tierId)} isAddingToCart={addingToCart === p.id} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURED PRODUCTS ───────────────────────────────────────────────── */}
      {featured.length > 0 && !searchQuery && selectedType === "ALL" && (
        <section className="py-12 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="section-label mb-1">⭐ Featured</p>
                <h2 className="text-2xl font-black">Editor&apos;s Picks</h2>
              </div>
              <Link href="/marketplace?filter=featured" className="text-sm text-zinc-500 hover:text-white transition-colors">See all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.slice(0, 3).map((p, i) => <ProductCard key={p.id} {...p} variant={i === 0 ? "featured" : "grid"} previewEnabled={p.previewEnabled ?? false} onPreview={() => handlePreview(p.id)} onAddToCart={() => handleAddToCart(p.id, p.tierId)} isAddingToCart={addingToCart === p.id} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── TRENDING SECTION ─────────────────────────────────────────────────── */}
      {trending.length > 0 && !searchQuery && selectedType === "ALL" && (
        <section className="py-12 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="section-label mb-1">🔥 Trending</p>
                <h2 className="text-2xl font-black">Popular this week</h2>
              </div>
              <Link href="/marketplace?sort=trending" className="text-sm text-zinc-500 hover:text-white transition-colors">See all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {trending.slice(0, 4).map(p => <ProductCard key={p.id} {...p} variant="grid" previewEnabled={p.previewEnabled ?? false} onPreview={() => handlePreview(p.id)} onAddToCart={() => handleAddToCart(p.id, p.tierId)} isAddingToCart={addingToCart === p.id} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── BEST SELLERS ─────────────────────────────────────────────────────── */}
      {bestSellers.length > 0 && !searchQuery && selectedType === "ALL" && (
        <section className="py-12 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="section-label mb-1">🏆 Best Sellers</p>
                <h2 className="text-2xl font-black">Top performing products</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {bestSellers.map(p => <ProductCard key={p.id} {...p} variant="grid" previewEnabled={p.previewEnabled ?? false} onPreview={() => handlePreview(p.id)} onAddToCart={() => handleAddToCart(p.id, p.tierId)} isAddingToCart={addingToCart === p.id} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── MAIN PRODUCT GRID ───────────────────────────────────────────────── */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Grid controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold">
                {searchQuery ? `Results for "${searchQuery}"` : selectedType !== "ALL" ? TYPES.find(t => t.value === selectedType)?.label : "All Products"}
                <span className="text-zinc-600 font-normal text-sm ml-2">({filteredProducts.length})</span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Toggle filters */}
              <button onClick={() => setShowFilters(f => !f)}
                className={`glass px-4 py-2 rounded-xl text-sm font-medium transition-all ${showFilters ? "border-purple-500/50 text-purple-400" : "text-zinc-400 hover:border-purple-500/30"}`}>
                ⚙️ Filters {(showSale || showWithDemo || minRating > 0 || priceMax < 1000) ? "●" : ""}
              </button>
              {/* Sort select */}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="glass rounded-xl px-4 py-2 text-sm text-zinc-300 outline-none border-transparent focus:border-purple-500/50 transition-all bg-transparent cursor-pointer">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="filter-panel mb-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Deals</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showSale} onChange={e => setShowSale(e.target.checked)} className="accent-purple-500 w-4 h-4" />
                  <span className="text-sm text-zinc-300">On Sale Only</span>
                </label>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Demo</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showWithDemo} onChange={e => setShowWithDemo(e.target.checked)} className="accent-purple-500 w-4 h-4" />
                  <span className="text-sm text-zinc-300">Has Live Demo</span>
                </label>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Min Rating</p>
                <div className="flex gap-1">
                  {[0, 3, 4, 4.5].map(r => (
                    <button key={r} onClick={() => setMinRating(r)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${minRating === r ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "glass text-zinc-500 hover:text-zinc-300"}`}>
                      {r === 0 ? "Any" : `${r}★+`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Max Price: ${priceMax === 1000 ? "Any" : `$${priceMax}/mo`}</p>
                <input type="range" min={0} max={1000} step={50} value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} className="range-slider w-full" />
              </div>
            </div>
          )}

          {/* Products grid */}
          {isPending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl aspect-[3/4] animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProducts.map(p => <ProductCard key={p.id} {...p} variant="grid" previewEnabled={p.previewEnabled ?? false} onPreview={() => handlePreview(p.id)} onAddToCart={() => handleAddToCart(p.id, p.tierId)} isAddingToCart={addingToCart === p.id} />)}
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-bold mb-2">No products found</h3>
              <p className="text-zinc-600 mb-6">Try adjusting your filters or search query</p>
              <button onClick={() => { setSearchQuery(""); setSelectedType("ALL"); setShowSale(false); setShowWithDemo(false); setMinRating(0); setPriceMax(1000) }}
                className="glass px-6 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:border-purple-500/40 transition-all">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
