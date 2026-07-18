"use client"

import { useState, useMemo } from "react"

const S = `
.d-glass{background:hsl(var(--card));backdrop-filter:blur(20px);border:1px solid hsl(var(--border))}
.d-btn{background:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.d-row:hover{background:hsl(var(--muted)/0.5)}
`

const STATUS_STYLE: Record<string,string> = {
  PAID:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  PENDING:  "bg-amber-100 text-amber-700 border-amber-200",
  FAILED:   "bg-red-100 text-red-700 border-red-200",
  REFUNDED: "bg-muted text-muted-foreground border-border",
}

export default function InvoicesClient({ invoices }: { invoices: any[] }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const filtered = useMemo(() =>
    invoices.filter(inv => {
      const matchSearch = !search || inv.stripeInvoiceId?.includes(search)
      const matchStatus = statusFilter === "ALL" || inv.status === statusFilter
      return matchSearch && matchStatus
    }),
    [invoices, search, statusFilter]
  )

  const totals = useMemo(() => ({
    paid: invoices.filter(i=>i.status==="PAID").reduce((s:number,i:any)=>s+Number(i.amount||0),0),
    pending: invoices.filter(i=>i.status==="PENDING").reduce((s:number,i:any)=>s+Number(i.amount||0),0),
  }),[invoices])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <style>{S}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight font-sans">Billing History</h1>
          <p className="text-muted-foreground text-sm mt-1">View invoices, download PDFs, and track payments.</p>
        </div>
        <button className="d-glass px-4 py-2.5 rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-all">
          ⬇ Export All
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"Total Paid",    value:`$${(totals.paid/100).toFixed(2)}`,    color:"text-emerald-600", border:"border-emerald-500/20" },
          { label:"Pending",       value:`$${(totals.pending/100).toFixed(2)}`, color:"text-amber-600",   border:"border-amber-500/20" },
          { label:"Invoices",      value:invoices.length,                        color:"text-blue-600",    border:"border-blue-500/20" },
          { label:"This Month",    value:`$${(totals.paid/100/12).toFixed(2)}`, color:"text-primary",  border:"border-primary/20" },
        ].map(s=>(
          <div key={s.label} className={`d-glass rounded-2xl p-4 border ${s.border}`}>
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by invoice ID..."
            className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
        </div>
        <div className="flex gap-2">
          {["ALL","PAID","PENDING","FAILED","REFUNDED"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={`d-glass rounded-xl px-3 py-2 text-xs font-semibold transition-all ${statusFilter===s?"border-primary/50 text-primary":"text-muted-foreground hover:text-foreground"}`}>
              {s==="ALL"?"All":s.charAt(0)+s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="d-glass rounded-2xl overflow-hidden">
        {/* Headers */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-border bg-muted/20 text-xs text-muted-foreground uppercase tracking-widest">
          <span>Invoice</span>
          <span className="hidden md:block">Date</span>
          <span>Amount</span>
          <span>Status</span>
          <span>PDF</span>
        </div>

        {filtered.length > 0 ? filtered.map((inv:any) => (
          <div key={inv.id} className="d-row grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-border last:border-0 transition-all">
            <div className="min-w-0">
              <p className="text-sm font-mono font-semibold text-foreground">{inv.stripeInvoiceId ? `${inv.stripeInvoiceId.slice(0,20)}...` : `INV-${inv.id.slice(0,12)}`}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{inv.description ?? "Subscription payment"}</p>
            </div>
            <span className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
              {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}
            </span>
            <span className="font-black text-sm text-foreground">$\{(Number(inv.amount||0)/100).toFixed(2)}</span>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border whitespace-nowrap ${STATUS_STYLE[inv.status] ?? STATUS_STYLE.PENDING}`}>
              {inv.status ?? "PENDING"}
            </span>
            <button className="d-glass rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all bg-background hover:bg-muted">
              ⬇ PDF
            </button>
          </div>
        )) : (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3 text-muted-foreground">◑</div>
            <p className="text-muted-foreground text-sm">{search || statusFilter !== "ALL" ? "No matching invoices" : "No invoices yet"}</p>
          </div>
        )}
      </div>

      {/* Stripe note */}
      <div className="d-glass rounded-2xl p-4 border border-blue-500/20 bg-blue-50 flex items-start gap-3">
        <span className="text-blue-600 text-sm mt-0.5">ℹ</span>
        <div>
          <p className="text-xs font-semibold text-blue-700">Stripe-powered billing</p>
          <p className="text-xs text-blue-600/80">All invoices are synced from Stripe. PDF generation and payment history are available for all completed transactions.</p>
        </div>
      </div>
    </div>
  )
}
