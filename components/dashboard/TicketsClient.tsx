"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

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
      case "URGENT": return "text-red-400 bg-red-400/10 border-red-400/20"
      case "HIGH": return "text-amber-400 bg-amber-400/10 border-amber-400/20"
      case "MEDIUM": return "text-blue-400 bg-blue-400/10 border-blue-400/20"
      case "LOW": return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"
      default: return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"
    }
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case "OPEN": return "text-green-400"
      case "IN_PROGRESS": return "text-amber-400"
      case "RESOLVED": return "text-zinc-500"
      default: return "text-zinc-400"
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-sm text-zinc-500 mt-1">Get help and track your support requests.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="dash-btn px-4 py-2 rounded-lg text-sm font-medium transition-transform active:scale-95">
          New Ticket
        </button>
      </div>

      <div className="dash-glass rounded-2xl border-white/5 overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl">◎</span>
            <p className="mt-4 text-zinc-400">No support tickets found.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {tickets.map(t => (
              <div key={t.id} className="p-4 hover:bg-white/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer" onClick={() => router.push(`/dashboard/tickets/${t.id}`)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${getPriorityColor(t.priority)}`}>
                      {t.priority}
                    </span>
                    <span className={`text-xs font-semibold ${getStatusColor(t.status)}`}>
                      • {t.status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base truncate text-white">{t.title}</h3>
                  <p className="text-sm text-zinc-500 truncate">{t.description}</p>
                </div>
                <div className="text-xs text-zinc-600 sm:text-right shrink-0">
                  <p>Updated: {new Date(t.updatedAt).toLocaleDateString()}</p>
                  <p className="mt-0.5">{t.id.slice(0, 8)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="dash-glass w-full max-w-lg rounded-2xl p-6 dash-slide">
            <h2 className="text-xl font-bold mb-4">Create Support Ticket</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Subject</label>
                <input name="title" required className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" placeholder="e.g. Can't access API" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Priority</label>
                <select name="priority" className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Description</label>
                <textarea name="description" required rows={5} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" placeholder="Please describe the issue..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 dash-btn rounded-lg text-sm font-medium disabled:opacity-50">
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
