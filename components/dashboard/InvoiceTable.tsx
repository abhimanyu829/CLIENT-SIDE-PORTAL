"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

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

const statusBadge: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-yellow-100 text-yellow-800",
  OVERDUE: "bg-rose-100 text-rose-700",
  REFUNDED: "bg-zinc-100 text-zinc-600",
  VOID: "bg-zinc-100 text-zinc-400",
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  const [search, setSearch] = useState("")

  const filtered = invoices.filter(
    (inv) =>
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.status.toLowerCase().includes(search.toLowerCase())
  )

  const fmt = (amount: number | string, currency: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(Number(amount))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Invoice #</th>
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Amount</th>
              <th className="p-3 font-medium text-right">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((inv) => (
              <tr key={inv.id} className="hover:bg-muted/10 transition-colors">
                <td className="p-3 font-mono font-medium">{inv.number}</td>
                <td className="p-3 text-muted-foreground">
                  {new Date(inv.issuedAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${statusBadge[inv.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="p-3 font-semibold text-right">
                  {fmt(inv.totalAmount, inv.currency)}
                </td>
                <td className="p-3 text-right">
                  {inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-xs hover:underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
