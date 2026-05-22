"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  ChevronLeft, ChevronRight, Download, Calendar, AlertCircle,
  Play, Pause, X, RotateCcw, Clock, ChevronDown, ChevronUp
} from "lucide-react"
import { cn } from "@/lib/utils"

const STATUSES = ["ALL", "ACTIVE", "TRIALING", "PAUSED", "PAST_DUE", "CANCELLED"]

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30",
  TRIALING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
  PAUSED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30",
  PAST_DUE: "bg-red-200 text-red-800 dark:bg-red-900/30",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-800",
}

const CHURN_DATA = [
  { name: "Pricing", value: 35, color: "#ef4444" },
  { name: "Feature Gap", value: 25, color: "#f97316" },
  { name: "Competitor", value: 20, color: "#eab308" },
  { name: "Budget", value: 12, color: "#8b5cf6" },
  { name: "Other", value: 8, color: "#6b7280" },
]

interface Subscription {
  id: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEndsAt: string | null
  cancelledAt: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
  product: { id: string; name: string; type: string }
  tier: { name: string; price: string; interval: string }
  payments: Array<{ id: string; amount: string; status: string; createdAt: string }>
}

interface Props {
  subscriptions: Subscription[]
  total: number
  page: number
  limit: number
  activeStatus: string
  statusCounts: number[]
  upcomingRenewals: Subscription[]
  dunningQueue: Subscription[]
}

