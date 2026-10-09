/**
 * components/dashboard/subscription/PlansCatalog.tsx
 * Phase 7 — published plan catalog + enrollment/comparison CTAs.
 * Pricing/eligibility come from the server; the UI never decides eligibility.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Loader2, AlertTriangle, RefreshCw, Sparkles, Clock, CreditCard } from "lucide-react"
import { useSubscriptionCheckout } from "@/hooks/useSubscriptionCheckout"

interface PlanItem {
  itemType: string
  itemRefId: string | null
  label: string | null
  quantity: number | null
  limitValue: number | null
  limitUnit: string | null
  itemRefKey: string
}

interface CustomerPlan {
  id: string
  name: string
  tagline: string | null
  description: string | null
  planType: string | null
  currency: string
  price: { amount: string; currency: string }
  billingIntervalMonths: number | null
  durationMonths: number | null
  status: string
  currentVersionId: string | null
  versionId: string | null
  versionStatus: string | null
  items: PlanItem[]
}

function fmtMoney(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount))
  } catch {
    return `${currency} ${amount}`
  }
}

function itemLabel(item: PlanItem): string {
  if (item.label) return item.label
  const base = item.itemType.toLowerCase().replace(/_/g, " ")
  const value =
    item.limitValue !== null
      ? `${item.limitValue}${item.limitUnit ? ` ${item.limitUnit}` : ""}`
      : item.quantity && item.quantity > 1
        ? `${item.quantity}×`
        : ""
  return value ? `${base} · ${value}` : base
}

export default function PlansCatalog() {
  const [plans, setPlans] = useState<CustomerPlan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notices, setNotices] = useState<Record<string, string>>({})
  const [trialState, setTrialState] = useState<Record<string, { eligible: boolean; reason?: string | null }>>({})
  const [enrolledFree, setEnrolledFree] = useState(false)
  const checkout = useSubscriptionCheckout({
    onError: (m) => setNotices((n) => ({ ...n, checkout: m })),
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/customer/subscriptions/plans")
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load plans")
      setPlans(json.data)
    } catch (e) {
      setError((e as Error).message ?? "Failed to load plans")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkTrial = useCallback(async (planId: string) => {
    try {
      const res = await fetch(`/api/customer/subscriptions/trial?planId=${encodeURIComponent(planId)}`)
      const json = await res.json()
      if (res.ok && json.success) {
        setTrialState((s) => ({ ...s, [planId]: { eligible: json.data.eligible, reason: json.data.reason } }))
      } else {
        setTrialState((s) => ({ ...s, [planId]: { eligible: false, reason: json.error ?? "Eligibility unavailable" } }))
      }
    } catch {
      setTrialState((s) => ({ ...s, [planId]: { eligible: false, reason: "Eligibility check failed" } }))
    }
  }, [])

  const startTrial = useCallback(async (planId: string) => {
    setNotices((n) => ({ ...n, [`trial-${planId}`]: "Starting trial…" }))
    try {
      const res = await fetch("/api/customer/subscriptions/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? "Trial could not be started")
      setNotices((n) => ({ ...n, [`trial-${planId}`]: `Trial active until ${new Date(json.data.expiresAt).toDateString()}` }))
    } catch (e) {
      setNotices((n) => ({ ...n, [`trial-${planId}`]: (e as Error).message ?? "Trial could not be started" }))
    }
  }, [])

  const enrollFree = useCallback(async () => {
    setNotices((n) => ({ ...n, free: "Enrolling…" }))
    try {
      const res = await fetch("/api/customer/subscriptions/enroll-free", { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? "Free enrollment failed")
      setEnrolledFree(true)
      setNotices((n) => ({ ...n, free: "Free Forever enrollment active." }))
    } catch (e) {
      setNotices((n) => ({ ...n, free: (e as Error).message ?? "Free enrollment failed" }))
    }
  }, [])

  const subscribe = useCallback((planVersionId: string) => {
    setNotices((n) => ({ ...n, checkout: "Preparing subscription…" }))
    checkout.initiateSubscription(planVersionId)
  }, [checkout])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Plans &amp; Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Published plans only. Free Forever, 14-day trials, and paid recurring subscriptions — eligibility is verified on the server.
        </p>
      </header>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {error}</span>
          <button type="button" onClick={() => { setError(null); load() }} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-accent/10">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {notices.free && <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">{notices.free}</p>}
      {notices.checkout && <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">{notices.checkout}</p>}
      {notices["trial-free"] && <p className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">{notices["trial-free"]}</p>}

      {loading && !plans && (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading plans…
        </div>
      )}

      {plans && plans.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No published plans are available right now.
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isFree = plan.planType === "FREE"
            const trial = trialState[plan.id]
            return (
              <div key={plan.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{plan.name}</h2>
                    {plan.tagline && <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>}
                  </div>
                  {isFree ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                      <Sparkles className="h-3 w-3" /> Free Forever
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-200">
                      <CreditCard className="h-3 w-3" /> Recurring
                    </span>
                  )}
                </div>

                <p className="mt-4 text-2xl font-bold">
                  {fmtMoney(plan.price.amount, plan.currency)}
                  {!isFree && plan.billingIntervalMonths ? (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}/ {plan.billingIntervalMonths} month{plan.billingIntervalMonths > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </p>

                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {plan.items.length === 0 ? (
                    <li className="text-xs">No configured benefits.</li>
                  ) : (
                    plan.items.map((item) => (
                      <li key={item.itemType + item.itemRefKey} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span>{itemLabel(item)}</span>
                      </li>
                    ))
                  )}
                </ul>

                <div className="mt-auto pt-5">
                  {isFree ? (
                    <button type="button" onClick={enrollFree} disabled={enrolledFree || notices.free === "Enrolling…"}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
                      {enrolledFree ? "Enrolled" : "Choose Free Forever"}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button type="button" onClick={() => subscribe(plan.versionId ?? "")} disabled={!plan.versionId}
                        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                        Subscribe
                      </button>
                      <button type="button" onClick={() => (trial ? undefined : checkTrial(plan.id))} disabled={!plan.versionId}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/20 disabled:opacity-50">
                        <Clock className="h-4 w-4" /> Start 14-day trial
                      </button>
                      {trial && (
                        <p className="text-xs text-muted-foreground">
                          {trial.eligible
                            ? "Trial available. Choose it on the overview, or activate below."
                            : (trial.reason ?? "Not eligible right now")}
                        </p>
                      )}
                      {trial?.eligible && (
                        <button type="button" onClick={() => startTrial(plan.id)}
                          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                          Activate trial
                        </button>
                      )}
                      {notices[`trial-${plan.id}`] && <p className="text-xs text-blue-200">{notices[`trial-${plan.id}`]}</p>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Recurring billing:</strong> paid plans renew at the shown interval until cancelled at period end. Trials never charge automatically; conversion requires you to subscribe explicitly.</p>
        <p className="mt-2"><Link href="/dashboard/subscription" className="text-indigo-400 hover:text-indigo-300">← Back to subscription overview</Link></p>
      </div>
    </div>
  )
}
