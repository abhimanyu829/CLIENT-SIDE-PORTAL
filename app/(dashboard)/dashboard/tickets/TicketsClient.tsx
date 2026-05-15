"use client"

import { useState, useMemo } from "react"
import Link from "next/link"

const S = `
.d-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.d-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.d-row:hover{background:rgba(255,255,255,.02)}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.d-live{animation:db 2s ease-in-out infinite}
`

const STATUS_STYLE: Record<string,string> = {
  OPEN:        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  WAITING:     "bg-amber-500/10 text-amber-400 border-amber-500/20",
  RESOLVED:    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  CLOSED:      "bg-zinc-800/50 text-zinc-600 border-zinc-700/20",
}
const PRIORITY_STYLE: Record<string,string> = {
  HIGH:   "text-red-400",
  MEDIUM: "text-amber-400",
  LOW:    "text-zinc-500",
}

export default function TicketsClient({ initialTickets }: { initialTickets: any[] }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [priorityFilter, setPriorityFilter] = useState("ALL")

  const filtered = useMemo(() => {
    return initialTickets.filter(t => {
      const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === "ALL" || t.status === statusFilter
      const matchPriority = priorityFilter === "ALL" || t.priority === priorityFilter
      return matchSearch && matchStatus && matchPriority
    })
  }, [initialTickets, search, statusFilter, priorityFilter])

  const counts = useMemo(() => ({
    open: initialTickets.filter(t=>t.status==="OPEN").length,
    inProgress: initialTickets.filter(t=>t.status==="IN_PROGRESS").length,
    resolved: initialTickets.filter(t=>t.status==="RESOLVED").length,
  }), [initialTickets])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <style>{S}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Support Center</h1>
          <p className="text-zinc-500 text-sm mt-1">Track and manage your support requests in real-time.</p>
        </div>
        <button className="d-btn px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all flex items-center gap-2">
          + New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Open",        value:counts.open,       color:"text-emerald-400", bg:"rgba(16,185,129,.08)", border:"border-emerald-500/20" },
          { label:"In Progress", value:counts.inProgress, color:"text-blue-400",    bg:"rgba(59,130,246,.08)", border:"border-blue-500/20" },
          { label:"Resolved",    value:counts.resolved,   color:"text-zinc-400",    bg:"rgba(255,255,255,.03)", border:"border-zinc-700/30" },
        ].map(s=>(
          <div key={s.label} className={`d-glass rounded-2xl p-4 border ${s.border} text-center`} style={{background:s.bg}}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full d-glass rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50" />
        </div>
        <div className="flex gap-2">
          {["ALL","OPEN","IN_PROGRESS","WAITING","RESOLVED"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={`d-glass rounded-xl px-3 py-2 text-xs font-semibold transition-all ${statusFilter===s?"border-purple-500/50 text-purple-300":"text-zinc-600 hover:text-zinc-300"}`}>
              {s==="ALL" ? "All" : s.replace("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full d-live" />
        Real-time updates enabled · {filtered.length} tickets
      </div>

      {/* Ticket Table */}
      <div className="d-glass rounded-2xl overflow-hidden">
        {/* Table Head */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-white/5 text-xs text-zinc-600 uppercase tracking-widest">
          <span>Issue</span>
          <span>Priority</span>
          <span>Status</span>
          <span className="hidden md:block">Date</span>
          <span>Action</span>
        </div>

        {/* Rows */}
        {filtered.length > 0 ? filtered.map((ticket:any)=>(
          <div key={ticket.id} className="d-row grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-white/5 last:border-0 transition-all">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ticket.status==="OPEN"?"bg-emerald-400":ticket.status==="IN_PROGRESS"?"bg-blue-400 animate-pulse":"bg-zinc-600"}`} />
                <p className="font-semibold text-sm truncate">{ticket.title}</p>
              </div>
              <p className="text-xs text-zinc-600 pl-3.5 truncate">{ticket.category ?? "General"}</p>
            </div>
            <span className={`text-xs font-bold ${PRIORITY_STYLE[ticket.priority] ?? "text-zinc-500"}`}>
              {ticket.priority === "HIGH" ? "● " : ticket.priority === "MEDIUM" ? "◑ " : "○ "}
              {ticket.priority ?? "LOW"}
            </span>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${STATUS_STYLE[ticket.status] ?? STATUS_STYLE.OPEN}`}>
              {ticket.status?.replace("_"," ") ?? "OPEN"}
            </span>
            <span className="hidden md:block text-xs text-zinc-600 whitespace-nowrap">
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : "—"}
            </span>
            <Link href={`/dashboard/tickets/${ticket.id}`}>
              <button className="d-glass rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-white/10 transition-all whitespace-nowrap">
                View →
              </button>
            </Link>
          </div>
        )) : (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">◎</div>
            <p className="text-zinc-500 text-sm mb-1">{search ? "No tickets match your search" : "No tickets yet"}</p>
            <p className="text-zinc-700 text-xs">{!search && "Create a ticket to get help from our team"}</p>
            {!search && (
              <button className="mt-4 d-btn px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all">
                + Create Ticket
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
