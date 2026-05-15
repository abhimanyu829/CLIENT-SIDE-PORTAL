"use client"

import { useState, useEffect, useCallback } from "react"

const S = `
.dt-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06);border-radius:1.25rem}
@keyframes dtring{0%,100%{transform:scale(1) rotate(0)}25%{transform:scale(1.05) rotate(-5deg)}75%{transform:scale(1.05) rotate(5deg)}}.dt-ring{animation:dtring .4s ease-in-out}
@keyframes dtpulse{0%{box-shadow:0 0 0 0 rgba(245,158,11,.4)}100%{box-shadow:0 0 0 12px rgba(245,158,11,0)}}.dt-pulse{animation:dtpulse 1.5s infinite}
@keyframes dtcrit{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}100%{box-shadow:0 0 0 12px rgba(239,68,68,0)}}.dt-crit{animation:dtcrit 1s infinite}
`

interface DemoTimerProps {
  duration?: number       // seconds
  onExpire?: () => void
  sessionId?: string
}

export function DemoTimer({ duration = 300, onExpire, sessionId }: DemoTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const [expired, setExpired] = useState(false)

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

  useEffect(() => {
    if (timeLeft <= 0) {
      setExpired(true)
      onExpire?.()
      return
    }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [timeLeft, onExpire])

  const pct = ((duration - timeLeft) / duration) * 100
  const critical = timeLeft <= 60
  const warning = timeLeft <= 120

  const color = critical ? "#ef4444" : warning ? "#f59e0b" : "#10b981"
  const glowClass = critical ? "dt-crit" : warning ? "dt-pulse" : ""

  return (
    <div className="dt-glass inline-flex items-center gap-3 px-4 py-2.5">
      <style>{S}</style>

      {/* Circle progress */}
      <div className={`relative w-10 h-10 shrink-0 ${glowClass}`} style={{borderRadius:"50%"}}>
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="2.5" />
          <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={`${94.2 * (1 - pct / 100)} 94.2`} strokeLinecap="round"
            style={{transition:"stroke-dasharray .5s ease"}}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-black" style={{color}}>{expired ? "✕" : "▶"}</span>
        </div>
      </div>

      {/* Time display */}
      <div>
        <p className="text-[10px] text-zinc-700 uppercase tracking-widest leading-none mb-0.5">Session</p>
        <p className="font-black text-base font-mono leading-none" style={{color: expired ? "#ef4444" : "white"}}>
          {expired ? "Expired" : fmt(timeLeft)}
        </p>
      </div>

      {/* Warning label */}
      {critical && !expired && (
        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">ENDING SOON</span>
      )}
    </div>
  )
}

// ─── DEMO NAV ─────────────────────────────────────────────────────────────────
interface DemoNavProps {
  template: string
  onTemplateChange: (t: string) => void
  sessionId?: string
  timeLeft?: number
}

const TEMPLATES = [
  { id: "CRM",       label: "CRM",       icon: "◈", color: "text-blue-400" },
  { id: "CHATBOT",   label: "Chatbot",   icon: "✦", color: "text-purple-400" },
  { id: "ANALYTICS", label: "Analytics", icon: "◑", color: "text-emerald-400" },
]

export function DemoNav({ template, onTemplateChange, sessionId }: DemoNavProps) {
  return (
    <div className="dt-glass flex items-center gap-2 p-2">
      <style>{S}</style>
      <div className="flex items-center gap-1.5 mr-2 pl-1">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
      </div>
      <p className="text-xs text-zinc-600 mr-3 hidden sm:block">
        {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : "Demo Mode"}
      </p>
      <div className="flex gap-1">
        {TEMPLATES.map(t => (
          <button key={t.id} onClick={() => onTemplateChange(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={template === t.id ? {background:"rgba(139,92,246,.2)",border:"1px solid rgba(139,92,246,.35)"} : {border:"1px solid transparent",color:"rgba(255,255,255,.4)"}}>
            <span className={template === t.id ? t.color : ""}>{t.icon}</span>
            <span className={template === t.id ? "text-white" : ""}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── RUNTIME STATUS ──────────────────────────────────────────────────────────
interface RuntimeStatusProps {
  status: "idle" | "running" | "processing" | "error"
  latency?: number
  requestCount?: number
}

export function RuntimeStatus({ status, latency = 0, requestCount = 0 }: RuntimeStatusProps) {
  const statusConfig = {
    idle:       { label: "Idle",       color: "text-zinc-500",    dot: "bg-zinc-600" },
    running:    { label: "Running",    color: "text-emerald-400", dot: "bg-emerald-400" },
    processing: { label: "Processing", color: "text-amber-400",   dot: "bg-amber-400" },
    error:      { label: "Error",      color: "text-red-400",     dot: "bg-red-400" },
  }[status]

  return (
    <div className="dt-glass flex items-center gap-4 px-4 py-2.5">
      <style>{S}</style>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusConfig.dot} ${status === "running" ? "animate-pulse" : ""}`} />
        <span className={`text-xs font-bold ${statusConfig.color}`}>{statusConfig.label}</span>
      </div>
      {latency > 0 && (
        <div className="text-xs text-zinc-600 font-mono">
          <span className="text-zinc-500">Latency: </span>{latency}ms
        </div>
      )}
      {requestCount > 0 && (
        <div className="text-xs text-zinc-600 font-mono">
          <span className="text-zinc-500">Calls: </span>{requestCount.toLocaleString()}
        </div>
      )}
    </div>
  )
}
