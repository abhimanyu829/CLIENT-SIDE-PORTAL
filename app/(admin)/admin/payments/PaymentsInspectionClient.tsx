/**
 * PaymentsInspectionClient.tsx
 *
 * Enterprise admin panel for payment inspection:
 * - Checkout failure inspection with Razorpay gateway state
 * - Pending payment reconciliation
 * - Failed payment analysis with failure reasons
 * - Recent successful payments overview
 * - Webhook failure correlation
 */
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Webhook,
  CreditCard,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckoutFailure {
  id: string
  orderNumber: string
  status: string
  gateway: string
  grandTotal: string
  currency: string
  createdAt: string
  user: { id: string; name: string; email: string }
  items: Array<{ name: string; tier: string; interval: string }>
  payment: {
    id: string
    status: string
    gatewayPaymentId: string | null
    gatewayOrderId: string | null
    failureReason: string | null
    createdAt: string
  } | null
}

interface PaymentRecord {
  id: string
  status: string
  amount: string
  currency: string
  gateway: string
  gatewayPaymentId: string | null
  gatewayOrderId: string | null
  failureReason: string | null
  createdAt: string
  paidAt: string | null
  user: { id: string; name: string; email: string }
  invoice?: { id: string; number: string; status: string } | null
  order?: { id: string; orderNumber: string; grandTotal: string; currency: string } | null
}

interface RefundRequestRow {
  id: string
  status: string
  reason: string
  refundAmount: string | null
  currency: string | null
  gateway: string | null
  gatewayRefundId: string | null
  resolvedAt: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
}

interface Counts {
  successCount: number
  failedCount: number
  pendingCount: number
  refundedCount: number
  disputedCount: number
  webhookFailures: number
}

interface Props {
  tab: string
  gateway: string
  page: number
  limit: number
  failuresTotal: number
  checkoutFailures: CheckoutFailure[]
  recentSuccessful: PaymentRecord[]
  pendingPayments: PaymentRecord[]
  failedPayments: PaymentRecord[]
  refundRequests: RefundRequestRow[]
  counts: Counts
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function fmtMoney(amount: string | number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency, maximumFractionDigits: 2,
  }).format(Number(amount))
}

const STATUS_STYLE: Record<string, string> = {
  SUCCESS:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PENDING:  "bg-amber-500/10  text-amber-400  border-amber-500/20",
  FAILED:   "bg-red-500/10    text-red-400    border-red-500/20",
  REFUNDED: "bg-zinc-500/10   text-zinc-400   border-zinc-500/20",
  DISPUTED: "bg-orange-500/10 text-orange-400 border-orange-500/20",
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-black mt-1 ${color}`}>{value.toLocaleString()}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center opacity-80 ${color} bg-current/10`}>
        {icon}
      </div>
    </div>
  )
}

// ── Checkout Failures Tab ─────────────────────────────────────────────────────

