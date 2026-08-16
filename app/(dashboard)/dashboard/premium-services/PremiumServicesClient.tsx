"use client"

import { useState, useMemo } from "react"
import {
  Sparkles, Star, Check, ArrowRight, Search, Filter,
  Layers, Zap, Shield, Clock, ChevronDown, ChevronUp,
  Crown, Package, Info, ExternalLink
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type AddonService = {
  id: string
  slug: string
  name: string
  description?: string | null
  pricingType: string
  unitName?: string | null
  unitPrice: number
  currency: string
  billingCycle: string
  maxQuantity?: number | null
  isActive: boolean
}

type PremiumService = {
  id: string
  categoryId?: string | null
  slug: string
  name: string
  shortDescription: string
  fullDescription?: string | null
  iconUrl?: string | null
  bannerUrl?: string | null
  basePrice: number
  currency: string
  billingCycle: string
  isActive: boolean
  isFeatured: boolean
  category?: { id: string; name: string; slug: string } | null
  addonServices: AddonService[]
}

type PlanBenefit = {
  id: string
  title: string
  description?: string | null
  benefitType: string
  benefitValue?: string | null
  isHighlighted: boolean
  isIncluded: boolean
}

type UserSubscription = {
  id: string
  status: string
  billingCycle: string
  totalAmount: number
  currency: string
  currentPeriodEnd: string
  plan: {
    id: string
    name: string
    tier: string
    benefits: PlanBenefit[]
  }
  addons: Array<{
    id: string
    isActive: boolean
    addonService: AddonService
  }>
} | null

type ServiceCategory = { id: string; name: string; slug: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "/mo",
  QUARTERLY: "/qtr",
  SEMI_ANNUAL: "/6mo",
  YEARLY: "/yr",
  LIFETIME: "lifetime",
  USAGE_BASED: "usage",
}

const TIER_GRADIENTS: Record<string, string> = {
  FREE: "from-zinc-800 to-zinc-700",
  STARTER: "from-blue-900 to-blue-800",
  PRO: "from-violet-900 to-violet-800",
  AGENCY: "from-amber-900 to-amber-800",
  ENTERPRISE: "from-emerald-900 to-emerald-800",
}

const TIER_TEXT: Record<string, string> = {
  FREE: "text-zinc-300",
  STARTER: "text-blue-300",
  PRO: "text-violet-300",
  AGENCY: "text-amber-300",
  ENTERPRISE: "text-emerald-300",
}

// ─── Subscription Status Banner ───────────────────────────────────────────────

function SubscriptionBanner({ sub }: { sub: UserSubscription }) {
  if (!sub) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-violet-950 to-purple-950 border border-violet-800/50 p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10">
            <Crown className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="font-semibold text-white">No Active Subscription</p>
            <p className="text-xs text-zinc-400">Upgrade to unlock premium services and advanced features</p>
          </div>
        </div>
        <a
          href="/dashboard/subscriptions"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors shrink-0"
        >
          View Plans <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    )
  }

  const tier = sub.plan.tier
  const periodEnd = new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const isTrialing = sub.status === "TRIALING"

  return (
    <div className={`rounded-2xl bg-gradient-to-r ${TIER_GRADIENTS[tier]} border border-white/5 p-5 flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/10">
          <Crown className={`w-5 h-5 ${TIER_TEXT[tier]}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-white">{sub.plan.name}</p>
            {isTrialing && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 font-semibold">TRIAL</span>}
            <span className={`text-[10px] px-2 py-0.5 rounded-full bg-black/20 ${TIER_TEXT[tier]} font-semibold`}>{tier}</span>
          </div>
          <p className="text-xs text-white/60">
            {fmt(sub.totalAmount, sub.currency)}{CYCLE_LABELS[sub.billingCycle]} · Renews {periodEnd}
            {sub.addons.length > 0 && ` · ${sub.addons.length} addon(s) active`}
          </p>
        </div>
      </div>
      <a
        href="/dashboard/subscriptions"
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors shrink-0"
      >
        Manage <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service, userAddons }: { service: PremiumService; userAddons: AddonService[] }) {
  const [expanded, setExpanded] = useState(false)
  const activeAddonIds = new Set(userAddons.map((a) => a.id))

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:border-violet-500/50 transition-all group shadow-sm flex flex-col justify-between">
      <div>
        {service.bannerUrl ? (
          <div className="h-28 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 relative overflow-hidden">
            <img src={service.bannerUrl} alt={service.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            {service.isFeatured && (
              <span className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs">
                <Star className="w-2.5 h-2.5 fill-current" /> Featured
              </span>
            )}
          </div>
        ) : (
          <div className="h-16 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 dark:from-violet-950 dark:to-blue-950 flex items-center justify-between px-5 border-b border-zinc-100 dark:border-zinc-800/50">
            {service.iconUrl ? (
              <img src={service.iconUrl} alt="" className="w-8 h-8 object-contain" />
            ) : (
              <Sparkles className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            )}
            {service.isFeatured && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs">
                <Star className="w-2.5 h-2.5 fill-current" /> Featured
              </span>
            )}
          </div>
        )}

        <div className="p-5">
          {service.category && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-violet-100 dark:bg-blue-900/40 text-violet-700 dark:text-blue-400 font-semibold mb-2 inline-block">
              {service.category.name}
            </span>
          )}
          <h3 className="font-bold text-zinc-900 dark:text-white text-base mb-1">{service.name}</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">{service.shortDescription}</p>

          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-xl font-bold text-zinc-900 dark:text-white">{fmt(service.basePrice, service.currency)}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{CYCLE_LABELS[service.billingCycle]}</p>
            </div>
            {service.addonServices.length > 0 && (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{service.addonServices.length} addon(s)</span>
            )}
          </div>

          {service.addonServices.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setExpanded((x) => !x)}
                className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors w-full"
              >
                <Layers className="w-3.5 h-3.5" />
                Available Add-ons
                {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
              </button>
              {expanded && (
                <div className="mt-3 space-y-2">
                  {service.addonServices.map((addon) => {
                    const owned = activeAddonIds.has(addon.id)
                    return (
                      <div key={addon.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/40">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{addon.name}</p>
                          {addon.description && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{addon.description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white">{fmt(addon.unitPrice, addon.currency)}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {addon.pricingType === "PER_UNIT_RECURRING" && addon.unitName ? `/ ${addon.unitName} ` : ""}
                            {CYCLE_LABELS[addon.billingCycle]}
                          </p>
                        </div>
                        {owned && (
                          <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 pt-0">
        <a
          href={`/dashboard/premium-services/${service.slug}`}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-all shadow-xs"
        >
          Get Access <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PremiumServicesClient({
  services,
  categories,
  userSubscription,
}: {
  services: PremiumService[]
  categories: ServiceCategory[]
  userSubscription: UserSubscription
}) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")

  const userAddons = useMemo(
    () => (userSubscription?.addons ?? []).map((a) => a.addonService),
    [userSubscription]
  )

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.shortDescription.toLowerCase().includes(search.toLowerCase())
      const matchesCat = activeCategory === "all" || s.categoryId === activeCategory
      return matchesSearch && matchesCat
    })
  }, [services, search, activeCategory])

  const featured = filtered.filter((s) => s.isFeatured)
  const regular = filtered.filter((s) => !s.isFeatured)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-16">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-1">
            <Sparkles className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Premium Services</h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Explore and activate premium services tailored to supercharge your workflow.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Subscription banner */}
        <SubscriptionBanner sub={userSubscription} />

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search premium services..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-violet-500 transition-colors shadow-xs"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${activeCategory === "all" ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 border border-zinc-200 dark:border-zinc-700"}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${activeCategory === cat.id ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 border border-zinc-200 dark:border-zinc-700"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Current Plan Benefits */}
        {userSubscription && userSubscription.plan.benefits.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              Your {userSubscription.plan.name} Plan Includes
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {userSubscription.plan.benefits
                .filter((b) => b.isIncluded)
                .slice(0, 9)
                .map((b) => (
                  <div key={b.id} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-300">{b.title}</p>
                      {b.benefitValue && <p className="text-[10px] text-zinc-500">{b.benefitValue}</p>}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Featured services */}
        {featured.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-300 mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              Featured Services
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
              {featured.map((s) => (
                <ServiceCard key={s.id} service={s} userAddons={userAddons} />
              ))}
            </div>
          </div>
        )}

        {/* All services */}
        {regular.length > 0 && (
          <div>
            {featured.length > 0 && (
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-300 mb-4">All Services</h2>
            )}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
              {regular.map((s) => (
                <ServiceCard key={s.id} service={s} userAddons={userAddons} />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-16 text-center bg-white dark:bg-transparent">
            <Sparkles className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium">
              {search ? `No services found matching "${search}"` : "No premium services available yet."}
            </p>
            {search && (
              <button onClick={() => setSearch("")} className="mt-3 text-xs text-violet-600 font-semibold hover:underline">
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