function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default function SubscriptionsClient({
  subscriptions, total, page, limit, activeStatus, statusCounts, upcomingRenewals, dunningQueue
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<{ subId: string; action: string; title: string; desc: string } | null>(null)
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null)
  const [renewalWindow, setRenewalWindow] = useState(7)
  const [extendDays, setExtendDays] = useState("14")
  const totalPages = Math.ceil(total / limit)

  const navigateStatus = (s: string) => {
    const params = new URLSearchParams()
    if (s !== "ALL") params.set("status", s)
    params.set("page", "1")
    router.push(`/admin/subscriptions?${params.toString()}`)
  }

  const handleAction = async (reason: string) => {
    if (!dialog) return
    const res = await fetch(`/api/admin/subscriptions/${dialog.subId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: dialog.action, reason, extendDays: Number(extendDays) }),
    })
    if (!res.ok) throw new Error(await res.text())
    toast({ title: "Done", description: `${dialog.action} completed` })
    startTransition(() => router.refresh())
  }

  const exportCSV = () => {
    const rows = [
      ["ID", "User", "Product", "Plan", "Status", "MRR", "Period End"],
      ...subscriptions.map((s) => [
        s.id, s.user.name, s.product.name, s.tier.name, s.status,
        `$${s.tier.price}`, s.currentPeriodEnd.slice(0, 10)
      ])
    ]
    const csv = rows.map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const renewalsFiltered = upcomingRenewals.filter((r) => daysUntil(r.currentPeriodEnd) <= renewalWindow)
  const revenueAtRisk = renewalsFiltered.reduce((s, r) => s + Number(r.tier.price), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Subscription Control</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total subscriptions</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s, i) => {
          const count = s === "ALL" ? total : statusCounts[i - 1] ?? 0
          const isActive = (activeStatus === "" && s === "ALL") || activeStatus === s
          return (
            <button
              key={s}
              onClick={() => navigateStatus(s)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              )}
            >
              {s.replace("_", " ")}
              <span className={cn(
                "ml-2 px-1.5 py-0.5 rounded-full text-xs",
                isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-xl border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["User", "Product / Plan", "Status", "MRR", "Period End", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscriptions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No subscriptions</td></tr>
              ) : subscriptions.map((sub) => (
                <>
                  <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{sub.user.name}</p>
                      <p className="text-xs text-muted-foreground">{sub.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{sub.product.name}</p>
                      <p className="text-xs text-muted-foreground">{sub.tier.name} · {sub.tier.interval}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[sub.status] ?? "")}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">${sub.tier.price}</td>
                    <td className="px-4 py-3 text-xs">{sub.currentPeriodEnd.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/80"
                          onClick={() => setExpandedTimeline(expandedTimeline === sub.id ? null : sub.id)}
                        >
                          {expandedTimeline === sub.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {sub.status === "ACTIVE" && (
                          <button onClick={() => setDialog({ subId: sub.id, action: "cancel", title: "Cancel Subscription", desc: "This will cancel the subscription immediately." })}
                            className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Cancel</button>
                        )}
                        {sub.status === "ACTIVE" && (
                          <button onClick={() => setDialog({ subId: sub.id, action: "pause", title: "Pause Subscription", desc: "Pausing suspends billing and access." })}
                            className="text-[10px] px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200">Pause</button>
                        )}
                        {sub.status === "PAUSED" && (
                          <button onClick={() => setDialog({ subId: sub.id, action: "resume", title: "Resume Subscription", desc: "Billing will resume from today." })}
                            className="text-[10px] px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Resume</button>
                        )}
                        {(sub.status === "ACTIVE" || sub.status === "TRIALING") && (
                          <button onClick={() => setDialog({ subId: sub.id, action: "extend-trial", title: "Extend Trial", desc: `Extend trial by ${extendDays} days.` })}
                            className="text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">+Trial</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedTimeline === sub.id && (
                    <tr key={`${sub.id}-timeline`}>
                      <td colSpan={6} className="px-6 py-4 bg-muted/20">
                        <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Lifecycle Timeline</div>
                        <ol className="relative border-l border-border ml-3 space-y-3">
                          <li className="ml-4">
                            <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-emerald-500" />
                            <p className="font-medium">Subscription Created</p>
                            <p className="text-muted-foreground">{new Date(sub.createdAt).toLocaleString()}</p>
                          </li>
                          {sub.trialEndsAt && (
                            <li className="ml-4">
                              <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500" />
                              <p className="font-medium">Trial Ends</p>
                              <p className="text-muted-foreground">{new Date(sub.trialEndsAt).toLocaleDateString()}</p>
                            </li>
                          )}
                          {sub.payments.map((p, i) => (
                            <li key={p.id} className="ml-4">
                              <span className={cn("absolute -left-1.5 w-3 h-3 rounded-full", p.status === "SUCCESS" ? "bg-emerald-400" : "bg-red-400")} />
                              <p className="font-medium">Payment #{i + 1} — ${p.amount}</p>
                              <p className="text-muted-foreground">{p.createdAt.slice(0, 10)} · {p.status}</p>
                            </li>
                          ))}
                          {sub.cancelledAt && (
                            <li className="ml-4">
                              <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-red-500" />
                              <p className="font-medium text-red-600">Cancelled</p>
                              <p className="text-muted-foreground">{new Date(sub.cancelledAt).toLocaleString()}</p>
                            </li>
                          )}
                          <li className="ml-4">
                            <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-gray-400" />
                            <p className="font-medium">Next Renewal</p>
                            <p className="text-muted-foreground">{sub.currentPeriodEnd.slice(0, 10)}</p>
                          </li>
                        </ol>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-4 border-t bg-muted/20">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} total</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => router.push(`/admin/subscriptions?page=${page - 1}&status=${activeStatus}`)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => router.push(`/admin/subscriptions?page=${page + 1}&status=${activeStatus}`)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dunning Queue */}
        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold">Dunning Queue</h2>
            <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{dunningQueue.length}</span>
          </div>
          <div className="divide-y">
            {dunningQueue.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No past-due subscriptions</p>
            ) : dunningQueue.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{d.user.name}</p>
                  <p className="text-xs text-muted-foreground">{d.payments.length} failed payment(s)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-red-600">Retry {Math.min(d.payments.length, 3)}/3</p>
                  <p className="text-xs text-muted-foreground">${d.tier.price}/mo</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Churn Analytics */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold mb-3">Churn Reasons</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={CHURN_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                {CHURN_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: any) => [`${v}%`, ""]} />
              <Legend iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Renewals */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b flex items-center gap-3 flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Upcoming Renewals</h2>
          <div className="flex gap-2 ml-auto">
            {[7, 14, 30].map((w) => (
              <button key={w} onClick={() => setRenewalWindow(w)}
                className={cn("text-xs px-3 py-1 rounded-full border transition-colors",
                  renewalWindow === w ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border"
                )}>
                {w}d
              </button>
            ))}
          </div>
          <span className="text-sm font-semibold text-emerald-600">Revenue at risk: ${revenueAtRisk.toFixed(0)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30">
              {["User", "Product / Plan", "Renews In", "Amount"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y">
              {renewalsFiltered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">No renewals in {renewalWindow} days</td></tr>
              ) : renewalsFiltered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2"><p>{r.user.name}</p><p className="text-xs text-muted-foreground">{r.user.email}</p></td>
                  <td className="px-4 py-2 text-xs">{r.product.name} · {r.tier.name}</td>
                  <td className="px-4 py-2"><span className={cn("text-xs px-2 py-0.5 rounded-full", daysUntil(r.currentPeriodEnd) <= 3 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>{daysUntil(r.currentPeriodEnd)}d</span></td>
                  <td className="px-4 py-2 font-semibold">${r.tier.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        onConfirm={handleAction}
        title={dialog?.title ?? ""}
        description={dialog?.desc ?? ""}
        destructive={dialog?.action !== "resume" && dialog?.action !== "extend-trial"}
      />
    </div>
  )
}