function CheckoutFailuresTab({
  failures,
  total,
  page,
  limit,
}: {
  failures: CheckoutFailure[]
  total: number
  page: number
  limit: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)
  const [reconcileResult, setReconcileResult] = useState<Record<string, string>>({})

  const totalPages = Math.ceil(total / limit)

  const handleReconcile = async (orderId: string) => {
    setReconcilingId(orderId)
    try {
      const res = await fetch(`/api/payments/razorpay/status?orderId=${orderId}`)
      const json = await res.json()
      if (json.success) {
        const status = json.data?.paymentStatus ?? json.data?.order?.status ?? "unknown"
        setReconcileResult(prev => ({ ...prev, [orderId]: status }))
        if (json.data?.paymentStatus === "SUCCESS") {
          startTransition(() => router.refresh())
        }
      } else {
        setReconcileResult(prev => ({ ...prev, [orderId]: `error: ${json.error?.message ?? "unknown"}` }))
      }
    } catch (err) {
      setReconcileResult(prev => ({ ...prev, [orderId]: "network error" }))
    } finally {
      setReconcilingId(null)
    }
  }

  if (failures.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
        <p className="text-zinc-300 font-semibold">No checkout failures</p>
        <p className="text-zinc-600 text-sm mt-1">All recent checkouts completed successfully.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {["Order", "Customer", "Amount", "Status", "Payment State", "Failure Reason", "Created", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {failures.map(f => {
              const reconciled = reconcileResult[f.id]
              return (
                <tr key={f.id} className="hover:bg-zinc-900/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-white">{f.orderNumber}</p>
                    <p className="text-[10px] text-zinc-600">{f.gateway}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-zinc-200">{f.user.name}</p>
                    <p className="text-xs text-zinc-500">{f.user.email}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-white">{fmtMoney(f.grandTotal, f.currency)}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3">
                    {f.payment ? (
                      <div className="space-y-1">
                        <StatusBadge status={f.payment.status} />
                        {f.payment.gatewayOrderId && (
                          <p className="text-[10px] text-zinc-600 font-mono">{f.payment.gatewayOrderId.slice(0, 20)}…</p>
                        )}
                        {reconciled && (
                          <p className={`text-[10px] font-semibold ${reconciled === "SUCCESS" ? "text-emerald-400" : "text-amber-400"}`}>
                            Razorpay: {reconciled}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">No payment attempt</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-red-400 max-w-[200px] truncate">
                      {f.payment?.failureReason ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(f.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {f.payment?.gatewayOrderId && (
                        <button
                          onClick={() => handleReconcile(f.id)}
                          disabled={reconcilingId === f.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                          title="Reconcile with Razorpay"
                        >
                          {reconcilingId === f.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Reconcile
                        </button>
                      )}
                      {f.payment?.gatewayOrderId && (
                        <a
                          href={`https://dashboard.razorpay.com/app/orders/${f.payment.gatewayOrderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          title="Open in Razorpay dashboard"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">Page {page} of {totalPages} — {total} total</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || isPending}
              onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.set("page", String(page - 1))
                startTransition(() => router.push(url.pathname + "?" + url.searchParams.toString()))
              }}
              className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= totalPages || isPending}
              onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.set("page", String(page + 1))
                startTransition(() => router.push(url.pathname + "?" + url.searchParams.toString()))
              }}
              className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-40 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Payments List Tab ─────────────────────────────────────────────────────────

function PaymentsList({ payments, emptyMsg }: { payments: PaymentRecord[]; emptyMsg: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-zinc-500 text-sm">{emptyMsg}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            {["Payment ID", "Customer", "Amount", "Gateway Order ID", "Status", "Failure Reason", "Date", "Detail"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {payments.map(p => (
            <>
              <tr key={p.id} className="hover:bg-zinc-900/60 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-zinc-300">{p.gatewayPaymentId?.slice(0, 20) ?? p.id.slice(0, 12)}…</p>
                  {p.order && <p className="text-[10px] text-zinc-600 font-mono">{p.order.orderNumber}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-zinc-200">{p.user.name}</p>
                  <p className="text-xs text-zinc-500">{p.user.email}</p>
                </td>
                <td className="px-4 py-3 font-bold text-white">{fmtMoney(p.amount, p.currency)}</td>
                <td className="px-4 py-3">
                  {p.gatewayOrderId ? (
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-zinc-400">{p.gatewayOrderId.slice(0, 18)}…</span>
                      <a
                        href={`https://dashboard.razorpay.com/app/orders/${p.gatewayOrderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-600 hover:text-zinc-400 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3">
                  <p className="text-xs text-red-400 max-w-[160px] truncate">{p.failureReason ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setExpanded(e => e === p.id ? null : p.id)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              {expanded === p.id && (
                <tr key={`${p.id}-detail`}>
                  <td colSpan={8} className="px-6 py-4 bg-zinc-900/80 border-t border-zinc-800">
                    <div className="grid grid-cols-2 gap-4 text-xs text-zinc-400">
                      <div><span className="text-zinc-600 uppercase text-[10px] tracking-wider">Full Payment ID</span><p className="font-mono mt-0.5 text-zinc-300 break-all">{p.id}</p></div>
                      <div><span className="text-zinc-600 uppercase text-[10px] tracking-wider">Gateway Payment ID</span><p className="font-mono mt-0.5 text-zinc-300 break-all">{p.gatewayPaymentId ?? "—"}</p></div>
                      <div><span className="text-zinc-600 uppercase text-[10px] tracking-wider">Gateway Order ID</span><p className="font-mono mt-0.5 text-zinc-300 break-all">{p.gatewayOrderId ?? "—"}</p></div>
                      <div><span className="text-zinc-600 uppercase text-[10px] tracking-wider">Invoice</span><p className="mt-0.5">{p.invoice ? `${p.invoice.number} (${p.invoice.status})` : "Not generated"}</p></div>
                      <div><span className="text-zinc-600 uppercase text-[10px] tracking-wider">Paid At</span><p className="mt-0.5">{p.paidAt ? fmtDate(p.paidAt) : "—"}</p></div>
                      <div><span className="text-zinc-600 uppercase text-[10px] tracking-wider">Gateway</span><p className="mt-0.5 font-semibold text-zinc-300">{p.gateway}</p></div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Refund Requests Tab ───────────────────────────────────────────────────────

const REFUND_STATUS_STYLE: Record<string, string> = {
  PENDING:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PROCESSED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DENIED:    "bg-red-500/10 text-red-400 border-red-500/20",
  FAILED:    "bg-red-500/10 text-red-400 border-red-500/20",
}

function RefundRequestsTab({ refunds }: { refunds: RefundRequestRow[] }) {
  const [actionId, setActionId] = useState<string | null>(null)

  const handleAction = async (refundId: string, action: "approve" | "deny") => {
    setActionId(refundId)
    try {
      const res = await fetch(`/api/admin/refunds/${refundId}/${action}`, { method: "POST" })
      if (res.ok) {
        window.location.reload()
      } else {
        const json = await res.json()
        alert(`Failed: ${json.error ?? "Unknown error"}`)
      }
    } catch (err) {
      alert("Network error")
    } finally {
      setActionId(null)
    }
  }

  if (refunds.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
        <RotateCcw className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 font-semibold">No refund requests</p>
        <p className="text-zinc-600 text-sm mt-1">Refund requests will appear here when customers submit them.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            {["Request ID", "Customer", "Amount", "Gateway", "Reason", "Status", "Submitted", "Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {refunds.map(r => (
            <tr key={r.id} className="hover:bg-zinc-900/60 transition-colors">
              <td className="px-4 py-3">
                <p className="font-mono text-[10px] text-zinc-400">{r.id.slice(0, 8)}…</p>
                {r.gatewayRefundId && (
                  <p className="font-mono text-[10px] text-zinc-600">{r.gatewayRefundId.slice(0, 16)}…</p>
                )}
              </td>
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-zinc-200">{r.user.name}</p>
                <p className="text-xs text-zinc-500">{r.user.email}</p>
              </td>
              <td className="px-4 py-3 font-bold text-white">
                {r.refundAmount ? fmtMoney(r.refundAmount, r.currency ?? "USD") : "—"}
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{r.gateway ?? "—"}</td>
              <td className="px-4 py-3">
                <p className="text-xs text-zinc-400 max-w-[180px] line-clamp-2">{r.reason}</p>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  REFUND_STATUS_STYLE[r.status] ?? REFUND_STATUS_STYLE.PENDING
                }`}>{r.status}</span>
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(r.createdAt)}</td>
              <td className="px-4 py-3">
                {r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      disabled={actionId === r.id}
                      onClick={() => handleAction(r.id, "approve")}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                    >
                      ✓ Approve
                    </button>
                    <button
                      disabled={actionId === r.id}
                      onClick={() => handleAction(r.id, "deny")}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      ✗ Deny
                    </button>
                  </div>
                )}
                {r.status !== "PENDING" && (
                  <span className="text-xs text-zinc-600">
                    {r.resolvedAt ? fmtDate(r.resolvedAt) : "—"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "failures",  label: "Checkout Failures",   icon: <AlertTriangle className="h-4 w-4" /> },
  { id: "pending",   label: "Pending Payments",     icon: <Clock className="h-4 w-4" /> },
  { id: "failed",    label: "Failed Payments",      icon: <XCircle className="h-4 w-4" /> },
  { id: "success",   label: "Recent Successful",    icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "refunds",   label: "Refund Requests",      icon: <RotateCcw className="h-4 w-4" /> },
]

export default function PaymentsInspectionClient({
  tab,
  gateway,
  page,
  limit,
  failuresTotal,
  checkoutFailures,
  recentSuccessful,
  pendingPayments,
  failedPayments,
  refundRequests,
  counts,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const setTab = (newTab: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set("tab", newTab)
    url.searchParams.set("page", "1")
    startTransition(() => router.push(url.pathname + "?" + url.searchParams.toString()))
  }

  const refresh = () => startTransition(() => router.refresh())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-400" />
            Payment Inspection
          </h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Inspect checkout failures, payment states, QR/UPI logs, and reconcile with Razorpay.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Successful" value={counts.successCount}   color="text-emerald-400" icon={<CheckCircle2 className="h-4 w-4 text-current" />} />
        <StatCard label="Pending"    value={counts.pendingCount}   color="text-amber-400"   icon={<Clock className="h-4 w-4 text-current" />} />
        <StatCard label="Failed"     value={counts.failedCount}    color="text-red-400"     icon={<XCircle className="h-4 w-4 text-current" />} />
        <StatCard label="Refunded"   value={counts.refundedCount}  color="text-zinc-400"    icon={<RotateCcw className="h-4 w-4 text-current" />} />
        <StatCard label="Disputed"   value={counts.disputedCount}  color="text-orange-400"  icon={<AlertCircle className="h-4 w-4 text-current" />} />
        <StatCard label="Webhook Failures" value={counts.webhookFailures} color="text-purple-400" icon={<Webhook className="h-4 w-4 text-current" />} />
      </div>

      {/* Webhook failures alert */}
      {counts.webhookFailures > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-semibold text-sm">
              {counts.webhookFailures} Razorpay webhook{counts.webhookFailures > 1 ? "s" : ""} failed
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Some payments may not have been fully processed. Visit the{" "}
              <a href="/admin/webhooks" className="underline hover:text-amber-300">
                Webhooks panel
              </a>{" "}
              to replay failed events.
            </p>
          </div>
        </div>
      )}

      {/* Gateway filter */}
      <div className="flex items-center gap-3">
        <Search className="h-4 w-4 text-zinc-500" />
        <select
          value={gateway}
          onChange={e => {
            const url = new URL(window.location.href)
            if (e.target.value) url.searchParams.set("gateway", e.target.value)
            else url.searchParams.delete("gateway")
            url.searchParams.set("page", "1")
            startTransition(() => router.push(url.pathname + "?" + url.searchParams.toString()))
          }}
          className="text-sm bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Gateways</option>
          <option value="RAZORPAY">Razorpay</option>
          <option value="STRIPE">Stripe</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
              tab === t.id
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.icon}
            {t.label}
            {t.id === "failures" && failuresTotal > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {failuresTotal}
              </span>
            )}
            {t.id === "pending" && counts.pendingCount > 0 && (
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {counts.pendingCount}
              </span>
            )}
            {t.id === "failed" && counts.failedCount > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {counts.failedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "failures" && (
          <CheckoutFailuresTab
            failures={checkoutFailures}
            total={failuresTotal}
            page={page}
            limit={limit}
          />
        )}
        {tab === "pending" && (
          <PaymentsList
            payments={pendingPayments}
            emptyMsg="No pending payments. All recent payments completed."
          />
        )}
        {tab === "failed" && (
          <PaymentsList
            payments={failedPayments}
            emptyMsg="No failed payments in recent history."
          />
        )}
        {tab === "success" && (
          <PaymentsList
            payments={recentSuccessful}
            emptyMsg="No successful payments yet."
          />
        )}
        {tab === "refunds" && (
          <RefundRequestsTab refunds={refundRequests} />
        )}
      </div>
    </div>
  )
}
