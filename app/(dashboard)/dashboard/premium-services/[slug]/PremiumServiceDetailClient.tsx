"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Star, Check, Layers, ChevronDown, ChevronUp,
  MessageSquarePlus, ShoppingCart, Sparkles, Crown, Package,
  ArrowRight, X, AlertCircle, Loader2, ExternalLink
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type AddonService = {
  id: string; slug: string; name: string; description?: string | null
  pricingType: string; unitName?: string | null; unitPrice: number
  currency: string; billingCycle: string; isActive: boolean
}

type PremiumService = {
  id: string; slug: string; name: string; shortDescription: string
  fullDescription?: string | null; iconUrl?: string | null; bannerUrl?: string | null
  basePrice: number; currency: string; billingCycle: string
  isFeatured: boolean; category?: { id: string; name: string; slug: string } | null
  addonServices: AddonService[]
}

type ProductTier = {
  id: string; name: string; price: number; currency: string; interval: string
}

type Product = {
  id: string; slug: string; name: string; description?: string | null
  tiers: ProductTier[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount)
}

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "/mo", QUARTERLY: "/qtr", SEMI_ANNUAL: "/6mo",
  YEARLY: "/yr", LIFETIME: "lifetime", USAGE_BASED: "usage",
  WEEKLY: "/wk", ONE_TIME: "one-time",
}


// ─── Ask Query Modal ──────────────────────────────────────────────────────────

