"use client"

import { useState } from "react"

const S = `
.cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);z-index:200;display:flex;align-items:center;justify-content:center;padding:1.5rem}
@keyframes cdslide{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}.cd-modal{animation:cdslide .2s ease-out}
.cd-glass{background:rgba(18,18,24,.95);border:1px solid rgba(255,255,255,.1);border-radius:1.5rem;padding:2rem;max-width:26rem;width:100%}
.cd-btn-danger{background:linear-gradient(135deg,#dc2626,#ef4444);border-radius:.875rem;padding:.75rem 1.5rem;font-weight:800;color:#fff;transition:all .2s;cursor:pointer}
.cd-btn-danger:hover{opacity:.9;transform:scale(1.02)}
.cd-btn-ghost{border:1px solid rgba(255,255,255,.1);border-radius:.875rem;padding:.75rem 1.5rem;font-weight:700;color:rgba(255,255,255,.6);transition:all .2s;cursor:pointer}
.cd-btn-ghost:hover{border-color:rgba(255,255,255,.2);color:#fff}
`

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning" | "default"
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  variant = "danger", onConfirm, onCancel, loading
}: ConfirmDialogProps) {
  if (!open) return null

  const icon = variant === "danger" ? "⚠" : variant === "warning" ? "⚡" : "◈"
  const iconColor = variant === "danger" ? "text-red-400" : variant === "warning" ? "text-amber-400" : "text-purple-400"
  const iconBg = variant === "danger" ? "rgba(239,68,68,.1)" : variant === "warning" ? "rgba(245,158,11,.1)" : "rgba(139,92,246,.1)"

  return (
    <div className="cd-overlay" onClick={onCancel}>
      <style>{S}</style>
      <div className="cd-glass cd-modal" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
          style={{background:iconBg}}>
          <span className={iconColor}>{icon}</span>
        </div>
        <h3 className="font-black text-xl mb-2">{title}</h3>
        {description && <p className="text-sm text-zinc-500 leading-relaxed mb-6">{description}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="cd-btn-ghost flex-1">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading}
            className="cd-btn-danger flex-1">
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── NOTIFICATION BELL ────────────────────────────────────────────────────────
interface Notification {
  id: string
  title: string
  message?: string
  type?: "info" | "success" | "warning" | "error"
  timestamp?: string
  read?: boolean
}

interface NotificationBellProps {
  notifications: Notification[]
  onRead?: (id: string) => void
  onReadAll?: () => void
}

const NOTIF_TYPE_STYLE: Record<string, string> = {
  success: "text-emerald-400 bg-emerald-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  error:   "text-red-400 bg-red-500/10",
  info:    "text-blue-400 bg-blue-500/10",
}
const NOTIF_ICON: Record<string, string> = {
  success:"✓", warning:"⚠", error:"✕", info:"ℹ"
}

export function NotificationBell({ notifications, onRead, onReadAll }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="relative">
      <style>{S}</style>
      <button onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)"}}>
        <span className="text-zinc-400 text-base">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center"
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff"}}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 rounded-2xl overflow-hidden z-50 shadow-2xl shadow-black/50"
          style={{background:"rgba(16,16,22,.97)",border:"1px solid rgba(255,255,255,.1)"}}>
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="font-black text-sm">Notifications</p>
            {unread > 0 && (
              <button onClick={onReadAll} className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-semibold">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-700">No notifications</p>
            ) : notifications.map(n => (
              <button key={n.id} onClick={() => onRead?.(n.id)}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-white/3 transition-all ${n.read ? "opacity-50" : ""}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${NOTIF_TYPE_STYLE[n.type ?? "info"]}`}>
                  {NOTIF_ICON[n.type ?? "info"]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-zinc-300 truncate">{n.title}</p>
                  {n.message && <p className="text-[11px] text-zinc-600 truncate">{n.message}</p>}
                  {n.timestamp && <p className="text-[10px] text-zinc-800 mt-0.5">{n.timestamp}</p>}
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
export function ThemeToggle() {
  const [dark, setDark] = useState(true)
  return (
    <button onClick={() => setDark(d => !d)}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-all"
      style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}>
      {dark ? "☀" : "🌙"}
    </button>
  )
}

// ─── INLINE ALERT ─────────────────────────────────────────────────────────────
interface InlineAlertProps {
  type: "info" | "success" | "warning" | "error"
  title?: string
  message: string
  onDismiss?: () => void
}
const ALERT_STYLES: Record<string, {border:string;bg:string;icon:string;color:string}> = {
  info:    {border:"rgba(59,130,246,.25)",    bg:"rgba(59,130,246,.06)",    icon:"ℹ",color:"#60a5fa"},
  success: {border:"rgba(16,185,129,.25)",    bg:"rgba(16,185,129,.06)",    icon:"✓",color:"#34d399"},
  warning: {border:"rgba(245,158,11,.25)",    bg:"rgba(245,158,11,.06)",    icon:"⚠",color:"#fbbf24"},
  error:   {border:"rgba(239,68,68,.25)",     bg:"rgba(239,68,68,.06)",     icon:"✕",color:"#f87171"},
}
export function InlineAlert({ type, title, message, onDismiss }: InlineAlertProps) {
  const s = ALERT_STYLES[type]
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{border:`1px solid ${s.border}`,background:s.bg}}>
      <span className="text-sm mt-0.5" style={{color:s.color}}>{s.icon}</span>
      <div className="flex-1">
        {title && <p className="text-xs font-bold mb-0.5" style={{color:s.color}}>{title}</p>}
        <p className="text-xs text-zinc-400">{message}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-zinc-700 hover:text-zinc-400 transition-colors text-sm shrink-0">✕</button>
      )}
    </div>
  )
}
