/**
 * components/dashboard/SubscriptionsClient.tsx
 *
 * Production-grade subscriptions management dashboard.
 * Uses Razorpay Standard Checkout for plan upgrades and new subscriptions.
 * NO manual QR generation. NO broken /api/subscriptions/upgrade route.
 */
"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout"
import {
  Zap,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  Loader2,
  Package,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string
  status: string
  currentPeriodEnd: string
  currentPeriodStart: string
  cancelledAt?: string | null
  product?: { id: string; name: string; type: string } | null
  tier?: { id: string; name: string; price: string; interval: string } | null
}

interface Product {
  id: string
  name: string
  slug: string
  tagline?: string | null
  iconUrl?: string | null
  type: string
  tiers?: Array<{
    id: string
    name: string
    price: string
    interval: string
    currency: string
    isActive: boolean
  }>
}

interface Props {
  initialSubscriptions: Subscription[]
  availableProducts: Product[]
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE:    { label: "Active",    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  TRIALING:  { label: "Trial",     color: "text-blue-400 bg-blue-500/10 border-blue-500/20",         icon: <Clock className="h-3 w-3" /> },
  PAST_DUE:  { label: "Past Due",  color: "text-amber-400 bg-amber-500/10 border-amber-500/20",      icon: <AlertCircle className="h-3 w-3" /> },
  CANCELLED: { label: "Cancelled", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",         icon: <XCircle className="h-3 w-3" /> },
  PAUSED:    { label: "Paused",    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",   icon: <Clock className="h-3 w-3" /> },
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function fmtMoney(amount: string | number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount))
}

// ── Upgrade Button ─────────────────────────────────────────────────────────────

function UpgradeButton({ tierId, productId, label }: { tierId: string; productId: string; label?: string }) {
  const router = useRouter()
  const { initiatePayment, loading, error, retry } = useRazorpayCheckout({
    tierId,
    productId,
    mode: "buy_now",
    autoRedirect: true,
    onSuccess: () => {
      // Refresh the page after successful payment so subscriptions update
      setTimeout(() => router.refresh(), 2000)
    },
  })

  return (
    <div className="space-y-2">
      <button
        id={`upgrade-btn-${tierId}`}
        onClick={initiatePayment}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening checkout…
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            {label ?? "Upgrade Now"}
          </>
        )}
      </button>
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-2.5 space-y-1.5">
          <p className="text-xs text-red-300 flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {error}
          </p>
          <button onClick={retry} className="text-xs font-semibold text-red-300 hover:text-red-100 flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SubscriptionsClient({ initialSubscriptions, availableProducts }: Props) {
  const router = useRouter()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const handleCancel = useCallback(async (id: string) => {
    if (!confirm("Cancel this subscription? You'll retain access until the end of your billing period.")) return
    setCancellingId(id)
    setCancelError(null)
    try {
      const res = await fetch(`/api/subscriptions/${id}/cancel`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to cancel subscription.")
      router.refresh()
    } catch (err) {
      setCancelError((err as Error).message)
    } finally {
      setCancellingId(null)
    }
  }, [router])

  const activeSubscriptions = initialSubscriptions.filter(s => ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED"].includes(s.status))
  const hasActiveSub = activeSubscriptions.length > 0

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your active plans. All payments via Razorpay — UPI, QR, Cards & more.</p>
      </div>

      {/* ── Active subscriptions ── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold border-b border-white/5 pb-2">Your Plans</h2>

        {activeSubscriptions.length === 0 ? (
          <div className="dash-glass p-10 rounded-2xl text-center border border-white/5">
            <Zap className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-semibold">No active subscriptions</p>
            <p className="text-zinc-600 text-sm mt-1">Choose a plan below to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSubscriptions.map(sub => {
              const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.ACTIVE
              return (
                <div key={sub.id} className="dash-glass p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{sub.product?.name ?? "Custom Plan"}</h3>
                      <p className="text-xs text-zinc-500">{sub.tier?.name ?? "Standard"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-5 text-sm">
                    {sub.tier?.price && (
                      <p><span className="text-zinc-500">Price:</span> {fmtMoney(sub.tier.price)} / {sub.tier.interval?.toLowerCase()}</p>
                    )}
                    <p><span className="text-zinc-500">Renews:</span> {fmtDate(sub.currentPeriodEnd)}</p>
                  </div>

                  {sub.status === "PAST_DUE" && (
                    <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/8 p-2.5">
                      <p className="text-xs text-amber-300">Payment overdue. Update payment to restore access.</p>
                    </div>
                  )}

                  {cancelError && cancellingId === sub.id && (
                    <p className="text-xs text-red-400 mb-2">{cancelError}</p>
                  )}

                  {!["CANCELLED", "CANCELED"].includes(sub.status) && (
                    <button
                      onClick={() => handleCancel(sub.id)}
                      disabled={cancellingId === sub.id}
                      className="text-xs text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40 flex items-center gap-1"
                    >
                      {cancellingId === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Cancel subscription
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Available upgrades ── */}
      <div className="space-y-4 pt-4">
        <h2 className="text-lg font-semibold border-b border-white/5 pb-2">
          {hasActiveSub ? "More Plans" : "Get Started"}
        </h2>

        {availableProducts.length === 0 ? (
          <div className="dash-glass p-8 rounded-2xl text-center border border-white/5">
            <Package className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No products available at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableProducts.map(prod => {
              // Use the first active tier for checkout
              const activeTier = prod.tiers?.find(t => t.isActive) ?? prod.tiers?.[0]

              return (
                <div key={prod.id} className="dash-glass p-6 rounded-2xl border border-white/5 hover:border-white/15 transition-all flex flex-col">
                  <div className="text-3xl mb-4">{prod.iconUrl ?? "📦"}</div>
                  <h3 className="font-bold text-xl mb-2">{prod.name}</h3>
                  <p className="text-sm text-zinc-400 mb-2 flex-1">{prod.tagline}</p>

                  {activeTier && (
                    <p className="text-lg font-black mb-4">
                      {fmtMoney(activeTier.price, activeTier.currency)}
                      <span className="text-sm font-normal text-zinc-500"> / {activeTier.interval?.toLowerCase()}</span>
                    </p>
                  )}

                  {activeTier ? (
                    <UpgradeButton
                      tierId={activeTier.id}
                      productId={prod.id}
                      label={hasActiveSub ? "Switch to this plan" : "Get started"}
                    />
                  ) : (
                    <button disabled className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-500 text-sm font-medium cursor-not-allowed">
                      Not available
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Payment info ── */}
      <div className="dash-glass rounded-2xl p-5 border border-white/5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <CreditCard className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Razorpay Standard Checkout</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              All plans are processed securely via Razorpay. Accepts UPI, QR codes, credit/debit cards, net banking, wallets, and EMI.
              Your card details never touch NexusAI servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
