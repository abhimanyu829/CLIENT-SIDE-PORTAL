"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Search, Download, FileText } from "lucide-react"

interface Invoice {
  id: string
  number: string
  status: string
  totalAmount: number | string
  currency: string
  issuedAt: string | Date
  pdfUrl: string | null
}

interface InvoiceTableProps {
  invoices: Invoice[]
}

const statusConfig: Record<string, { dot: string; badge: string; label: string }> = {
  PAID:     { dot: "bg-emerald-500", badge: "text-emerald-700 bg-emerald-50 border-emerald-200",  label: "Paid" },
  PENDING:  { dot: "bg-amber-500",   badge: "text-amber-700 bg-amber-50 border-amber-200",        label: "Pending" },
  OVERDUE:  { dot: "bg-rose-500",    badge: "text-rose-700 bg-rose-50 border-rose-200",            label: "Overdue" },
  REFUNDED: { dot: "bg-zinc-400",    badge: "text-zinc-600 bg-zinc-100 border-zinc-200",           label: "Refunded" },
  VOID:     { dot: "bg-zinc-300",    badge: "text-zinc-500 bg-zinc-50 border-zinc-200",            label: "Void" },
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  const [search, setSearch] = useState("")

  const filtered = invoices.filter(
    (inv) =>
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.status.toLowerCase().includes(search.toLowerCase())
  )

  const fmt = (amount: number | string, currency: string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount))

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary max-w-xs text-foreground placeholder-muted-foreground transition-all"
          />
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-2xl border border-border shadow-sm">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoice #</th>
              <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
              <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {filtered.map((inv) => {
              const cfg = statusConfig[inv.status] ?? statusConfig.VOID
              return (
                <tr key={inv.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="py-3.5 px-5">
                    <span className="font-mono font-bold text-foreground">{inv.number}</span>
                  </td>
                  <td className="py-3.5 px-5 text-muted-foreground">
                    {new Date(inv.issuedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <span className="font-bold text-foreground">{fmt(inv.totalAmount, inv.currency)}</span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    {inv.pdfUrl ? (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 border border-primary/20 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <FileText className="w-6 h-6 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">No invoices found.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
