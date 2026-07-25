"use client"

import { useState, useCallback, useTransition, useEffect } from "react"
import {
  CreditCard, Plus, Edit2, Trash2, Check, X, Zap, Star,
  Users, TrendingUp, AlertTriangle, RefreshCw, Settings,
  ChevronDown, ChevronRight, Eye, EyeOff, Package, Gift,
  Calendar, DollarSign, BarChart3, Clock, Layers, Shield,
  ArrowUpRight, ArrowDownRight, MoreVertical, Copy, Crown,
  Sparkles, Activity, Target
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanBenefit = {
  id: string
  planId: string
  title: string
  description?: string | null
  benefitType: string
  benefitValue?: string | null
  isHighlighted: boolean
  isIncluded: boolean
  sortOrder: number
}

type SubscriptionPlan = {
  id: string
  slug: string
  name: string
  tagline?: string | null
  description?: string | null
  tier: string
  billingCycle: string
  price: number
  discountPrice?: number | null
  currency: string
  trialDays: number
  isPopular: boolean
  isRecommended: boolean
  isActive: boolean
  isCustom: boolean
  sortOrder: number
  stripePlanId?: string | null
  razorpayPlanId?: string | null
  benefits: PlanBenefit[]
  _count: { subscriptions: number }
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
  sortOrder: number
  category?: { id: string; name: string } | null
  _count: { addonServices: number }
}

type AddonService = {
  id: string
  premiumServiceId?: string | null
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
  sortOrder: number
  premiumService?: { id: string; name: string } | null
  _count: { userAddons: number }
}

type Analytics = {
  active: number
  trialing: number
  pastDue: number
  paused: number
  canceled: number
  newThisMonth: number
  upcomingRenewals: number
  mrr: number
  invoiceSummary: Array<{ status: string; _count: { id: number }; _sum: { totalAmount: number | null } }>
}

type RecentSubscription = {
  id: string
  subscriptionNumber: string
  status: string
  billingCycle: string
  totalAmount: number
  currency: string
  createdAt: string
  user: { id: string; name: string | null; email: string }
  plan: { id: string; name: string; tier: string; billingCycle: string }
}

type ServiceCategory = { id: string; name: string; slug: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  FREE: "bg-zinc-800 text-zinc-300",
  STARTER: "bg-blue-900/60 text-blue-300",
  PRO: "bg-violet-900/60 text-violet-300",
  AGENCY: "bg-amber-900/60 text-amber-300",
  ENTERPRISE: "bg-emerald-900/60 text-emerald-300",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-900/60 text-emerald-300",
  TRIALING: "bg-blue-900/60 text-blue-300",
  PAST_DUE: "bg-red-900/60 text-red-300",
  PAUSED: "bg-amber-900/60 text-amber-300",
  CANCELED: "bg-zinc-800 text-zinc-400",
  EXPIRED: "bg-zinc-800 text-zinc-400",
  UNPAID: "bg-red-900/60 text-red-400",
}

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "/ mo",
  QUARTERLY: "/ qtr",
  SEMI_ANNUAL: "/ 6mo",
  YEARLY: "/ yr",
  LIFETIME: "lifetime",
  USAGE_BASED: "usage",
}

function fmt(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${className ?? ""}`}>
      {children}
    </span>
  )
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────

type Tab = "overview" | "plans" | "premium-services" | "addons" | "subscribers"

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
}: {
  label: string
  value: string | number
  sub?: string
  icon: any
  accent: string
  trend?: "up" | "down" | "neutral"
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${accent} bg-opacity-20`}>
          <Icon className="w-5 h-5 text-white/80" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend === "up" ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          ) : trend === "down" ? (
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
          ) : null}
        </div>
      )}
    </div>
  )
}

// ─── Plan Form ────────────────────────────────────────────────────────────────

const EMPTY_PLAN = {
  slug: "",
  name: "",
  tagline: "",
  description: "",
  tier: "PRO",
  billingCycle: "MONTHLY",
  price: 0,
  discountPrice: "",
  currency: "USD",
  trialDays: 0,
  isPopular: false,
  isRecommended: false,
  isActive: true,
  isCustom: false,
  sortOrder: 0,
  stripePlanId: "",
  razorpayPlanId: "",
}

function PlanForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<typeof EMPTY_PLAN>
  onSave: (data: any) => void
  onCancel: () => void
  loading: boolean
}) {
  const [form, setForm] = useState({ ...EMPTY_PLAN, ...initial })

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Plan Name *">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input-dark" placeholder="e.g. Pro" />
        </Field>
        <Field label="Slug *">
          <input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="input-dark" placeholder="e.g. plan-pro-monthly" />
        </Field>
      </div>
      <Field label="Tagline">
        <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} className="input-dark" placeholder="Short selling proposition" />
      </Field>
      <Field label="Description">
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input-dark" rows={3} placeholder="Full plan description..." />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Tier">
          <select value={form.tier} onChange={(e) => set("tier", e.target.value)} className="input-dark">
            {["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Billing Cycle">
          <select value={form.billingCycle} onChange={(e) => set("billingCycle", e.target.value)} className="input-dark">
            {["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Currency">
          <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className="input-dark">
            {["USD", "EUR", "GBP", "INR", "CAD", "AUD"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Price *">
          <input type="number" min={0} step={0.01} value={form.price} onChange={(e) => set("price", Number(e.target.value))} className="input-dark" />
        </Field>
        <Field label="Discount Price">
          <input type="number" min={0} step={0.01} value={form.discountPrice} onChange={(e) => set("discountPrice", e.target.value)} className="input-dark" placeholder="Optional" />
        </Field>
        <Field label="Trial Days">
          <input type="number" min={0} value={form.trialDays} onChange={(e) => set("trialDays", Number(e.target.value))} className="input-dark" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Stripe Plan ID">
          <input value={form.stripePlanId} onChange={(e) => set("stripePlanId", e.target.value)} className="input-dark" placeholder="price_xxx" />
        </Field>
        <Field label="Razorpay Plan ID">
          <input value={form.razorpayPlanId} onChange={(e) => set("razorpayPlanId", e.target.value)} className="input-dark" placeholder="plan_xxx" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6">
        {[
          { key: "isPopular", label: "Popular" },
          { key: "isRecommended", label: "Recommended" },
          { key: "isActive", label: "Active" },
          { key: "isCustom", label: "Custom / Enterprise" },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={(form as any)[key]}
              onChange={(e) => set(key, e.target.checked)}
              className="w-4 h-4 rounded accent-violet-500"
            />
            {label}
          </label>
        ))}
        <Field label="Sort Order" className="w-24">
          <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} className="input-dark" />
        </Field>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSave(form)} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Plan
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

// ─── Premium Service Form ─────────────────────────────────────────────────────

const EMPTY_SERVICE = {
  categoryId: "",
  slug: "",
  name: "",
  shortDescription: "",
  fullDescription: "",
  iconUrl: "",
  bannerUrl: "",
  basePrice: 0,
  currency: "USD",
  billingCycle: "MONTHLY",
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
}

function ServiceForm({
  initial,
  categories,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<typeof EMPTY_SERVICE>
  categories: ServiceCategory[]
  onSave: (data: any) => void
  onCancel: () => void
  loading: boolean
}) {
  const [form, setForm] = useState({ ...EMPTY_SERVICE, ...initial })
  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Service Name *">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input-dark" />
        </Field>
        <Field label="Slug *">
          <input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="input-dark" />
        </Field>
      </div>
      <Field label="Short Description *">
        <input value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className="input-dark" />
      </Field>
      <Field label="Full Description">
        <textarea value={form.fullDescription} onChange={(e) => set("fullDescription", e.target.value)} className="input-dark" rows={4} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Category">
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="input-dark">
            <option value="">-- None --</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Base Price *">
          <input type="number" min={0} step={0.01} value={form.basePrice} onChange={(e) => set("basePrice", Number(e.target.value))} className="input-dark" />
        </Field>
        <Field label="Billing Cycle">
          <select value={form.billingCycle} onChange={(e) => set("billingCycle", e.target.value)} className="input-dark">
            {["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Icon URL">
          <input value={form.iconUrl} onChange={(e) => set("iconUrl", e.target.value)} className="input-dark" placeholder="https://..." />
        </Field>
        <Field label="Banner URL">
          <input value={form.bannerUrl} onChange={(e) => set("bannerUrl", e.target.value)} className="input-dark" placeholder="https://..." />
        </Field>
      </div>
      <div className="flex gap-6">
        {[{ key: "isActive", label: "Active" }, { key: "isFeatured", label: "Featured" }].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-300">
            <input type="checkbox" checked={(form as any)[key]} onChange={(e) => set(key, e.target.checked)} className="w-4 h-4 rounded accent-violet-500" />
            {label}
          </label>
        ))}
        <Field label="Sort Order" className="w-24">
          <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} className="input-dark" />
        </Field>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSave(form)} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Service
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  )
}

