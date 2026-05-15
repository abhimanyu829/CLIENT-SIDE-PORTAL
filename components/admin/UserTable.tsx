"use client"

import { useState } from "react"

const S = `
.ut-glass{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:1.25rem;overflow:hidden}
.ut-row:hover{background:rgba(255,255,255,.025)}
.ut-badge{font-size:.625rem;font-weight:900;padding:.25rem .625rem;border-radius:9999px;border:1px solid;text-transform:uppercase;letter-spacing:.05em}
.ut-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:.625rem;padding:.375rem .875rem;font-size:.75rem;font-weight:600;color:rgba(255,255,255,.6);transition:all .2s}
.ut-btn:hover{background:rgba(255,255,255,.07);color:#fff}
.ut-danger{color:#f87171 !important;border-color:rgba(239,68,68,.2) !important}
.ut-danger:hover{background:rgba(239,68,68,.1) !important}
`

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  SUB_ADMIN:   "bg-blue-500/15 text-blue-400 border-blue-500/25",
  CLIENT:      "bg-zinc-700/25 text-zinc-400 border-zinc-600/25",
}

interface User {
  id: string
  name: string
  email: string
  role: string
  status?: string
  createdAt?: string
  subscriptionCount?: number
  ticketCount?: number
}

interface UserTableProps {
  users: User[]
  loading?: boolean
  onRoleChange?: (userId: string, role: string) => void
  onSuspend?: (userId: string) => void
  onDelete?: (userId: string) => void
}

export function UserTable({ users, loading, onRoleChange, onSuspend, onDelete }: UserTableProps) {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = users.filter(u => {
    const ms = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const mr = roleFilter === "ALL" || u.role === roleFilter
    return ms && mr
  })

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div className="ut-glass">
      <style>{S}</style>

      {/* Controls */}
      <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder-zinc-700 outline-none"
            style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)"}}
          />
        </div>
        <div className="flex gap-2">
          {["ALL","CLIENT","SUB_ADMIN","SUPER_ADMIN"].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`ut-btn ${roleFilter === r ? "border-purple-500/40 text-purple-300" : ""}`}>
              {r === "ALL" ? "All" : r.replace("_", " ")}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <span className="text-xs text-purple-400 font-semibold ml-auto">{selected.size} selected</span>
        )}
      </div>

      {/* Header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-white/5 text-[10px] text-zinc-600 uppercase tracking-widest">
        <span />
        <span>User</span>
        <span className="hidden md:block">Role</span>
        <span className="hidden md:block">Joined</span>
        <span className="hidden lg:block">Subs</span>
        <span>Actions</span>
      </div>

      {/* Rows */}
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-4 border-b border-white/5 animate-pulse">
            <div className="w-4 h-4 bg-white/5 rounded" />
            <div className="flex gap-3 items-center">
              <div className="w-9 h-9 rounded-xl bg-white/5" />
              <div className="space-y-1.5"><div className="h-3 w-32 bg-white/5 rounded" /><div className="h-2 w-40 bg-white/5 rounded" /></div>
            </div>
            <div className="h-5 w-20 bg-white/5 rounded-full hidden md:block" />
            <div className="h-3 w-20 bg-white/5 rounded hidden md:block self-center" />
            <div className="h-3 w-8 bg-white/5 rounded hidden lg:block self-center" />
            <div className="flex gap-1"><div className="h-7 w-16 bg-white/5 rounded-lg" /></div>
          </div>
        ))
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-600">No users found</div>
      ) : filtered.map(user => (
        <div key={user.id} className="ut-row grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-white/5 last:border-0 transition-all">
          <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleSelect(user.id)}
            className="w-4 h-4 rounded accent-violet-600" />
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-xs font-black shrink-0">
              {user.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-zinc-600 truncate">{user.email}</p>
            </div>
          </div>
          <span className={`ut-badge hidden md:inline-flex ${ROLE_STYLE[user.role] ?? "bg-zinc-700/25 text-zinc-500 border-zinc-600/25"}`}>
            {user.role?.replace("_", " ")}
          </span>
          <span className="hidden md:block text-xs text-zinc-600 whitespace-nowrap">
            {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"}) : "—"}
          </span>
          <span className="hidden lg:block text-xs font-mono text-zinc-500">{user.subscriptionCount ?? 0}</span>
          <div className="flex gap-1">
            <button className="ut-btn text-xs px-2 py-1">Edit</button>
            <button onClick={() => onSuspend?.(user.id)} className="ut-btn ut-danger text-xs px-2 py-1">Suspend</button>
          </div>
        </div>
      ))}
    </div>
  )
}
