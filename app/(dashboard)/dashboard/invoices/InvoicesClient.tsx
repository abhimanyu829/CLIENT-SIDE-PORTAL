"use client"

import { useState, useMemo } from "react"

const S = `
.d-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.d-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.d-row:hover{background:rgba(255,255,255,.02)}
`

const STATUS_STYLE: Record<string,string> = {
  PAID:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PENDING:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  FAILED:   "bg-red-500/10 text-red-400 border-red-500/20",
  REFUNDED: "bg-zinc-700/30 text-zinc-400 border-zinc-600/30",
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
          <h1 className="text-3xl font-black tracking-tight">Billing History</h1>
          <p className="text-zinc-500 text-sm mt-1">View invoices, download PDFs, and track payments.</p>
        </div>
        <button className="d-glass px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-300 hover:border-white/10 transition-all">
          ⬇ Export All
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"Total Paid",    value:`$${(totals.paid/100).toFixed(2)}`,    color:"text-emerald-400", border:"border-emerald-500/20" },
          { label:"Pending",       value:`$${(totals.pending/100).toFixed(2)}`, color:"text-amber-400",   border:"border-amber-500/20" },
          { label:"Invoices",      value:invoices.length,                        color:"text-blue-400",    border:"border-blue-500/20" },
          { label:"This Month",    value:`$${(totals.paid/100/12).toFixed(2)}`, color:"text-purple-400",  border:"border-purple-500/20" },
        ].map(s=>(
          <div key={s.label} className={`d-glass rounded-2xl p-4 border ${s.border}`}>
            <p className="text-xs text-zinc-600 mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by invoice ID..."
            className="w-full d-glass rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50" />
        </div>
        <div className="flex gap-2">
          {["ALL","PAID","PENDING","FAILED","REFUNDED"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={`d-glass rounded-xl px-3 py-2 text-xs font-semibold transition-all ${statusFilter===s?"border-purple-500/50 text-purple-300":"text-zinc-600 hover:text-zinc-300"}`}>
              {s==="ALL"?"All":s.charAt(0)+s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="d-glass rounded-2xl overflow-hidden">
        {/* Headers */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-white/5 text-xs text-zinc-600 uppercase tracking-widest">
          <span>Invoice</span>
          <span className="hidden md:block">Date</span>
          <span>Amount</span>
          <span>Status</span>
          <span>PDF</span>
        </div>

        {filtered.length > 0 ? filtered.map((inv:any) => (
          <div key={inv.id} className="d-row grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-white/5 last:border-0 transition-all">
            <div className="min-w-0">
              <p className="text-sm font-mono font-semibold">{inv.stripeInvoiceId ? `${inv.stripeInvoiceId.slice(0,20)}...` : `INV-${inv.id.slice(0,12)}`}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{inv.description ?? "Subscription payment"}</p>
            </div>
            <span className="hidden md:block text-xs text-zinc-600 whitespace-nowrap">
              {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}
            </span>
            <span className="font-black text-sm">${(Number(inv.amount||0)/100).toFixed(2)}</span>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border whitespace-nowrap ${STATUS_STYLE[inv.status] ?? STATUS_STYLE.PENDING}`}>
              {inv.status ?? "PENDING"}
            </span>
            <button className="d-glass rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:border-white/10 transition-all">
              ⬇ PDF
            </button>
          </div>
        )) : (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">◑</div>
            <p className="text-zinc-500 text-sm">{search || statusFilter !== "ALL" ? "No matching invoices" : "No invoices yet"}</p>
          </div>
        )}
      </div>

      {/* Stripe note */}
      <div className="d-glass rounded-2xl p-4 border border-blue-500/15 flex items-start gap-3">
        <span className="text-blue-400 text-sm mt-0.5">ℹ</span>
        <div>
          <p className="text-xs font-semibold text-blue-300">Stripe-powered billing</p>
          <p className="text-xs text-zinc-600">All invoices are synced from Stripe. PDF generation and payment history are available for all completed transactions.</p>
        </div>
      </div>
    </div>
  )
}
