"use client"

import { useState, useMemo } from "react"
import Link from "next/link"

const S = `
.d-glass{background:hsl(var(--card));backdrop-filter:blur(20px);border:1px solid hsl(var(--border))}
.d-btn{background:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.d-btn:hover{background:hsl(var(--primary)/0.9)}
.d-row:hover{background:hsl(var(--muted)/0.5)}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.d-live{animation:db 2s ease-in-out infinite}
`

const STATUS_STYLE: Record<string,string> = {
  OPEN:        "bg-emerald-100 text-emerald-700 border-emerald-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  WAITING:     "bg-amber-100 text-amber-700 border-amber-200",
  RESOLVED:    "bg-muted text-muted-foreground border-border",
  CLOSED:      "bg-muted text-muted-foreground border-border",
}
const PRIORITY_STYLE: Record<string,string> = {
  HIGH:   "text-red-600",
  MEDIUM: "text-amber-600",
  LOW:    "text-muted-foreground",
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
          <h1 className="text-3xl font-black tracking-tight font-sans">Support Center</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage your support requests in real-time.</p>
        </div>
        <button className="d-btn px-4 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-all flex items-center gap-2">
          + New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Open",        value:counts.open,       color:"text-emerald-600", bg:"rgba(16,185,129,.1)", border:"border-emerald-500/30" },
          { label:"In Progress", value:counts.inProgress, color:"text-blue-600",    bg:"rgba(59,130,246,.1)", border:"border-blue-500/30" },
          { label:"Resolved",    value:counts.resolved,   color:"text-muted-foreground",    bg:"hsl(var(--muted)/0.5)", border:"border-border" },
        ].map(s=>(
          <div key={s.label} className={`d-glass rounded-2xl p-4 border \${s.border} text-center`} style={{background:s.bg}}>
            <p className={`text-2xl font-black \${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
        </div>
        <div className="flex gap-2">
          {["ALL","OPEN","IN_PROGRESS","WAITING","RESOLVED"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={`d-glass rounded-xl px-3 py-2 text-xs font-semibold transition-all \${statusFilter===s?"border-primary/50 text-primary":"text-muted-foreground hover:text-foreground"}`}>
              {s==="ALL" ? "All" : s.replace("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full d-live" />
        Real-time updates enabled · {filtered.length} tickets
      </div>

      {/* Ticket Table */}
      <div className="d-glass rounded-2xl overflow-hidden">
        {/* Table Head */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-border bg-muted/20 text-xs text-muted-foreground uppercase tracking-widest">
          <span>Issue</span>
          <span>Priority</span>
          <span>Status</span>
          <span className="hidden md:block">Date</span>
          <span>Action</span>
        </div>

        {/* Rows */}
        {filtered.length > 0 ? filtered.map((ticket:any)=>(
          <div key={ticket.id} className="d-row grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-border last:border-0 transition-all">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 \${ticket.status==="OPEN"?"bg-emerald-500":ticket.status==="IN_PROGRESS"?"bg-blue-500 animate-pulse":"bg-muted-foreground"}`} />
                <p className="font-semibold text-sm truncate text-foreground">{ticket.title}</p>
              </div>
              <p className="text-xs text-muted-foreground pl-3.5 truncate">{ticket.category ?? "General"}</p>
            </div>
            <span className={`text-xs font-bold \${PRIORITY_STYLE[ticket.priority] ?? "text-muted-foreground"}`}>
              {ticket.priority === "HIGH" ? "● " : ticket.priority === "MEDIUM" ? "◑ " : "○ "}
              {ticket.priority ?? "LOW"}
            </span>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border \${STATUS_STYLE[ticket.status] ?? STATUS_STYLE.OPEN}`}>
              {ticket.status?.replace("_"," ") ?? "OPEN"}
            </span>
            <span className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : "—"}
            </span>
            <Link href={`/dashboard/tickets/\${ticket.id}`}>
              <button className="d-glass rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all whitespace-nowrap bg-background">
                View →
              </button>
            </Link>
          </div>
        )) : (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3 text-muted-foreground">◎</div>
            <p className="text-muted-foreground text-sm mb-1">{search ? "No tickets match your search" : "No tickets yet"}</p>
            <p className="text-muted-foreground/70 text-xs">{!search && "Create a ticket to get help from our team"}</p>
            {!search && (
              <button className="mt-4 d-btn px-5 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-all">
                + Create Ticket
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