// ─── Addon Form ───────────────────────────────────────────────────────────────

const EMPTY_ADDON = {
  premiumServiceId: "",
  slug: "",
  name: "",
  description: "",
  pricingType: "FLAT_RECURRING",
  unitName: "",
  unitPrice: 0,
  currency: "USD",
  billingCycle: "MONTHLY",
  maxQuantity: "",
  isActive: true,
  sortOrder: 0,
}

function AddonForm({
  initial,
  premiumServices,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<typeof EMPTY_ADDON>
  premiumServices: PremiumService[]
  onSave: (data: any) => void
  onCancel: () => void
  loading: boolean
}) {
  const [form, setForm] = useState({ ...EMPTY_ADDON, ...initial })
  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Addon Name *">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input-dark" />
        </Field>
        <Field label="Slug *">
          <input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="input-dark" />
        </Field>
      </div>
      <Field label="Description">
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input-dark" rows={3} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Parent Premium Service">
          <select value={form.premiumServiceId} onChange={(e) => set("premiumServiceId", e.target.value)} className="input-dark">
            <option value="">-- Standalone --</option>
            {premiumServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Pricing Type">
          <select value={form.pricingType} onChange={(e) => set("pricingType", e.target.value)} className="input-dark">
            {["FLAT_RECURRING", "PER_UNIT_RECURRING", "ONE_TIME"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Field label="Unit Price *">
          <input type="number" min={0} step={0.01} value={form.unitPrice} onChange={(e) => set("unitPrice", Number(e.target.value))} className="input-dark" />
        </Field>
        <Field label="Unit Name">
          <input value={form.unitName} onChange={(e) => set("unitName", e.target.value)} className="input-dark" placeholder="Seat, GB..." />
        </Field>
        <Field label="Billing Cycle">
          <select value={form.billingCycle} onChange={(e) => set("billingCycle", e.target.value)} className="input-dark">
            {["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Max Qty">
          <input type="number" min={1} value={form.maxQuantity} onChange={(e) => set("maxQuantity", e.target.value)} className="input-dark" placeholder="∞" />
        </Field>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-300">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="w-4 h-4 rounded accent-violet-500" />
          Active
        </label>
        <Field label="Sort Order" className="w-24">
          <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} className="input-dark" />
        </Field>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSave(form)} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Addon
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  )
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ─── Benefit Manager ──────────────────────────────────────────────────────────

function BenefitManager({ plan, onClose }: { plan: SubscriptionPlan; onClose: () => void }) {
  const { toast } = useToast()
  const [benefits, setBenefits] = useState<PlanBenefit[]>(plan.benefits)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newBenefit, setNewBenefit] = useState({
    title: "", description: "", benefitType: "FEATURE", benefitValue: "", isHighlighted: false, isIncluded: true, sortOrder: benefits.length,
  })

  const saveBenefit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/subscription-center/plans/${plan.id}/benefits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBenefit),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message ?? data.error)
      setBenefits((b) => [...b, data.data])
      setAdding(false)
      setNewBenefit({ title: "", description: "", benefitType: "FEATURE", benefitValue: "", isHighlighted: false, isIncluded: true, sortOrder: benefits.length + 1 })
      toast({ title: "Benefit added" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const deleteBenefit = async (id: string) => {
    try {
      await fetch(`/api/admin/subscription-center/plans/${plan.id}/benefits/${id}`, { method: "DELETE" })
      setBenefits((b) => b.filter((x) => x.id !== id))
      toast({ title: "Benefit removed" })
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  return (
    <Modal title={`Benefits for "${plan.name}"`} onClose={onClose}>
      <div className="space-y-3 mb-4">
        {benefits.map((b) => (
          <div key={b.id} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${b.isIncluded ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {b.isIncluded ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{b.title}</p>
              {b.benefitValue && <p className="text-xs text-zinc-400">{b.benefitValue}</p>}
            </div>
            <Badge className={TIER_COLORS[b.benefitType] ?? "bg-zinc-800 text-zinc-300"}>{b.benefitType}</Badge>
            <button onClick={() => deleteBenefit(b.id)} className="p-1 hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {!adding ? (
        <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-violet-400 transition-colors text-sm">
          <Plus className="w-4 h-4" /> Add Benefit
        </button>
      ) : (
        <div className="space-y-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title *">
              <input value={newBenefit.title} onChange={(e) => setNewBenefit((x) => ({ ...x, title: e.target.value }))} className="input-dark" />
            </Field>
            <Field label="Value">
              <input value={newBenefit.benefitValue} onChange={(e) => setNewBenefit((x) => ({ ...x, benefitValue: e.target.value }))} className="input-dark" placeholder="e.g. Unlimited, 50GB" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={newBenefit.benefitType} onChange={(e) => setNewBenefit((x) => ({ ...x, benefitType: e.target.value }))} className="input-dark">
                {["FEATURE", "LIMIT", "SUPPORT", "INTEGRATION", "DISCOUNT"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Sort Order">
              <input type="number" value={newBenefit.sortOrder} onChange={(e) => setNewBenefit((x) => ({ ...x, sortOrder: Number(e.target.value) }))} className="input-dark" />
            </Field>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={newBenefit.isIncluded} onChange={(e) => setNewBenefit((x) => ({ ...x, isIncluded: e.target.checked }))} className="w-4 h-4 rounded accent-emerald-500" />
              Included
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={newBenefit.isHighlighted} onChange={(e) => setNewBenefit((x) => ({ ...x, isHighlighted: e.target.checked }))} className="w-4 h-4 rounded accent-amber-500" />
              Highlighted
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={saveBenefit} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Add
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onEdit,
  onDelete,
  onToggle,
  onManageBenefits,
}: {
  plan: SubscriptionPlan
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onManageBenefits: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-2xl border ${plan.isActive ? "border-zinc-700 bg-zinc-900/60" : "border-zinc-800 bg-zinc-900/30 opacity-70"} transition-all`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={TIER_COLORS[plan.tier]}>{plan.tier}</Badge>
              {plan.isPopular && <Badge className="bg-amber-900/60 text-amber-300">★ Popular</Badge>}
              {plan.isRecommended && <Badge className="bg-violet-900/60 text-violet-300">✦ Recommended</Badge>}
              {!plan.isActive && <Badge className="bg-zinc-800 text-zinc-500">Inactive</Badge>}
            </div>
            <h3 className="font-bold text-white text-lg">{plan.name}</h3>
            {plan.tagline && <p className="text-xs text-zinc-400 mt-0.5">{plan.tagline}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-white">{fmt(plan.price, plan.currency)}</p>
            <p className="text-xs text-zinc-500">{CYCLE_LABELS[plan.billingCycle]}</p>
            {plan.discountPrice && (
              <p className="text-xs text-emerald-400">↓ {fmt(plan.discountPrice, plan.currency)} offer</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold text-white">{plan._count.subscriptions}</span> subscribers
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Gift className="w-3.5 h-3.5" />
            <span className="font-semibold text-white">{plan.benefits.length}</span> benefits
          </div>
          {plan.trialDays > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-blue-400">{plan.trialDays}d trial</span>
            </div>
          )}
          <button onClick={() => setExpanded((x) => !x)} className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>

        {expanded && (
          <div className="mt-4 space-y-1.5">
            {plan.benefits.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-xs">
                <span className={b.isIncluded ? "text-emerald-400" : "text-zinc-600"}>{b.isIncluded ? "✓" : "✗"}</span>
                <span className={b.isIncluded ? "text-zinc-300" : "text-zinc-600"}>{b.title}</span>
                {b.benefitValue && <span className="text-zinc-500">— {b.benefitValue}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-800">
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          <button onClick={onManageBenefits} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 transition-colors">
            <Gift className="w-3 h-3" /> Benefits
          </button>
          <button onClick={onToggle} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${plan.isActive ? "bg-amber-900/30 hover:bg-amber-900/50 text-amber-300" : "bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300"}`}>
            {plan.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {plan.isActive ? "Deactivate" : "Activate"}
          </button>
          {plan._count.subscriptions === 0 && (
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors ml-auto">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function BillingCenterClient({
  plans: initialPlans,
  premiumServices: initialServices,
  addonServices: initialAddons,
  analytics,
  recentSubscriptions,
  serviceCategories,
}: {
  plans: SubscriptionPlan[]
  premiumServices: PremiumService[]
  addonServices: AddonService[]
  analytics: Analytics
  recentSubscriptions: RecentSubscription[]
  serviceCategories: ServiceCategory[]
}) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [plans, setPlans] = useState(initialPlans)
  const [services, setServices] = useState(initialServices)
  const [addons, setAddons] = useState(initialAddons)
  const [isPending, startTransition] = useTransition()

  // Modal states
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [managingBenefitsPlan, setManagingBenefitsPlan] = useState<SubscriptionPlan | null>(null)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState<PremiumService | null>(null)
  const [showAddonForm, setShowAddonForm] = useState(false)
  const [editingAddon, setEditingAddon] = useState<AddonService | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Plan CRUD ──
  const savePlan = useCallback(async (form: any) => {
    setSaving(true)
    try {
      const isEdit = !!editingPlan
      const url = isEdit
        ? `/api/admin/subscription-center/plans/${editingPlan!.id}`
        : `/api/admin/subscription-center/plans`
      const method = isEdit ? "PATCH" : "POST"
      const payload = {
        ...form,
        price: Number(form.price),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
        trialDays: Number(form.trialDays),
        sortOrder: Number(form.sortOrder),
        stripePlanId: form.stripePlanId || null,
        razorpayPlanId: form.razorpayPlanId || null,
      }

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!data.success) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error))

      if (isEdit) {
        setPlans((p) => p.map((x) => (x.id === editingPlan!.id ? { ...x, ...data.data } : x)))
        toast({ title: "Plan updated" })
      } else {
        setPlans((p) => [...p, { ...data.data, benefits: [], _count: { subscriptions: 0 } }])
        toast({ title: "Plan created" })
      }
      setShowPlanForm(false)
      setEditingPlan(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [editingPlan, toast])

  const deletePlan = useCallback(async (id: string) => {
    if (!confirm("Delete this plan? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/admin/subscription-center/plans/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setPlans((p) => p.filter((x) => x.id !== id))
      toast({ title: "Plan deleted" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }, [toast])

  const togglePlan = useCallback(async (plan: SubscriptionPlan) => {
    try {
      const res = await fetch(`/api/admin/subscription-center/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setPlans((p) => p.map((x) => (x.id === plan.id ? { ...x, isActive: !x.isActive } : x)))
      toast({ title: plan.isActive ? "Plan deactivated" : "Plan activated" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }, [toast])

  // ── Service CRUD ──
  const saveService = useCallback(async (form: any) => {
    setSaving(true)
    try {
      const isEdit = !!editingService
      const url = isEdit
        ? `/api/admin/subscription-center/premium-services/${editingService!.id}`
        : `/api/admin/subscription-center/premium-services`
      const method = isEdit ? "PATCH" : "POST"
      const payload = {
        ...form,
        basePrice: Number(form.basePrice),
        sortOrder: Number(form.sortOrder),
        categoryId: form.categoryId || null,
        iconUrl: form.iconUrl || null,
        bannerUrl: form.bannerUrl || null,
      }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!data.success) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error))

      if (isEdit) {
        setServices((s) => s.map((x) => (x.id === editingService!.id ? { ...x, ...data.data } : x)))
        toast({ title: "Service updated" })
      } else {
        setServices((s) => [...s, { ...data.data, _count: { addonServices: 0 } }])
        toast({ title: "Service created" })
      }
      setShowServiceForm(false)
      setEditingService(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [editingService, toast])

  const deleteService = useCallback(async (id: string) => {
    if (!confirm("Delete this service?")) return
    try {
      const res = await fetch(`/api/admin/subscription-center/premium-services/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setServices((s) => s.filter((x) => x.id !== id))
      toast({ title: "Service deleted" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }, [toast])

  // ── Addon CRUD ──
  const saveAddon = useCallback(async (form: any) => {
    setSaving(true)
    try {
      const isEdit = !!editingAddon
      const url = isEdit
        ? `/api/admin/subscription-center/addon-services/${editingAddon!.id}`
        : `/api/admin/subscription-center/addon-services`
      const method = isEdit ? "PATCH" : "POST"
      const payload = {
        ...form,
        unitPrice: Number(form.unitPrice),
        maxQuantity: form.maxQuantity ? Number(form.maxQuantity) : null,
        sortOrder: Number(form.sortOrder),
        premiumServiceId: form.premiumServiceId || null,
        unitName: form.unitName || null,
      }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!data.success) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error))
      if (isEdit) {
        setAddons((a) => a.map((x) => (x.id === editingAddon!.id ? { ...x, ...data.data } : x)))
        toast({ title: "Addon updated" })
      } else {
        setAddons((a) => [...a, { ...data.data, _count: { userAddons: 0 } }])
        toast({ title: "Addon created" })
      }
      setShowAddonForm(false)
      setEditingAddon(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [editingAddon, toast])

  const deleteAddon = useCallback(async (id: string) => {
    if (!confirm("Delete this addon?")) return
    try {
      const res = await fetch(`/api/admin/subscription-center/addon-services/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setAddons((a) => a.filter((x) => x.id !== id))
      toast({ title: "Addon deleted" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }, [toast])

  // ─── Render ────────────────────────────────────────────────────────────────

  const TABS: Array<{ id: Tab; label: string; icon: any; count?: number }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "plans", label: "Plans", icon: CreditCard, count: plans.length },
    { id: "premium-services", label: "Premium Services", icon: Sparkles, count: services.length },
    { id: "addons", label: "Addon Services", icon: Layers, count: addons.length },
    { id: "subscribers", label: "Subscribers", icon: Users, count: analytics.active },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <div className="border-b border-zinc-800 bg-zinc-950/80 sticky top-0 z-30 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Crown className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Subscription & Billing Center</h1>
              <p className="text-xs text-zinc-500">Manage plans, services, addons, and subscriber billing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "plans" && (
              <button onClick={() => { setEditingPlan(null); setShowPlanForm(true) }} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> New Plan
              </button>
            )}
            {activeTab === "premium-services" && (
              <button onClick={() => { setEditingService(null); setShowServiceForm(true) }} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> New Service
              </button>
            )}
            {activeTab === "addons" && (
              <button onClick={() => { setEditingAddon(null); setShowAddonForm(true) }} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> New Addon
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-6 flex gap-1 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-violet-900/60 text-violet-300" : "bg-zinc-800 text-zinc-500"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Active Subscriptions" value={analytics.active} icon={Activity} accent="bg-emerald-500" trend="up" />
              <KPICard label="Monthly Recurring Revenue" value={fmt(analytics.mrr)} icon={DollarSign} accent="bg-violet-500" />
              <KPICard label="Trialing" value={analytics.trialing} sub="users in trial" icon={Clock} accent="bg-blue-500" />
              <KPICard label="Past Due" value={analytics.pastDue} sub="needs attention" icon={AlertTriangle} accent="bg-red-500" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="New This Month" value={analytics.newThisMonth} icon={TrendingUp} accent="bg-cyan-500" trend="up" />
              <KPICard label="Upcoming Renewals" value={analytics.upcomingRenewals} sub="in next 30 days" icon={Calendar} accent="bg-amber-500" />
              <KPICard label="Paused" value={analytics.paused} icon={Target} accent="bg-zinc-500" />
              <KPICard label="Canceled" value={analytics.canceled} icon={X} accent="bg-red-800" />
            </div>

            {/* Plan distribution */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-violet-400" />
                  Plan Distribution
                </h3>
                <div className="space-y-3">
                  {plans.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <Badge className={TIER_COLORS[p.tier]}>{p.tier}</Badge>
                      <span className="text-sm text-zinc-300 flex-1">{p.name}</span>
                      <span className="text-sm font-bold text-white">{p._count.subscriptions}</span>
                      <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full"
                          style={{ width: `${Math.min(100, (p._count.subscriptions / Math.max(analytics.active, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent subscriptions */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Recent Subscriptions
                </h3>
                <div className="space-y-2">
                  {recentSubscriptions.slice(0, 8).map((s) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                        {(s.user.name ?? s.user.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{s.user.name ?? s.user.email}</p>
                        <p className="text-[10px] text-zinc-500">{s.plan.name} · {s.plan.tier}</p>
                      </div>
                      <Badge className={STATUS_COLORS[s.status] ?? "bg-zinc-800 text-zinc-400"}>{s.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Plans Tab ── */}
        {activeTab === "plans" && (
          <div className="space-y-4">
            {plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 p-16 text-center">
                <CreditCard className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">No subscription plans yet.</p>
                <button onClick={() => { setEditingPlan(null); setShowPlanForm(true) }} className="btn-primary mt-4">
                  <Plus className="w-4 h-4 inline mr-1" /> Create First Plan
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    onEdit={() => { setEditingPlan(p); setShowPlanForm(true) }}
                    onDelete={() => deletePlan(p.id)}
                    onToggle={() => togglePlan(p)}
                    onManageBenefits={() => setManagingBenefitsPlan(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Premium Services Tab ── */}
        {activeTab === "premium-services" && (
          <div className="space-y-4">
            {services.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 p-16 text-center">
                <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">No premium services yet.</p>
                <button onClick={() => { setEditingService(null); setShowServiceForm(true) }} className="btn-primary mt-4">
                  <Plus className="w-4 h-4 inline mr-1" /> Create First Service
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {services.map((s) => (
                  <div key={s.id} className={`rounded-2xl border ${s.isActive ? "border-zinc-700 bg-zinc-900/60" : "border-zinc-800 bg-zinc-900/30 opacity-60"} p-5`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        {s.isFeatured && <Badge className="bg-amber-900/60 text-amber-300 mb-1">★ Featured</Badge>}
                        <h3 className="font-bold text-white">{s.name}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">{s.shortDescription}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-white">{fmt(s.basePrice, s.currency)}</p>
                        <p className="text-[10px] text-zinc-500">{CYCLE_LABELS[s.billingCycle]}</p>
                      </div>
                    </div>
                    {s.category && (
                      <Badge className="bg-blue-900/40 text-blue-300 mb-3">{s.category.name}</Badge>
                    )}
                    <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4 pt-2 border-t border-zinc-800">
                      <span><span className="text-white font-medium">{s._count.addonServices}</span> addons</span>
                      {!s.isActive && <Badge className="bg-zinc-800 text-zinc-500">Inactive</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingService(s); setShowServiceForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/admin/subscription-center/premium-services/${s.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isActive: !s.isActive }),
                          })
                          const data = await res.json()
                          if (data.success) setServices((sv) => sv.map((x) => x.id === s.id ? { ...x, isActive: !x.isActive } : x))
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${s.isActive ? "bg-amber-900/30 text-amber-300" : "bg-emerald-900/30 text-emerald-300"}`}
                      >
                        {s.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {s.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => deleteService(s.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors ml-auto">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Addons Tab ── */}
        {activeTab === "addons" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            {addons.length === 0 ? (
              <div className="p-16 text-center">
                <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">No addon services yet.</p>
                <button onClick={() => { setEditingAddon(null); setShowAddonForm(true) }} className="btn-primary mt-4">
                  <Plus className="w-4 h-4 inline mr-1" /> Create First Addon
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Addon</th>
                    <th className="text-left px-4 py-3 font-medium">Parent Service</th>
                    <th className="text-left px-4 py-3 font-medium">Pricing</th>
                    <th className="text-left px-4 py-3 font-medium">Cycle</th>
                    <th className="text-left px-4 py-3 font-medium">Active Users</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {addons.map((a) => (
                    <tr key={a.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{a.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">{a.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {a.premiumService?.name ?? <span className="text-zinc-600">Standalone</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{fmt(a.unitPrice, a.currency)}</p>
                        <p className="text-[10px] text-zinc-500">{a.pricingType.replace(/_/g, " ")}{a.unitName ? ` / ${a.unitName}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{a.billingCycle}</td>
                      <td className="px-4 py-3 text-white font-semibold">{a._count.userAddons}</td>
                      <td className="px-4 py-3">
                        <Badge className={a.isActive ? "bg-emerald-900/60 text-emerald-300" : "bg-zinc-800 text-zinc-500"}>
                          {a.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingAddon(a); setShowAddonForm(true) }} className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteAddon(a.id)} className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors text-zinc-500 hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Subscribers Tab ── */}
        {activeTab === "subscribers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">
                Showing most recent {recentSubscriptions.length} subscriptions.{" "}
                <a href="/admin/subscriptions" className="text-violet-400 hover:underline">View all in Subscriptions module →</a>
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3">Plan</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3">Sub #</th>
                    <th className="text-left px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubscriptions.map((s) => (
                    <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{s.user.name ?? "—"}</p>
                        <p className="text-[10px] text-zinc-500">{s.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-zinc-300">{s.plan.name}</p>
                        <Badge className={TIER_COLORS[s.plan.tier]}>{s.plan.tier}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[s.status] ?? "bg-zinc-800 text-zinc-400"}>{s.status}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{fmt(s.totalAmount, s.currency)}</td>
                      <td className="px-4 py-3 text-[10px] font-mono text-zinc-500">{s.subscriptionNumber}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showPlanForm && (
        <Modal title={editingPlan ? `Edit "${editingPlan.name}"` : "Create Subscription Plan"} onClose={() => { setShowPlanForm(false); setEditingPlan(null) }}>
          <PlanForm
            initial={editingPlan ? {
              slug: editingPlan.slug,
              name: editingPlan.name,
              tagline: editingPlan.tagline ?? "",
              description: editingPlan.description ?? "",
              tier: editingPlan.tier,
              billingCycle: editingPlan.billingCycle,
              price: editingPlan.price,
              discountPrice: editingPlan.discountPrice != null ? String(editingPlan.discountPrice) : "",
              currency: editingPlan.currency,
              trialDays: editingPlan.trialDays,
              isPopular: editingPlan.isPopular,
              isRecommended: editingPlan.isRecommended,
              isActive: editingPlan.isActive,
              isCustom: editingPlan.isCustom,
              sortOrder: editingPlan.sortOrder,
              stripePlanId: editingPlan.stripePlanId ?? "",
              razorpayPlanId: editingPlan.razorpayPlanId ?? "",
            } : undefined}
            onSave={savePlan}
            onCancel={() => { setShowPlanForm(false); setEditingPlan(null) }}
            loading={saving}
          />
        </Modal>
      )}

      {managingBenefitsPlan && (
        <BenefitManager
          plan={managingBenefitsPlan}
          onClose={() => setManagingBenefitsPlan(null)}
        />
      )}

      {showServiceForm && (
        <Modal title={editingService ? `Edit "${editingService.name}"` : "Create Premium Service"} onClose={() => { setShowServiceForm(false); setEditingService(null) }}>
          <ServiceForm
            initial={editingService ? {
              categoryId: editingService.categoryId ?? "",
              slug: editingService.slug,
              name: editingService.name,
              shortDescription: editingService.shortDescription,
              fullDescription: editingService.fullDescription ?? "",
              iconUrl: editingService.iconUrl ?? "",
              bannerUrl: editingService.bannerUrl ?? "",
              basePrice: editingService.basePrice,
              currency: editingService.currency,
              billingCycle: editingService.billingCycle,
              isActive: editingService.isActive,
              isFeatured: editingService.isFeatured,
              sortOrder: editingService.sortOrder,
            } : undefined}
            categories={serviceCategories}
            onSave={saveService}
            onCancel={() => { setShowServiceForm(false); setEditingService(null) }}
            loading={saving}
          />
        </Modal>
      )}

      {showAddonForm && (
        <Modal title={editingAddon ? `Edit "${editingAddon.name}"` : "Create Addon Service"} onClose={() => { setShowAddonForm(false); setEditingAddon(null) }}>
          <AddonForm
            initial={editingAddon ? {
              premiumServiceId: editingAddon.premiumServiceId ?? "",
              slug: editingAddon.slug,
              name: editingAddon.name,
              description: editingAddon.description ?? "",
              pricingType: editingAddon.pricingType,
              unitName: editingAddon.unitName ?? "",
              unitPrice: editingAddon.unitPrice,
              currency: editingAddon.currency,
              billingCycle: editingAddon.billingCycle,
              maxQuantity: editingAddon.maxQuantity != null ? String(editingAddon.maxQuantity) : "",
              isActive: editingAddon.isActive,
              sortOrder: editingAddon.sortOrder,
            } : undefined}
            premiumServices={services}
            onSave={saveAddon}
            onCancel={() => { setShowAddonForm(false); setEditingAddon(null) }}
            loading={saving}
          />
        </Modal>
      )}

      <style>{`
        .input-dark {
          width: 100%;
          background: #18181b;
          border: 1px solid #3f3f46;
          border-radius: 8px;
          padding: 8px 12px;
          color: #e4e4e7;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-dark:focus {
          border-color: #7c3aed;
        }
        .input-dark::placeholder {
          color: #52525b;
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.85; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: transparent;
          color: #a1a1aa;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid #3f3f46;
          transition: all 0.15s;
        }
        .btn-ghost:hover {
          background: #27272a;
          color: #e4e4e7;
        }
      `}</style>
    </div>
  )
}
