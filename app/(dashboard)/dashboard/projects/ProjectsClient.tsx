"use client"

import { useState } from "react"
import Link from "next/link"

const S = `
.d-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.d-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.d-card{transition:all .3s ease}.d-card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.1)}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.d-live{animation:db 2s ease-in-out infinite}
`

const STATUS_STYLE: Record<string,{label:string,color:string,bg:string,border:string}> = {
  PLANNING:  {label:"Planning",  color:"text-zinc-400",    bg:"rgba(255,255,255,.03)", border:"border-zinc-700/30"},
  ACTIVE:    {label:"Active",    color:"text-emerald-400", bg:"rgba(16,185,129,.06)", border:"border-emerald-500/25"},
  REVIEW:    {label:"Review",    color:"text-blue-400",    bg:"rgba(59,130,246,.06)",  border:"border-blue-500/25"},
  DELIVERED: {label:"Delivered", color:"text-purple-400",  bg:"rgba(139,92,246,.06)", border:"border-purple-500/25"},
  ARCHIVED:  {label:"Archived",  color:"text-zinc-600",    bg:"rgba(0,0,0,.2)",        border:"border-zinc-800/30"},
}

const KANBAN_COLS = ["PLANNING","ACTIVE","REVIEW","DELIVERED"] as const

export default function ProjectsClient({ initialProjects }: { initialProjects: any[] }) {
  const [view, setView] = useState<"grid"|"kanban">("grid")
  const [search, setSearch] = useState("")

  const filtered = initialProjects.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  )

  const byStatus = (status: string) => filtered.filter(p => p.status === status)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <style>{S}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Projects</h1>
          <p className="text-zinc-500 text-sm mt-1">Track your active deliverables and project milestones.</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* View toggle */}
          <div className="d-glass rounded-xl p-1 flex gap-1">
            {[["grid","⊞"],["kanban","⊟"]].map(([v,icon])=>(
              <button key={v} onClick={()=>setView(v as any)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${view===v?"bg-violet-600 text-white":"text-zinc-500 hover:text-zinc-300"}`}>
                {icon}
              </button>
            ))}
          </div>
          <button className="d-btn px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all">
            + New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_STYLE).slice(0,4).map(([status, style])=>(
          <div key={status} className={`d-glass rounded-2xl p-4 border ${style.border} text-center`}>
            <p className={`text-2xl font-black ${style.color}`}>{byStatus(status).length}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{style.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full d-glass rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50" />
      </div>

      {/* Grid View */}
      {view === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length > 0 ? filtered.map((proj:any) => {
            const style = STATUS_STYLE[proj.status] ?? STATUS_STYLE.PLANNING
            const progress = proj.progress ?? Math.floor(Math.random()*80+10)
            return (
              <div key={proj.id} className={`d-glass rounded-2xl p-5 border d-card ${style.border}`} style={{background:style.bg}}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:style.bg,border:`1px solid ${style.border.replace("border-","")}`}}>
                    ◻
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${style.border} ${style.color}`}>
                    {style.label}
                  </span>
                </div>
                <h3 className="font-black text-base mb-1">{proj.name}</h3>
                <p className="text-xs text-zinc-600 mb-4 line-clamp-2">{proj.description ?? "No description provided."}</p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Progress</span>
                    <span className={`font-bold ${style.color}`}>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{width:`${progress}%`,background:`linear-gradient(90deg,#6366f1,#8b5cf6)`}} />
                  </div>
                </div>

                {/* Milestones */}
                <div className="space-y-1.5 mb-4">
                  {["Design System","Backend API","Frontend UI"].slice(0, 2).map((m,i)=>(
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={i===0?"text-emerald-400":"text-zinc-700"}>{i===0?"✓":"○"}</span>
                      <span className={i===0?"text-zinc-400 line-through":"text-zinc-600"}>{m}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex -space-x-2">
                    {["A","B"].map((l,i)=>(
                      <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[9px] font-black border border-[#080808]">{l}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-700">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full d-live" />
                    Active
                  </div>
                </div>
              </div>
            )
          }) : (
            <div className="col-span-3 py-16 text-center">
              <div className="text-5xl mb-4">◻</div>
              <p className="text-zinc-500 text-sm">No projects yet</p>
              <button className="mt-4 d-btn px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all">
                + Create Project
              </button>
            </div>
          )}
        </div>
      )}

      {/* Kanban View */}
      {view === "kanban" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KANBAN_COLS.map(status => {
            const style = STATUS_STYLE[status]
            const items = byStatus(status)
            return (
              <div key={status} className="d-glass rounded-2xl overflow-hidden">
                <div className={`px-4 py-3 border-b border-white/5 flex items-center justify-between`}>
                  <span className={`text-xs font-bold ${style.color}`}>{style.label}</span>
                  <span className="d-glass text-xs px-2 py-0.5 rounded-full text-zinc-600">{items.length}</span>
                </div>
                <div className="p-3 space-y-2 min-h-32">
                  {items.map((proj:any)=>(
                    <div key={proj.id} className="d-glass rounded-xl p-3 hover:border-white/10 transition-all cursor-pointer">
                      <p className="text-xs font-bold mb-1">{proj.name}</p>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${proj.progress??50}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)"}} />
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-[11px] text-zinc-800 text-center py-4">Empty</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
