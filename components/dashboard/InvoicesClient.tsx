"use client"
import { useState, useEffect } from "react"

export default function InvoicesClient() {
  const [data, setData] = useState<{ invoices: any[], summary: any, pagination: any } | null>(null)
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-1">Billing history and upcoming charges.</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search invoice #..." 
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
            className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-amber-500"
          />
          <select 
            value={status} 
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-amber-500"
          >
            <option value="ALL">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="OVERDUE">Overdue</option>
          </select>
          <button onClick={handleExport} className="dash-glass border border-white/10 px-3 py-1.5 rounded-lg text-sm hover:border-white/20 transition-all flex items-center gap-2">
            <span>📥</span> Export
          </button>
        </div>
      </div>

      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="dash-glass p-4 rounded-xl">
            <p className="text-xs text-zinc-500">Total Paid</p>
            <p className="text-xl font-bold mt-1">${data.summary.totalPaid.toFixed(2)}</p>
          </div>
          <div className="dash-glass p-4 rounded-xl">
            <p className="text-xs text-zinc-500">Pending</p>
            <p className="text-xl font-bold mt-1">${data.summary.totalPending.toFixed(2)}</p>
          </div>
          <div className="dash-glass p-4 rounded-xl">
            <p className="text-xs text-zinc-500">Total Invoices</p>
            <p className="text-xl font-bold mt-1">{data.summary.totalInvoices}</p>
          </div>
          <div className="dash-glass p-4 rounded-xl">
            <p className="text-xs text-zinc-500">This Month</p>
            <p className="text-xl font-bold mt-1">${data.summary.thisMonth.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="dash-glass rounded-2xl border-white/5 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-sm">Loading invoices...</div>
        ) : !data || data.invoices.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">No invoices found.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/5 text-xs text-zinc-400">
              <tr>
                <th className="py-3 px-4 font-medium">Invoice</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium">Date Issued</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono text-zinc-300">{inv.number}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      inv.status === 'PAID' ? 'text-green-400 bg-green-400/10 border-green-400/20' :
                      inv.status === 'PENDING' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                      'text-red-400 bg-red-400/10 border-red-400/20'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">${Number(inv.totalAmount).toFixed(2)} {inv.currency}</td>
                  <td className="py-3 px-4 text-zinc-500">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-xs text-amber-400 hover:underline">Download PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data?.pagination && data.pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            className="dash-glass px-3 py-1 rounded-lg text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-zinc-500">
            Page {page} of {data.pagination.pages}
          </span>
          <button 
            disabled={page === data.pagination.pages} 
            onClick={() => setPage(p => p + 1)}
            className="dash-glass px-3 py-1 rounded-lg text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
