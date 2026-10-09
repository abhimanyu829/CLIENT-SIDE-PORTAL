/**
 * components/dashboard/subscription/SubscriptionOverview.tsx
 * Phase 7 — customer subscription overview (trusted backend data only).
 */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  XCircle,
  CreditCard,
  Package,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

interface OverviewData {
  environment: string
  paidSubscriptions: Array<{
    id: string
    status: string
    planName: string | null
    planType: string | null
    billingIntervalMonths: number | null
    price: { amount: string; currency: string }
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    nextChargeLabel: string | null
    razorpaySubscriptionId: string | null
  }>
  trials: Array<{
    id: string
    planName: string | null
    status: string
    startedAt: string | null
    expiresAt: string | null
  }>
  freeEnrollments: Array<{ id: string; planName: string | null; status: string }>
  access: { entitlementKeys: string[]; storageLimit: { limitValue: number | null; limitUnit: string | null }; adminLimit: { limitValue: number | null; limitUnit: string | null } }
  billing: Array<{ kind: string; reference: string | null; amount: { amount: string; currency: string }; status: string; createdAt: string }>
}

const STATUS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Active", tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  TRIALING: { label: "Pending activation", tone: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  UNPAID: { label: "Payment pending", tone: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  PAST_DUE: { label: "Payment failed", tone: "text-red-400 bg-red-500/10 border-red-500/20" },
  PAUSED: { label: "Paused", tone: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  CANCELED: { label: "Cancelled", tone: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  EXPIRED: { label: "Expired", tone: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" },
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function fmtMoney(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount))
  } catch {
    return `${currency} ${amount}`
  }
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "text-muted-foreground bg-secondary border-border" }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>
      {s.label}
    </span>
  )
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:bg-accent/10">
            Keep subscription
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionOverview() {
  const { user } = useAuth()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; title: string; body: string; label: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/customer/subscriptions/overview")
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load overview")
      setData(json.data)
    } catch (e) {
      setError((e as Error).message ?? "Failed to load overview")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runAction = useCallback(
    async (subscriptionId: string, action: string, extra?: Record<string, unknown>) => {
      setBusyAction(subscriptionId)
      try {
        const res = await fetch("/api/customer/subscriptions/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId, action, ...extra }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? "Action failed")
        await refresh()
      } catch (e) {
        setError((e as Error).message ?? "Action failed; your subscription state was not changed.")
      } finally {
        setBusyAction(null)
        setConfirm(null)
      }
    },
    [refresh],
  )

  const effectiveSources = useMemo(() => {
    const sources: string[] = []
    if (data?.freeEnrollments.some((f) => f.status === "ACTIVE")) sources.push("Free Forever")
    if ((data?.trials ?? []).some((t) => t.status === "ACTIVE")) sources.push("Trial")
    if ((data?.paidSubscriptions ?? []).some((s) => s.status === "ACTIVE")) sources.push("Paid subscription")
    return sources
  }, [data])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Subscriptions &amp; Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your plan, trial, free enrollment and effective access — powered by your account&apos;s verified billing state.
        </p>
      </header>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => { setError(null); refresh() }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-accent/10">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your subscription state…
        </div>
      )}

      {data && (
        <>
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Effective access</h2>
              <Link href="/dashboard/subscription/plans" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                Browse plans →
              </Link>
            </div>
            {effectiveSources.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No active subscription sources yet. Explore plans to start a free enrollment, a 14-day trial, or a paid plan.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {effectiveSources.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {s}
                  </span>
                ))}
              </div>
            )}
            {data.access.entitlementKeys.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.access.entitlementKeys.map((k) => (
                  <span key={k} className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{k}</span>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                <Package className="mt-0.5 h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Storage</p>
                  <p className="font-medium">{data.access.storageLimit.limitValue === null ? "Not configured" : `${data.access.storageLimit.limitValue} ${data.access.storageLimit.limitUnit ?? "GB"}`}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                <Layers className="mt-0.5 h-4 w-4 text-violet-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Admin users</p>
                  <p className="font-medium">{data.access.adminLimit.limitValue === null ? "Not configured" : `${data.access.adminLimit.limitValue} admins`}</p>
                </div>
              </div>
            </div>
          </section>

          {data.paidSubscriptions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Paid subscriptions</h2>
              {data.paidSubscriptions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold">{s.planName ?? "Subscription"}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.billingIntervalMonths ? `Every ${s.billingIntervalMonths} month${s.billingIntervalMonths > 1 ? "s" : ""}` : ""}
                        {s.price.amount && ` · ${fmtMoney(s.price.amount, s.price.currency)}`}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    <div><p className="text-xs">Period</p><p className="text-foreground">{fmtDate(s.currentPeriodStart)} → {fmtDate(s.currentPeriodEnd)}</p></div>
                    <div><p className="text-xs">Next</p><p className="text-foreground">{s.nextChargeLabel ?? "—"}</p></div>
                    <div><p className="text-xs">Reference</p><p className="truncate font-mono text-[11px]">{s.razorpaySubscriptionId ?? "—"}</p></div>
                  </div>
                  {(s.status === "ACTIVE" || s.status === "TRIALING" || s.status === "PAST_DUE" || s.status === "PAUSED" || s.status === "UNPAID") && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {s.status === "ACTIVE" && !s.cancelAtPeriodEnd && (
                        <button type="button" disabled={busyAction === s.id} onClick={() => setConfirm({ id: s.id, title: "Cancel subscription", body: "This cancels renewals at the end of the current billing period. Access continues through your paid-through date.", label: "Cancel at period end" })}
                          className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/10 disabled:opacity-60">
                          Cancel at period end
                        </button>
                      )}
                      {s.status === "ACTIVE" && (
                        <button type="button" disabled={busyAction === s.id} onClick={() => runAction(s.id, "pause")}
                          className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/10 disabled:opacity-60">
                          Pause
                        </button>
                      )}
                      {s.status === "PAUSED" && (
                        <button type="button" disabled={busyAction === s.id} onClick={() => runAction(s.id, "resume")}
                          className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-60">
                          Resume
                        </button>
                      )}
                      {s.status === "ACTIVE" && (
                        <button type="button" disabled={busyAction === s.id} onClick={() => setConfirm({ id: s.id, title: "Cancel immediately", body: "Immediate cancellation revokes subscription access now. Standalone purchases and free access are unaffected.", label: "Cancel immediately" })}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-60">
                          Cancel immediately
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {data.trials.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Trials</h2>
              {data.trials.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium">{t.planName ?? "Trial"}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.startedAt ? `Started ${fmtDate(t.startedAt)}` : "Pending"} · {t.expiresAt ? `Expires ${fmtDate(t.expiresAt)}` : "—"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </section>
          )}

          {data.freeEnrollments.length > 0 && (
            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold">{data.freeEnrollments[0].planName ?? "Free Forever"}</p>
                  <p className="text-xs text-muted-foreground">Your free enrollment is active. No recurring charges.</p>
                </div>
              </div>
            </section>
          )}

          {data.paidSubscriptions.length === 0 && data.trials.length === 0 && data.freeEnrollments.length === 0 && (
            <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 text-base font-semibold">No subscription yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Start with a Free Forever enrollment or a 14-day trial, or subscribe to a paid plan.
              </p>
              <Link href="/dashboard/subscription/plans" className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                Browse plans
              </Link>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <CreditCard className="h-4 w-4" /> Billing history
              </h2>
              <Link href="/dashboard/invoices" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                All invoices →
              </Link>
            </div>
            {data.billing.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No billing records yet. Standalone purchase invoices appear under Invoices.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border text-sm">
                {data.billing.slice(0, 6).map((b) => (
                  <li key={b.kind + b.reference + b.createdAt} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-muted-foreground">{b.reference ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{b.kind.replace(/_/g, " ").toLowerCase()} · {fmtDate(b.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-medium">{fmtMoney(b.amount.amount, b.amount.currency)}</span>
                      <StatusBadge status={b.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {confirm && data && (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          busy={busyAction === confirm.id}
          onConfirm={() => {
            const target = data.paidSubscriptions.find((s) => s.id === confirm.id)
            if (confirm.label === "Cancel at period end") void runAction(confirm.id, "cancel", { cancelAtCycleEnd: true })
            else if (target && confirm.label === "Cancel immediately") void runAction(confirm.id, "cancel", { cancelAtCycleEnd: false })
            else if (confirm.label === "Cancel immediately") void runAction(confirm.id, "cancel", { cancelAtCycleEnd: false })
            else void runAction(confirm.id, "cancel", { cancelAtCycleEnd: false })
          }}
          onClose={() => setConfirm(null)}
        />
      )}

      {user ? null : null}
    </div>
  )
}
