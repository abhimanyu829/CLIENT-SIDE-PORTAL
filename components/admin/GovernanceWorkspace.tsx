/**
 * components/admin/GovernanceWorkspace.tsx
 * Phase 8 — SUPER_ADMIN subscription administration workspace.
 * All data/mutations flow through /api/admin/subscriptions-governance
 * (RBAC-gated server-side). No direct DB access in the UI.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  ListOrdered,
  Layers,
  UserCheck,
  AlertTriangle,
  ScrollText,
  Repeat2,
  Loader2,
  RefreshCw,
  CheckCircle2,
  CreditCard,
  Sparkles,
  Clock,
} from "lucide-react"

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "subscriptions", label: "Subscriptions", icon: ListOrdered },
  { id: "plans", label: "Plan Catalog", icon: Layers },
  { id: "enrollments", label: "Free & Trial", icon: UserCheck },
  { id: "issues", label: "Operational Issues", icon: AlertTriangle },
  { id: "audit", label: "Audit History", icon: ScrollText },
  { id: "reconciliation", label: "Reconciliation", icon: Repeat2 },
] as const

type TabId = (typeof TABS)[number]["id"]

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  TRIALING: "text-blue-300 bg-blue-500/10 border-blue-500/25",
  UNPAID: "text-amber-300 bg-amber-500/10 border-amber-500/25",
  PAST_DUE: "text-red-300 bg-red-500/10 border-red-500/25",
  PAUSED: "text-purple-300 bg-purple-500/10 border-purple-500/25",
  CANCELED: "text-zinc-400 bg-zinc-500/10 border-zinc-500/25",
  EXPIRED: "text-zinc-500 bg-zinc-500/10 border-zinc-500/25",
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "text-muted-foreground bg-secondary border-border"
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
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
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        <label className="mt-4 block text-xs text-muted-foreground">
          Reason (recorded in audit)
          <input
            id="reason"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            defaultValue="Administrative action"
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent/10">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const reason = (document.getElementById("reason") as HTMLInputElement | null)?.value ?? ""
              onConfirm()
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GovernanceWorkspace({ isSuperAdmin, adminId }: { isSuperAdmin: boolean; adminId: string }) {
  const [tab, setTab] = useState<TabId>("overview")
  const [meta, setMeta] = useState<Record<string, unknown>>({})
  const [subs, setSubs] = useState<Array<Record<string, unknown>> | null>(null)
  const [plans, setPlans] = useState<Array<Record<string, unknown>> | null>(null)
  const [trials, setTrials] = useState<Array<Record<string, unknown>> | null>(null)
  const [frees, setFrees] = useState<Array<Record<string, unknown>> | null>(null)
  const [issues, setIssues] = useState<Array<Record<string, unknown>> | null>(null)
  const [audit, setAudit] = useState<Array<Record<string, unknown>> | null>(null)
  const [recon, setRecon] = useState<{ runs: Array<Record<string, unknown>>; findings: Array<Record<string, unknown>> } | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: string; label: string; body: string; extra?: Record<string, unknown> } | null>(null)
  const [filters, setFilters] = useState({ status: "", planType: "", search: "" })

  const get = useCallback(async (url: string): Promise<Record<string, unknown>> => {
    const res = await fetch(url)
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed")
    return json as Record<string, unknown>
  }, [])

  const post = useCallback(async (url: string, body?: unknown): Promise<Record<string, unknown>> => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed")
    return json as Record<string, unknown>
  }, [])

  const refresh = useCallback(
    async (target: TabId) => {
      setError(null)
      try {
        if (target === "overview") setMeta((await get("/api/admin/subscriptions-governance/overview")).data as never)
        if (target === "subscriptions") {
          const q = new URLSearchParams()
          if (filters.status) q.set("status", filters.status)
          if (filters.planType) q.set("planType", filters.planType)
          if (filters.search) q.set("search", filters.search)
          setSubs((await get(`/api/admin/subscriptions-governance/subscriptions?${q.toString()}`)).data as never)
        }
        if (target === "plans") setPlans((await get("/api/admin/subscriptions-governance/plans")).data as never)
        if (target === "enrollments") {
          setTrials((await get("/api/admin/subscriptions-governance/enrollments?type=trial")).data as never)
          setFrees((await get("/api/admin/subscriptions-governance/enrollments?type=free")).data as never)
        }
        if (target === "issues") setIssues((await get("/api/admin/subscriptions-governance/issues")).data as never)
        if (target === "audit") setAudit((await get("/api/admin/subscriptions-governance/audit")).data as never)
        if (target === "reconciliation") setRecon((await get("/api/admin/subscriptions-governance/reconciliation")).data as never)
      } catch (e) {
        setError((e as Error).message ?? "Failed to load")
      }
    },
    [get, filters],
  )

  useEffect(() => {
    refresh(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const openDetail = useCallback(
    async (id: string) => {
      setBusy(id)
      try {
        setDetail((await get(`/api/admin/subscriptions-governance/subscriptions/${encodeURIComponent(id)}`)).data as never)
      } catch (e) {
        setError((e as Error).message ?? "Failed to load detail")
      } finally {
        setBusy(null)
      }
    },
    [get],
  )

  const runAction = useCallback(
    async (id: string, action: string, extra?: Record<string, unknown>) => {
      setBusy(id)
      try {
        const reason = typeof document !== "undefined" ? (document.getElementById("reason") as HTMLInputElement | null)?.value ?? undefined : undefined
        await post(`/api/admin/subscriptions-governance/subscriptions/${encodeURIComponent(id)}/actions`, { action, reason, ...extra })
        await refresh("subscriptions")
        if (detail) await openDetail(id)
      } catch (e) {
        setError((e as Error).message ?? "Action failed")
      } finally {
        setBusy(null)
        setConfirm(null)
      }
    },
    [post, refresh, detail, openDetail],
  )

  const planOp = useCallback(
    async (op: string, planId: string, extra?: Record<string, unknown>) => {
      setBusy(`${op}:${planId}`)
      try {
        const reason = typeof document !== "undefined" ? (document.getElementById("reason") as HTMLInputElement | null)?.value ?? undefined : undefined
        await post(`/api/admin/subscriptions-governance/plans/${encodeURIComponent(planId)}`, { op, reason, ...extra })
        await refresh("plans")
      } catch (e) {
        setError((e as Error).message ?? "Plan operation failed")
      } finally {
        setBusy(null)
        setConfirm(null)
      }
    },
    [post, refresh],
  )

  const reconAction = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      setBusy(`recon:${action}`)
      try {
        await post("/api/admin/subscriptions-governance/reconciliation", { action, ...extra })
        await refresh("reconciliation")
      } catch (e) {
        setError((e as Error).message ?? "Reconciliation action failed")
      } finally {
        setBusy(null)
      }
    },
    [post, refresh],
  )

  const metricCards = (meta.records as Record<string, number>) ?? {}

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Governance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operation &amp; administration over Phases 1–7 ({isSuperAdmin ? "SUPER_ADMIN" : "SUB_ADMIN"}) · read-only inspection + supported lifecycle actions.
          </p>
        </div>
        <button type="button" onClick={() => refresh(tab)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-accent/10">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Governance sections">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium ${tab === t.id ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200" : "border-border text-muted-foreground hover:bg-accent/10"}`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          )
        })}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Paid active", "paidActive", "text-emerald-300"],
              ["Pending activation", "pendingActivation", "text-blue-300"],
              ["Payment failed", "pastDue", "text-red-300"],
              ["Paused", "paused", "text-purple-300"],
              ["Expired", "expired", "text-zinc-400"],
              ["Scheduled cancellations", "scheduledCancellations", "text-amber-300"],
              ["Active trials", "activeTrials", "text-blue-300"],
              ["Trials expiring ≤7d", "trialsExpiringSoon", "text-orange-300"],
              ["Free enrollments", "freeEnrollments", "text-emerald-300"],
              ["Provisioning failures", "provisioningFailures", "text-red-300"],
              ["Charge failures", "chargeFailures", "text-red-300"],
              ["Failed webhooks", "webhookFailures", "text-red-300"],
            ] as Array<[string, string, string]>
          ).map(([label, key, color]) => (
            <div key={key} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{String(metricCards[key] ?? 0)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Search id / customer / email"
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm" />
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm">
              <option value="">All statuses</option>
              {["ACTIVE", "TRIALING", "UNPAID", "PAST_DUE", "PAUSED", "CANCELED", "EXPIRED"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={filters.planType} onChange={(e) => setFilters((f) => ({ ...f, planType: e.target.value }))} className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm">
              <option value="">All plan types</option>
              {["FREE", "MONTHLY", "THREE_MONTH", "SIX_MONTH"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <button type="button" onClick={() => refresh("subscriptions")} className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">Apply</button>
          </div>

          {!subs ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
          ) : subs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No subscriptions match.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Subscription / Customer</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Provider ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subs.map((s) => (
                    <tr key={s.id as string} className="hover:bg-accent/5">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openDetail(s.id as string)} className="font-medium text-indigo-300 hover:text-indigo-200">{s.id as string}</button>
                        <p className="text-xs text-muted-foreground">{String(s.customerName ?? "—")} · {String(s.customerEmail ?? "—")}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{String(s.planName ?? "—")}</p>
                        <p className="text-xs text-muted-foreground">{String(s.planType ?? "")} {s.planVersionId ? `· v${String(s.planVersionId)}` : ""}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status as string} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.currentPeriodStart as string)} → {fmtDate(s.currentPeriodEnd as string)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{String(s.razorpaySubscriptionId ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detail && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Subscription {(detail.subscription as Record<string, unknown>)?.id as string}</h2>
                <StatusBadge status={((detail.subscription as Record<string, unknown>)?.status ?? "") as string} />
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                {(["planName", "planType", "currentPeriodStart", "currentPeriodEnd", "razorpaySubscriptionId", "environment"] as const).map((k) => (
                  <div key={k} className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="break-all font-medium">{String((detail.subscription as Record<string, unknown>)?.[k] ?? "—")}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busy === (detail as Record<string, unknown>).busy} onClick={() => setConfirm({ id: (detail.subscription as Record<string, unknown>).id as string, action: "cancel", label: "Cancel at period end", body: "Stops renewals at the end of the verified current period. Access continues through the paid-through date." })}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent/10">Cancel at period end</button>
                <button type="button" onClick={() => setConfirm({ id: (detail.subscription as Record<string, unknown>).id as string, action: "cancel-now", label: "Cancel immediately", body: "Immediate cancellation; subscription-sourced access is revoked. Standalone/free access is unaffected." })}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20">Cancel immediately</button>
                <button type="button" onClick={() => setConfirm({ id: (detail.subscription as Record<string, unknown>).id as string, action: "pause", label: "Pause", body: "Pauses the subscription at the provider (if supported by the current state)." })}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent/10">Pause</button>
                <button type="button" onClick={() => setConfirm({ id: (detail.subscription as Record<string, unknown>).id as string, action: "resume", label: "Resume", body: "Resumes a paused subscription." })}
                  className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20">Resume</button>
              </div>
              <DetailPanels detail={detail} />
            </section>
          )}
        </div>
      )}

      {tab === "plans" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Plan governance reuses the Phase-2 catalog services. Published versions are immutable — changes create a new draft.</p>
          {!plans ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plans.map((p) => (
                    <tr key={p.id as string} className="hover:bg-accent/5">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.name as string}</p>
                        <p className="text-xs font-mono text-muted-foreground">{p.slug as string}{p.currentVersionId ? ` · v:${p.currentVersionId}` : ""}</p>
                      </td>
                      <td className="px-4 py-3">{String(p.planType ?? "—")}</td>
                      <td className="px-4 py-3">{String(p.price ?? p.basePrice ?? "—")} {String(p.currency ?? "")}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status as string} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" disabled={busy === `publish:${p.id}`} onClick={() => setConfirm({ id: p.id as string, action: "publish", label: "Publish plan", body: "Validates and publishes the current draft version. Published versions are immutable." })} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20">Publish</button>
                          <button type="button" disabled={busy === `pause:${p.id}`} onClick={() => setConfirm({ id: p.id as string, action: "pause", label: "Pause plan", body: "Plan is no longer offered for new enrollment. Existing subscriptions are unaffected." })} className="rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-accent/10">Pause</button>
                          <button type="button" disabled={busy === `archive:${p.id}`} onClick={() => setConfirm({ id: p.id as string, action: "archive", label: "Archive plan", body: "Terminal archive: not offered for new enrollment. History is preserved." })} className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20">Archive</button>
                          <button type="button" disabled={busy === `draft:${p.id}`} onClick={() => planOp("create-draft-version", p.id as string)} className="rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-accent/10">New draft version</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "enrollments" && (
        <div className="space-y-6">
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Clock className="h-4 w-4" /> Trial enrollments</h2>
            <EnrollmentTable rows={trials} />
          </section>
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Sparkles className="h-4 w-4" /> Free Forever enrollments</h2>
            <EnrollmentTable rows={frees} />
          </section>
        </div>
      )}

      {tab === "issues" && (
        <div className="space-y-2">
          {!issues ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
          ) : issues.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No operational issues.</div>
          ) : (
            issues.map((i) => (
              <div key={i.id as string} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{i.kind as string} · {i.status as string}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(i.createdAt as string)}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{i.reference as string}</p>
                {i.error ? <p className="mt-1 text-xs text-red-200/80">{String(i.error)}</p> : null}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-2">
          {!audit ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
          ) : audit.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No audit records yet.</div>
          ) : (
            audit.map((a) => (
              <div key={a.id as string} className="rounded-xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{a.action as string}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(a.createdAt as string)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">actor {(a.actorId as string) ?? "system"} · {(a.entity as string) ?? ""} {(a.entityId as string) ?? ""}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "reconciliation" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy === "recon:run"} onClick={() => reconAction("run", { mode: "DETECT_ONLY" })}
              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">Run detection</button>
            <button type="button" disabled={busy === "recon:run"} onClick={() => reconAction("run", { mode: "DRY_RUN" })}
              className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-accent/10 disabled:opacity-60">Dry run</button>
            <button type="button" disabled={busy === "recon:run"} onClick={() => reconAction("run", { mode: "SAFE_AUTO_REPAIR" })}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60">Safe auto-repair run</button>
            <span className="text-[11px] text-muted-foreground">Detection is the default; auto-repair is limited to the verified allow-list (idempotent Phase 5/6/3 operations).</span>
          </div>
          {!recon ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
          ) : (
            <>
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Runs</h2>
                <div className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Scanned</th><th className="px-4 py-3">Findings</th><th className="px-4 py-3">Repaired</th><th className="px-4 py-3">Errors</th><th className="px-4 py-3">Started</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(recon.runs ?? []).map((r) => (
                        <tr key={r.id as string}>
                          <td className="px-4 py-3 font-mono text-xs">{r.mode as string}</td>
                          <td className="px-4 py-3"><StatusBadge status={r.status as string} /></td>
                          <td className="px-4 py-3">{String(r.scanned ?? 0)}</td>
                          <td className="px-4 py-3">{String(r.findings ?? 0)}</td>
                          <td className="px-4 py-3 text-emerald-300">{String(r.repaired ?? 0)}</td>
                          <td className="px-4 py-3 text-red-300">{String(r.errors ?? 0)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.startedAt as string)}</td>
                        </tr>
                      ))}
                      {(recon.runs ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">No runs yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Findings</h2>
                <div className="mt-2 space-y-2">
                  {(recon.findings ?? []).length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No findings.</div>}
                  {(recon.findings ?? []).map((f) => (
                    <div key={f.id as string} className="rounded-xl border border-border bg-card p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{String(f.category)} <span className="text-xs text-muted-foreground">({String(f.severity)})</span></span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={f.status as string} />
                          {f.repairable && f.status !== "RESOLVED" ? (
                            <button type="button" disabled={busy === "recon:repair"} onClick={() => reconAction("repair", { findingId: f.id })}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20">Repair</button>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{String(f.entityType)} / {String(f.entityId)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">observed: {JSON.stringify(f.observedValue)} · expected: {JSON.stringify(f.expectedValue)}</p>
                      {f.resolutionNote ? <p className="mt-1 text-xs text-amber-200/90">{String(f.resolutionNote)}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.label}
          body={confirm.body}
          confirmLabel={confirm.label}
          busy={busy === confirm.id}
          onConfirm={() => {
            const map: Record<string, string> = { "cancel": "cancel", "cancel-now": "cancel", "pause": "pause", "resume": "resume" }
            const action = map[confirm.action] ?? confirm.action
            if (confirm.action === "cancel-now") runAction(confirm.id, "cancel", { cancelAtCycleEnd: false })
            else if (["cancel", "pause", "resume"].includes(action)) runAction(confirm.id, action, action === "cancel" ? { cancelAtCycleEnd: true } : undefined)
            else planOp(action, confirm.id)
          }}
          onClose={() => setConfirm(null)}
        />
      )}

      {/* eslint-disable-next-line react/no-unescaped-entities */}
      <p className="text-xs text-muted-foreground">Workspace identity: {(isSuperAdmin ? "SUPER_ADMIN" : "SUB_ADMIN")} ({adminId})</p>
    </div>
  )
}

