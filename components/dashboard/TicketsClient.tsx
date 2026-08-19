"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Ticket, AlertCircle, X } from "lucide-react"

export default function TicketsClient({ initialTickets }: { initialTickets: any[] }) {
  const router = useRouter()
  const [tickets, setTickets] = useState(initialTickets)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/dashboard/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          description: formData.get("description"),
          priority: formData.get("priority")
        }),
      })
      if (res.ok) {
        setModalOpen(false)
        const { data } = await res.json()
        setTickets(prev => [data, ...prev])
        router.refresh()
      } else {
        alert("Failed to create ticket")
      }
    } catch {
      alert("Error")
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "URGENT": return "text-rose-700 bg-rose-50 border-rose-200"
      case "HIGH": return "text-amber-700 bg-amber-50 border-amber-200"
      case "MEDIUM": return "text-blue-700 bg-blue-50 border-blue-200"
      case "LOW": return "text-slate-700 bg-slate-100 border-slate-200"
      default: return "text-slate-700 bg-slate-100 border-slate-200"
    }
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case "OPEN": return "text-emerald-700 font-bold"
      case "IN_PROGRESS": return "text-amber-700 font-bold"
      case "RESOLVED": return "text-slate-500 font-bold"
      default: return "text-slate-600 font-bold"
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Support Tickets</h1>
          <p className="text-sm text-slate-600 font-medium mt-1">Get help and track your support requests.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white hover:text-white transition-all shadow-sm flex items-center gap-2 hover:scale-105 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>New Ticket</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 mx-auto flex items-center justify-center">
              <Ticket className="w-6 h-6" />
            </div>
            <p className="text-slate-700 font-bold text-base">No support tickets found.</p>
            <p className="text-slate-500 text-xs max-w-sm mx-auto font-medium">Create a new ticket above to get assistance from our support engineering team.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map(t => (
              <div
                key={t.id}
                className="p-4 hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${getPriorityColor(t.priority)}`}>
                      {t.priority}
                    </span>
                    <span className={`text-xs font-semibold ${getStatusColor(t.status)}`}>
                      • {t.status}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base truncate text-slate-900">{t.title}</h3>
                  <p className="text-sm text-slate-500 font-medium truncate mt-0.5">{t.description}</p>
                </div>
                <div className="text-xs text-slate-500 font-medium sm:text-right shrink-0">
                  <p>Updated: {new Date(t.updatedAt).toLocaleDateString()}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">ID: {t.id.slice(0, 8)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal - Whitish Theme & Fixed Button Hover Visibility */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 border border-slate-200 shadow-2xl text-slate-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-purple-600" />
                Create Support Ticket
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Subject</label>
                <input
                  name="title"
                  required
                  className="w-full bg-white border border-slate-300 text-slate-900 font-medium placeholder:text-slate-400 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all"
                  placeholder="e.g. Can't access API"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Priority</label>
                <select
                  name="priority"
                  className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all cursor-pointer"
                >
                  <option value="LOW" className="bg-white text-slate-900">Low</option>
                  <option value="MEDIUM" className="bg-white text-slate-900">Medium</option>
                  <option value="HIGH" className="bg-white text-slate-900">High</option>
                  <option value="URGENT" className="bg-white text-slate-900">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">Description</label>
                <textarea
                  name="description"
                  required
                  rows={5}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-medium placeholder:text-slate-400 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all"
                  placeholder="Please describe the issue..."
                />
              </div>

              {/* Action Buttons with High-Contrast Hover Text */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 px-4 text-sm font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl border border-slate-200/80 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 text-sm font-bold text-white hover:text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl border border-purple-500 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Creating..." : "Create Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

