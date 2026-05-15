// components/shared/index.tsx — Centralized shared utility components

// ─── AVATAR ─────────────────────────────────────────────────────────────────
interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}
const AVATAR_SIZES = { xs:"w-6 h-6 text-[9px]", sm:"w-8 h-8 text-xs", md:"w-10 h-10 text-sm", lg:"w-16 h-16 text-lg" }
export function Avatar({ name, src, size = "md", className = "" }: AvatarProps) {
  const initials = name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() ?? "?"
  const cls = `${AVATAR_SIZES[size]} rounded-xl flex items-center justify-center font-black shrink-0 ${className}`
  if (src) return <img src={src} alt={name ?? "User"} className={`${cls} object-cover`} />
  return (
    <div className={cls} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
      <span className="text-white">{initials}</span>
    </div>
  )
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "purple" | "amber"
const BADGE_STYLES: Record<BadgeVariant, string> = {
  default: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  error:   "bg-red-500/10 text-red-400 border-red-500/20",
  info:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  purple:  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  amber:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
}
interface BadgeProps { label: string; variant?: BadgeVariant; className?: string }
export function Badge({ label, variant = "default", className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-widest ${BADGE_STYLES[variant]} ${className}`}>
      {label}
    </span>
  )
}

// ─── STATUS PILL ─────────────────────────────────────────────────────────────
interface StatusPillProps { status: string; dot?: boolean }
const STATUS_MAP: Record<string, { color: string; bg: string; border: string }> = {
  ACTIVE:       { color:"text-emerald-400", bg:"bg-emerald-500/10", border:"border-emerald-500/20" },
  OPEN:         { color:"text-emerald-400", bg:"bg-emerald-500/10", border:"border-emerald-500/20" },
  IN_PROGRESS:  { color:"text-blue-400",    bg:"bg-blue-500/10",    border:"border-blue-500/20" },
  WAITING:      { color:"text-amber-400",   bg:"bg-amber-500/10",   border:"border-amber-500/20" },
  PENDING:      { color:"text-amber-400",   bg:"bg-amber-500/10",   border:"border-amber-500/20" },
  RESOLVED:     { color:"text-zinc-400",    bg:"bg-zinc-700/20",    border:"border-zinc-700/30" },
  PAID:         { color:"text-emerald-400", bg:"bg-emerald-500/10", border:"border-emerald-500/20" },
  FAILED:       { color:"text-red-400",     bg:"bg-red-500/10",     border:"border-red-500/20" },
  CLOSED:       { color:"text-zinc-600",    bg:"bg-zinc-900/50",    border:"border-zinc-800/30" },
  CANCELLED:    { color:"text-red-400",     bg:"bg-red-500/10",     border:"border-red-500/20" },
  DELIVERED:    { color:"text-purple-400",  bg:"bg-purple-500/10",  border:"border-purple-500/20" },
  ARCHIVED:     { color:"text-zinc-600",    bg:"bg-zinc-900/50",    border:"border-zinc-800/30" },
}
export function StatusPill({ status, dot = true }: StatusPillProps) {
  const s = STATUS_MAP[status] ?? { color:"text-zinc-500", bg:"bg-zinc-800/40", border:"border-zinc-700/30" }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${s.bg} ${s.border} ${s.color}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${s.color.replace("text-","bg-")}`} />}
      {status.replace(/_/g, " ")}
    </span>
  )
}

// ─── LOADING SPINNER ─────────────────────────────────────────────────────────
interface SpinnerProps { size?: number; className?: string }
export function LoadingSpinner({ size = 24, className = "" }: SpinnerProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="url(#sg)" strokeWidth="3" strokeLinecap="round">
        <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
      </path>
    </svg>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}
export function EmptyState({ icon = "◈", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="text-5xl mb-4 opacity-30">{icon}</div>
      <p className="text-lg font-bold text-zinc-400 mb-2">{title}</p>
      {description && <p className="text-sm text-zinc-600 max-w-sm">{description}</p>}
      {action && (
        <button onClick={action.onClick}
          className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
          style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
          {action.label}
        </button>
      )}
    </div>
  )
}

// ─── ERROR STATE ──────────────────────────────────────────────────────────────
interface ErrorStateProps { title?: string; description?: string; retry?: () => void }
export function ErrorState({ title = "Something went wrong", description, retry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="text-5xl mb-4">⚠</div>
      <p className="text-lg font-bold text-red-400 mb-2">{title}</p>
      {description && <p className="text-sm text-zinc-600 max-w-sm">{description}</p>}
      {retry && (
        <button onClick={retry}
          className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold border border-white/10 text-zinc-300 hover:text-white hover:border-white/20 transition-all">
          Try again
        </button>
      )}
    </div>
  )
}

// ─── COPY BUTTON ─────────────────────────────────────────────────────────────
"use client"
import { useState } from "react"
interface CopyButtonProps { text: string; label?: string }
export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-white/8 text-zinc-500 hover:text-zinc-300 hover:border-white/15">
      {copied ? "✓ Copied" : label}
    </button>
  )
}

// ─── SEARCH INPUT ─────────────────────────────────────────────────────────────
interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}
export function SearchInput({ value, onChange, placeholder = "Search...", className = "" }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm select-none">⌕</span>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-700 rounded-xl outline-none transition-all"
        style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}
        onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,.5)" }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.07)" }}
      />
    </div>
  )
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
interface SectionHeaderProps { eyebrow?: string; title: string; subtitle?: string; centered?: boolean }
export function SectionHeader({ eyebrow, title, subtitle, centered = true }: SectionHeaderProps) {
  return (
    <div className={`mb-12 ${centered ? "text-center" : ""}`}>
      {eyebrow && <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">{eyebrow}</p>}
      <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">{title}</h2>
      {subtitle && <p className="text-zinc-500 text-lg max-w-xl mx-auto leading-relaxed">{subtitle}</p>}
    </div>
  )
}

// ─── SKELETON ────────────────────────────────────────────────────────────────
interface SkeletonProps { className?: string; lines?: number }
export function Skeleton({ className = "", lines }: SkeletonProps) {
  if (lines) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`h-4 rounded-lg animate-pulse ${i === lines - 1 ? "w-3/4" : "w-full"}`}
            style={{background:"rgba(255,255,255,.06)"}} />
        ))}
      </div>
    )
  }
  return <div className={`rounded-xl animate-pulse ${className}`} style={{background:"rgba(255,255,255,.06)"}} />
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────
interface PaginationProps { page: number; total: number; perPage?: number; onChange: (p: number) => void }
export function Pagination({ page, total, perPage = 10, onChange }: PaginationProps) {
  const pages = Math.ceil(total / perPage)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-6">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-white/8 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed">
        ← Prev
      </button>
      <div className="flex gap-1">
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === p ? "text-white" : "text-zinc-600 hover:text-zinc-300 border border-transparent hover:border-white/8"}`}
            style={page === p ? {background:"linear-gradient(135deg,#6366f1,#8b5cf6)"} : {}}>
            {p}
          </button>
        ))}
      </div>
      <button disabled={page === pages} onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-white/8 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed">
        Next →
      </button>
    </div>
  )
}