function EnrollmentTable({ rows }: { rows: Array<Record<string, unknown>> | null }) {
  if (!rows) return <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-8 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">None found.</div>
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-4 py-3">Enrollment</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Window</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id as string} className="hover:bg-accent/5">
              <td className="px-4 py-3 font-mono text-xs">{r.id as string}</td>
              <td className="px-4 py-3">{String(r.customerName ?? "—")}<br /><span className="text-xs text-muted-foreground">{String(r.customerEmail ?? "")}</span></td>
              <td className="px-4 py-3"><StatusBadge status={r.status as string} /></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.startedAt as string)} → {fmtDate(r.expiresAt as string)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailPanels({ detail }: { detail: Record<string, unknown> }) {
  const grants = (detail.grants ?? []) as Array<Record<string, unknown>>
  const provisionings = (detail.provisionings ?? []) as Array<Record<string, unknown>>
  const audits = (detail.audits ?? []) as Array<Record<string, unknown>>
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entitlement grants</h3>
        {grants.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No subscription-sourced grants.</p> :
          <ul className="mt-2 space-y-1.5 text-xs">
            {grants.map((g) => (
              <li key={g.id as string} className="rounded-lg border border-border p-2">
                <span className="font-mono">{g.entitlementKey as string}</span> · <StatusBadge status={g.status as string} />
                <p className="mt-1 text-muted-foreground">{fmtDate(g.startsAt as string)} → {fmtDate(g.expiresAt as string)}</p>
              </li>
            ))}
          </ul>}
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provisioning operations</h3>
        {provisionings.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">None recorded.</p> :
          <ul className="mt-2 space-y-1.5 text-xs">
            {provisionings.map((p) => (
              <li key={p.id as string} className="rounded-lg border border-border p-2">
                {p.operation as string} · <StatusBadge status={p.status as string} />
                {p.errorMessage ? <p className="mt-1 text-red-300/80">{p.errorMessage as string}</p> : null}
              </li>
            ))}
          </ul>}
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administrative history</h3>
        {audits.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No audit entries.</p> :
          <ul className="mt-2 space-y-1.5 text-xs">
            {audits.map((a) => (
              <li key={a.id as string} className="rounded-lg border border-border p-2">
                <span className="font-mono">{a.action as string}</span>
                <p className="mt-1 text-muted-foreground">{(a.actorId as string) ?? "system"} · {fmtDate(a.createdAt as string)}</p>
              </li>
            ))}
          </ul>}
      </div>
    </div>
  )
}
