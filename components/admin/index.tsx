"use client"

import { useState } from "react"

const S = `
.lk-glass{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:1.25rem;overflow:hidden}
.lk-col{background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.05);border-radius:1rem;padding:1rem;min-height:28rem;flex:1;min-width:200px}
.lk-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:.875rem;padding:.875rem;cursor:grab;transition:all .2s;margin-bottom:.625rem}
.lk-card:hover{border-color:rgba(255,255,255,.14);transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.4)}
.lk-card:last-child{margin-bottom:0}
.lk-priority{font-size:.6rem;font-weight:900;padding:.2rem .5rem;border-radius:9999px;letter-spacing:.06em;text-transform:uppercase}
`

const PRIORITY_STYLE: Record<string, string> = {
  HIGH:   "bg-red-500/15 text-red-400 border border-red-500/25",
  MEDIUM: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  LOW:    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
}

const COLUMNS = [
  { id:"NEW",         label:"New Leads",   color:"rgba(99,102,241,.6)" },
  { id:"CONTACTED",   label:"Contacted",   color:"rgba(245,158,11,.6)" },
  { id:"QUALIFIED",   label:"Qualified",   color:"rgba(59,130,246,.6)" },
  { id:"PROPOSAL",    label:"Proposal",    color:"rgba(139,92,246,.6)" },
  { id:"WON",         label:"Won ✓",       color:"rgba(16,185,129,.6)" },
  { id:"LOST",        label:"Lost",        color:"rgba(239,68,68,.4)" },
]

interface Lead {
  id: string
  name: string
  email?: string
  company?: string
  status: string
  priority?: string
  value?: number
  createdAt?: string
}

interface LeadKanbanProps {
  leads: Lead[]
  loading?: boolean
  onStatusChange?: (leadId: string, newStatus: string) => void
}

