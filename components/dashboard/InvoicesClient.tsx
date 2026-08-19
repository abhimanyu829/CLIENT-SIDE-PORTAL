"use client"
import { useState, useEffect } from "react"
import { Download, FileText, Receipt, Search, Filter, TrendingUp, Clock, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  PAID: { label: "Paid", dot: "bg-emerald-400", badge: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25" },
  PENDING: { label: "Pending", dot: "bg-amber-400", badge: "text-amber-400 bg-amber-400/10 border-amber-400/25" },
  OVERDUE: { label: "Overdue", dot: "bg-red-400", badge: "text-red-400 bg-red-400/10 border-red-400/25" },
  REFUNDED: { label: "Refunded", dot: "bg-zinc-400", badge: "text-zinc-400 bg-zinc-400/10 border-zinc-400/25" },
  VOID: { label: "Void", dot: "bg-zinc-600", badge: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.VOID
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function SummaryCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-all group`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-black text-foreground">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent} opacity-80 group-hover:opacity-100 transition-opacity`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export default function InvoicesClient() {
  const [data, setData] = useState<{ invoices: any[]; summary: any; pagination: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("ALL")
  const [q, setQ] = useState("")

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices?page=${page}&status=${status}&q=${q}`)
      if (res.ok) {
        const json = await res.json()
        setData({ invoices: json.data, summary: json.summary, pagination: json.pagination })
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [page, status, q]) // eslint-disable-line

  const handleExport = () => {
    window.open("/api/invoices/export", "_blank")
  }

  const fmt = (amount: number) => `₹${Number(amount).toFixed(2)}`

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl font-black text-foreground">Invoices</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-10">Full billing history and upcoming charges.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search invoice #..."
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
              className="bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 w-44 transition-all text-foreground placeholder-muted-foreground"
            />
          </div>
          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1) }}
              className="bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer text-foreground transition-all appearance-none"
            >
              <option value="ALL">All Status</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          {/* Export */}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 border border-border bg-background hover:bg-accent rounded-xl px-4 py-2 text-sm font-semibold text-foreground transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────── */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Paid"
            value={fmt(data.summary.totalPaid)}
            icon={CheckCircle2}
            accent="bg-emerald-500/10 text-emerald-500"
          />
          <SummaryCard
            label="Pending"
            value={fmt(data.summary.totalPending)}
            icon={Clock}
            accent="bg-amber-500/10 text-amber-500"
          />
          <SummaryCard
            label="Total Invoices"
            value={String(data.summary.totalInvoices)}
            icon={FileText}
            accent="bg-primary/10 text-primary"
          />
          <SummaryCard
            label="This Month"
            value={fmt(data.summary.thisMonth)}
            icon={TrendingUp}
            accent="bg-violet-500/10 text-violet-500"
          />
        </div>
      )}

      {/* ── Invoice Table ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading invoices…</p>
          </div>
        ) : !data || data.invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <FileText className="w-7 h-7 opacity-40" />
            </div>
            <p className="text-sm font-medium">No invoices found.</p>
            <p className="text-xs opacity-60">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoice #</th>
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date Issued</th>
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.invoices.map((inv, idx) => (
                  <tr
                    key={inv.id}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-4 px-5">
                      <span className="font-mono font-bold text-foreground text-sm">{inv.number}</span>
                    </td>
                    <td className="py-4 px-5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-4 px-5">
                      <span className="font-bold text-foreground">₹{Number(inv.totalAmount).toFixed(2)}</span>
                      <span className="text-muted-foreground text-xs ml-1">{inv.currency}</span>
                    </td>
                    <td className="py-4 px-5 text-muted-foreground text-sm">
                      {new Date(inv.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex gap-2">
                        <a
                          href={`/api/invoices/${inv.id}/download`}
                          download={`${inv.number ?? "invoice"}.pdf`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 border border-primary/20 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Download className="w-3.5 h-3.5" /> Invoice
                        </a>
                        <a
                          href={`/api/invoices/${inv.id}/receipt`}
                          download={`RECEIPT-${inv.number ?? "payment"}.pdf`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Receipt className="w-3.5 h-3.5" /> Receipt
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {data?.pagination && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground font-medium">
            Page <span className="text-foreground font-bold">{page}</span> of <span className="text-foreground font-bold">{data.pagination.pages}</span>
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="inline-flex items-center gap-1.5 border border-border bg-background hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-sm font-semibold text-foreground transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              disabled={page === data.pagination.pages}
              onClick={() => setPage(p => p + 1)}
              className="inline-flex items-center gap-1.5 border border-border bg-background hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-sm font-semibold text-foreground transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
