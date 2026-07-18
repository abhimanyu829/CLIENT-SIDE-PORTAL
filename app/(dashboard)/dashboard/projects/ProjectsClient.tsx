"use client"

import { useState } from "react"
import Link from "next/link"

const S = `
.d-glass{background:hsl(var(--card));backdrop-filter:blur(20px);border:1px solid hsl(var(--border))}
.d-btn{background:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.d-btn:hover{background:hsl(var(--primary)/0.9)}
.d-card{transition:all .3s ease}.d-card:hover{transform:translateY(-3px);border-color:hsl(var(--primary)/0.3);box-shadow:0 10px 30px -10px hsl(var(--primary)/0.1)}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.d-live{animation:db 2s ease-in-out infinite}
`

const STATUS_STYLE: Record<string,{label:string,color:string,bg:string,border:string}> = {
  PLANNING:  {label:"Planning",  color:"text-muted-foreground",    bg:"hsl(var(--muted)/0.3)", border:"border-border"},
  ACTIVE:    {label:"Active",    color:"text-emerald-600", bg:"rgba(16,185,129,.1)", border:"border-emerald-500/30"},
  REVIEW:    {label:"Review",    color:"text-blue-600",    bg:"rgba(59,130,246,.1)",  border:"border-blue-500/30"},
  DELIVERED: {label:"Delivered", color:"text-primary",  bg:"rgba(234,88,12,.1)", border:"border-primary/30"},
  ARCHIVED:  {label:"Archived",  color:"text-muted-foreground",    bg:"hsl(var(--muted)/0.5)",        border:"border-border"},
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
          <h1 className="text-3xl font-black tracking-tight font-sans">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your active deliverables and project milestones.</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* View toggle */}
          <div className="d-glass rounded-xl p-1 flex gap-1">
            {[["grid","⊞"],["kanban","⊟"]].map(([v,icon])=>(
              <button key={v} onClick={()=>setView(v as any)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${view===v?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>
                {icon}
              </button>
            ))}
          </div>
          <button className="d-btn px-4 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-all">
            + New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_STYLE).slice(0,4).map(([status, style])=>(
          <div key={status} className={`d-glass rounded-2xl p-4 border ${style.border} text-center`}>
            <p className={`text-2xl font-black ${style.color}`}>{byStatus(status).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{style.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full d-glass rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-background" />
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
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-background" style={{border:`1px solid ${style.border.replace("border-","")}`}}>
                    ◻
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${style.border} ${style.color} bg-background/50`}>
                    {style.label}
                  </span>
                </div>
                <h3 className="font-black text-base mb-1 text-foreground">{proj.name}</h3>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{proj.description ?? "No description provided."}</p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-bold ${style.color}`}>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all bg-primary" style={{width:`${progress}%`}} />
                  </div>
                </div>

                {/* Milestones */}
                <div className="space-y-1.5 mb-4">
                  {["Design System","Backend API","Frontend UI"].slice(0, 2).map((m,i)=>(
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={i===0?"text-emerald-500":"text-muted-foreground"}>{i===0?"✓":"○"}</span>
                      <span className={i===0?"text-muted-foreground line-through":"text-foreground"}>{m}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex -space-x-2">
                    {["A","B"].map((l,i)=>(
                      <div key={i} className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[9px] font-black border border-background text-primary-foreground">{l}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full d-live" />
                    Active
                  </div>
                </div>
              </div>
            )
          }) : (
            <div className="col-span-3 py-16 text-center">
              <div className="text-5xl mb-4 text-muted-foreground">◻</div>
              <p className="text-muted-foreground text-sm">No projects yet</p>
              <button className="mt-4 d-btn px-5 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-all">
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
              <div key={status} className="d-glass rounded-2xl overflow-hidden bg-card/50">
                <div className={`px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20`}>
                  <span className={`text-xs font-bold ${style.color}`}>{style.label}</span>
                  <span className="d-glass text-xs px-2 py-0.5 rounded-full text-muted-foreground bg-background">{items.length}</span>
                </div>
                <div className="p-3 space-y-2 min-h-32">
                  {items.map((proj:any)=>(
                    <div key={proj.id} className="d-glass rounded-xl p-3 hover:border-primary/30 transition-all cursor-pointer bg-background">
                      <p className="text-xs font-bold mb-1 text-foreground">{proj.name}</p>
                      <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
                        <div className="h-full rounded-full bg-primary" style={{width:`${proj.progress??50}%`}} />
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-4">Empty</p>
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