export function LeadKanban({ leads, loading, onStatusChange }: LeadKanbanProps) {
  const [dragging, setDragging] = useState<string | null>(null)

  const byStatus = (status: string) => leads.filter(l => l.status === status)

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    if (dragging) {
      onStatusChange?.(dragging, colId)
      setDragging(null)
    }
  }

  return (
    <div className="lk-glass">
      <style>{S}</style>
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <p className="font-black text-base">Lead Pipeline</p>
        <p className="text-xs text-zinc-600">{leads.length} leads</p>
      </div>

      <div className="p-4 overflow-x-auto">
        <div className="flex gap-3" style={{minWidth:"max-content"}}>
          {COLUMNS.map(col => {
            const colLeads = byStatus(col.id)
            const totalValue = colLeads.reduce((s, l) => s + (l.value ?? 0), 0)

            return (
              <div key={col.id} className="lk-col"
                style={{width:"200px"}}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col.id)}>

                {/* Column Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{background:col.color}} />
                    <p className="text-xs font-black text-zinc-400">{col.label}</p>
                  </div>
                  <span className="text-xs font-bold text-zinc-700 bg-white/5 px-1.5 py-0.5 rounded-full">
                    {colLeads.length}
                  </span>
                </div>
                {totalValue > 0 && (
                  <p className="text-[10px] text-zinc-700 mb-3">
                    ${totalValue.toLocaleString()} potential
                  </p>
                )}

                {/* Cards */}
                {loading ? (
                  [1,2].map(i => (
                    <div key={i} className="lk-card animate-pulse">
                      <div className="h-3 w-24 bg-white/5 rounded mb-2" />
                      <div className="h-2 w-32 bg-white/5 rounded" />
                    </div>
                  ))
                ) : colLeads.map(lead => (
                  <div key={lead.id} className="lk-card"
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => setDragging(null)}>
                    <div className="flex items-start justify-between mb-1.5">
                      <p className="text-xs font-bold text-white leading-snug">{lead.name}</p>
                      {lead.priority && (
                        <span className={`lk-priority ${PRIORITY_STYLE[lead.priority] ?? ""}`}>
                          {lead.priority.slice(0,1)}
                        </span>
                      )}
                    </div>
                    {lead.company && <p className="text-[10px] text-zinc-600">{lead.company}</p>}
                    {lead.value && (
                      <p className="text-[10px] text-emerald-400 mt-1.5 font-bold">${lead.value.toLocaleString()}</p>
                    )}
                  </div>
                ))}

                {colLeads.length === 0 && !loading && (
                  <div className="flex items-center justify-center h-20 text-xs text-zinc-800">
                    Drop here
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── AUDIT LOG TABLE ──────────────────────────────────────────────────────────
interface AuditEntry {
  id: string
  action: string
  entityType?: string
  entityId?: string
  performedBy?: { name?: string; email?: string }
  createdAt: string
  meta?: Record<string, unknown>
}

interface AuditLogTableProps {
  entries: AuditEntry[]
  loading?: boolean
}

const ACTION_COLOR: Record<string, string> = {
  CREATE:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  UPDATE:  "text-blue-400 bg-blue-500/10 border-blue-500/20",
  DELETE:  "text-red-400 bg-red-500/10 border-red-500/20",
  LOGIN:   "text-purple-400 bg-purple-500/10 border-purple-500/20",
  SUSPEND: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  EXPORT:  "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
}

export function AuditLogTable({ entries, loading }: AuditLogTableProps) {
  const [search, setSearch] = useState("")

  const filtered = entries.filter(e =>
    !search ||
    e.action?.toLowerCase().includes(search.toLowerCase()) ||
    e.entityType?.toLowerCase().includes(search.toLowerCase()) ||
    e.performedBy?.email?.toLowerCase().includes(search.toLowerCase())
  )

  const actionStyle = (action: string) => {
    const key = Object.keys(ACTION_COLOR).find(k => action?.includes(k))
    return key ? ACTION_COLOR[key] : "text-zinc-500 bg-zinc-800/30 border-zinc-700/30"
  }

  return (
    <div className="lk-glass">
      <style>{S}</style>
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
        <p className="font-black text-base">Audit Log</p>
        <div className="relative flex-1 max-w-xs ml-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter by action, user..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs text-white placeholder-zinc-700 outline-none"
            style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}
          />
        </div>
      </div>

      <div className="grid px-5 py-2.5 border-b border-white/5 text-[10px] text-zinc-700 uppercase tracking-widest"
        style={{gridTemplateColumns:"auto 1fr auto auto"}}>
        <span className="mr-4">Action</span>
        <span>Entity</span>
        <span className="hidden md:block mr-4">Performed By</span>
        <span>Time</span>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
        {loading ? (
          Array.from({length:6}).map((_,i) => (
            <div key={i} className="px-5 py-3.5 animate-pulse grid gap-4"
              style={{gridTemplateColumns:"auto 1fr auto auto"}}>
              <div className="h-5 w-20 bg-white/5 rounded-full" />
              <div className="h-3 w-40 bg-white/5 rounded" />
              <div className="h-3 w-24 bg-white/5 rounded hidden md:block" />
              <div className="h-3 w-16 bg-white/5 rounded" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-700">No audit entries found</div>
        ) : filtered.map(entry => (
          <div key={entry.id} className="px-5 py-3.5 hover:bg-white/2 transition-all grid gap-4 items-center"
            style={{gridTemplateColumns:"auto 1fr auto auto"}}>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border mr-4 ${actionStyle(entry.action)}`}>
              {entry.action?.split("_")[0]}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-300 truncate">{entry.action}</p>
              {entry.entityType && (
                <p className="text-[10px] text-zinc-600">{entry.entityType}{entry.entityId ? ` · ${entry.entityId.slice(0,12)}` : ""}</p>
              )}
            </div>
            <div className="hidden md:block mr-4 text-right">
              <p className="text-xs text-zinc-500">{entry.performedBy?.name ?? "System"}</p>
              <p className="text-[10px] text-zinc-700">{entry.performedBy?.email}</p>
            </div>
            <p className="text-[10px] text-zinc-700 whitespace-nowrap">
              {new Date(entry.createdAt).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