function QueryModal({ service, onClose }: { service: PremiumService; onClose: () => void }) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    if (!subject.trim() || !message.trim()) return
    setSending(true); setError("")
    try {
      const res = await fetch("/api/premium-service-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premiumServiceId: service.id, serviceName: service.name, subject, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to send query")
      setSent(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-white">Ask a Query</h2>
            <p className="text-xs text-zinc-400 mt-0.5">About: {service.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {sent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="font-semibold text-white">Query sent!</p>
              <p className="text-xs text-zinc-400 mt-1">Our team will reach out to you shortly.</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors">
                Close
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Subject *</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Pricing clarification, feature question..."
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Your Question *</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your query in detail..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={submit}
                  disabled={sending || !subject.trim() || !message.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />}
                  Send Query
                </button>
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PremiumServiceDetailClient({
  service,
  product,
  alreadyOwned,
  purchasedServiceId,
}: {
  service: PremiumService
  product: Product | null
  alreadyOwned: boolean
  purchasedServiceId: string | null
}) {
  const router = useRouter()
  const [addonsExpanded, setAddonsExpanded] = useState(false)
  const [showQueryModal, setShowQueryModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [cartError, setCartError] = useState("")
  const [selectedTierId, setSelectedTierId] = useState<string>(product?.tiers?.[0]?.id ?? "")

  useEffect(() => {
    if (product?.tiers?.[0]) setSelectedTierId(product.tiers[0].id)
  }, [product])

  const selectedTier = product?.tiers?.find((t) => t.id === selectedTierId) ?? product?.tiers?.[0]
  const displayPrice = selectedTier ? Number(selectedTier.price) : service.basePrice
  const displayCurrency = selectedTier?.currency ?? service.currency
  const displayCycle = selectedTier?.interval ?? service.billingCycle

  async function handleAddToCart() {
    if (!product) return
    setAdding(true); setCartError(""); setAddedToCart(false)

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, tierId: selectedTierId || undefined, quantity: 1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to add to cart")
      setAddedToCart(true)
      setTimeout(() => router.push("/cart"), 800)
    } catch (e: any) {
      setCartError(e.message)
      setAdding(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-16">
      {showQueryModal && <QueryModal service={service} onClose={() => setShowQueryModal(false)} />}

      {/* Back nav */}
      <div className="border-b border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link
            href="/dashboard/premium-services"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Premium Services
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          {service.bannerUrl ? (
            <div className="h-48 relative overflow-hidden">
              <img src={service.bannerUrl} alt={service.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
            </div>
          ) : (
            <div className="h-32 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 dark:from-violet-950 dark:via-blue-950 dark:to-zinc-900 flex items-center px-8 gap-4 border-b border-zinc-100 dark:border-zinc-800">
              {service.iconUrl ? (
                <img src={service.iconUrl} alt="" className="w-12 h-12 object-contain" />
              ) : (
                <Sparkles className="w-8 h-8 text-violet-600 dark:text-violet-400" />
              )}
              {service.isFeatured && (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500 text-xs font-bold text-white ml-auto shadow-xs">
                  <Star className="w-3 h-3 fill-current" /> Featured
                </span>
              )}
            </div>
          )}

          <div className="p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex-1">
                {service.category && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-violet-100 dark:bg-blue-900/40 text-violet-700 dark:text-blue-400 font-semibold mb-2 inline-block">
                    {service.category.name}
                  </span>
                )}
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mt-1">{service.name}</h1>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">{service.shortDescription}</p>
              </div>

              {/* Pricing & CTA */}
              <div className="shrink-0 w-full md:w-72">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
                  {/* Tier selector */}
                  {product && product.tiers.length > 1 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Select Plan</p>
                      <div className="space-y-2">
                        {product.tiers.map((tier) => (
                          <label
                            key={tier.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selectedTierId === tier.id
                                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 hover:border-zinc-300"
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="tier"
                                value={tier.id}
                                checked={selectedTierId === tier.id}
                                onChange={() => setSelectedTierId(tier.id)}
                                className="accent-violet-600"
                              />
                              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{tier.name}</span>
                            </div>
                            <span className="text-sm font-bold text-zinc-900 dark:text-white">
                              {fmt(Number(tier.price), tier.currency)}{CYCLE_LABELS[tier.interval] ?? ""}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-3xl font-bold text-zinc-900 dark:text-white">{fmt(displayPrice, displayCurrency)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{CYCLE_LABELS[displayCycle] ?? ""}</p>
                  </div>

                  {cartError && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {cartError}
                    </div>
                  )}

                  {alreadyOwned ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                        <Check className="w-4 h-4 shrink-0" /> You already own this service
                      </div>
                      {purchasedServiceId && (
                        <Link
                          href={`/dashboard/services/${purchasedServiceId}`}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 text-sm font-bold transition-colors"
                        >
                          Open Workspace <ExternalLink className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  ) : product ? (
                    <button
                      onClick={handleAddToCart}
                      disabled={adding || addedToCart}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors shadow-xs ${
                        addedToCart
                          ? "bg-emerald-600 text-white"
                          : "bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white"
                      }`}
                    >
                      {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : addedToCart ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                      {adding ? "Adding to cart..." : addedToCart ? "Added! Redirecting..." : "Add to Cart"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-zinc-200 text-zinc-500 font-semibold text-sm cursor-not-allowed"
                    >
                      Contact Sales
                    </button>
                  )}

                  <button
                    onClick={() => setShowQueryModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-300 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 transition-colors"
                  >
                    <MessageSquarePlus className="w-4 h-4" /> Ask a Query
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full Description */}
        {service.fullDescription && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-600 dark:text-violet-400" /> About this Service
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{service.fullDescription}</div>
          </div>
        )}

        {/* Add-ons */}
        {service.addonServices.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-sm">
            <button
              onClick={() => setAddonsExpanded((x) => !x)}
              className="w-full flex items-center justify-between px-8 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
            >
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                Available Add-ons
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                  {service.addonServices.length}
                </span>
              </h2>
              {addonsExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {addonsExpanded && (
              <div className="px-8 pb-6 space-y-3">
                <p className="text-xs text-zinc-500 mb-4">
                  These add-ons can be activated after purchasing the service from your service workspace.
                </p>
                {service.addonServices.map((addon) => (
                  <div key={addon.id} className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{addon.name}</p>
                      {addon.description && <p className="text-xs text-zinc-500 mt-0.5">{addon.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{fmt(addon.unitPrice, addon.currency)}</p>
                      <p className="text-[10px] text-zinc-500">
                        {addon.pricingType === "PER_UNIT_RECURRING" && addon.unitName ? `/ ${addon.unitName} ` : ""}
                        {CYCLE_LABELS[addon.billingCycle] ?? ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No product CTA */}
        {!product && !alreadyOwned && (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center bg-white dark:bg-transparent">
            <Crown className="w-8 h-8 text-violet-600 dark:text-violet-400/60 mx-auto mb-3" />
            <p className="text-zinc-800 dark:text-zinc-300 font-semibold">Interested in this service?</p>
            <p className="text-sm text-zinc-500 mt-1 mb-4">Click "Ask a Query" to get in touch with our team.</p>
            <button
              onClick={() => setShowQueryModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-all mx-auto shadow-xs"
            >
              <MessageSquarePlus className="w-4 h-4" /> Ask a Query <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
