"use client"

import { useState, useEffect } from "react"

const S = `
.sw-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06);border-radius:1.25rem;padding:1.25rem}
.sw-bar{height:.5rem;background:rgba(255,255,255,.05);border-radius:9999px;overflow:hidden}
.sw-bar-fill{height:100%;border-radius:9999px;transition:width .8s cubic-bezier(.34,1.56,.64,1)}
@keyframes swcount{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.sw-count{animation:swcount .4s ease-out}
@keyframes swpulse{0%,100%{opacity:.4}50%{opacity:1}}.sw-live{animation:swpulse 2s ease-in-out infinite}
`

// ─── STATS WIDGET ────────────────────────────────────────────────────────────
interface StatItem {
  label: string
  value: string | number
  icon?: string
  iconColor?: string
  borderColor?: string
  glowColor?: string
  sub?: string
  trend?: number
  progress?: number
  progressColor?: string
}

interface StatsWidgetProps {
  stats: StatItem[]
  loading?: boolean
  cols?: 2 | 3 | 4
}

function AnimatedValue({ value }: { value: string | number }) {
  const [displayed, setDisplayed] = useState(value)
  useEffect(() => { setDisplayed(value) }, [value])
  return <span key={String(value)} className="sw-count">{displayed}</span>
}

export function StatsWidget({ stats, loading, cols = 4 }: StatsWidgetProps) {
  const gridCols = { 2:"grid-cols-2", 3:"grid-cols-2 md:grid-cols-3", 4:"grid-cols-2 lg:grid-cols-4" }[cols]

  if (loading) {
    return (
      <div className={`grid gap-4 ${gridCols}`}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="sw-glass animate-pulse">
            <div className="h-3 w-16 rounded bg-white/5 mb-3" />
            <div className="h-8 w-24 rounded bg-white/5 mb-2" />
            <div className="h-2 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`grid gap-4 ${gridCols}`}>
      <style>{S}</style>
      {stats.map((stat, i) => (
        <div key={i} className="sw-glass" style={{
          borderColor: stat.borderColor ?? "rgba(255,255,255,.06)",
          boxShadow: stat.glowColor ? `0 0 30px ${stat.glowColor}` : undefined
        }}>
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-zinc-600 font-semibold">{stat.label}</p>
            {stat.icon && (
              <span className="text-base" style={{color: stat.iconColor ?? "rgba(255,255,255,.3)"}}>{stat.icon}</span>
            )}
          </div>
          <p className="text-3xl font-black mb-1 leading-none">
            <AnimatedValue value={stat.value} />
          </p>
          <div className="flex items-center gap-2">
            {stat.sub && <p className="text-xs text-zinc-600">{stat.sub}</p>}
            {stat.trend !== undefined && (
              <p className={`text-xs font-bold ${stat.trend > 0 ? "text-emerald-400" : stat.trend < 0 ? "text-red-400" : "text-zinc-600"}`}>
                {stat.trend > 0 ? "▲" : stat.trend < 0 ? "▼" : "—"} {Math.abs(stat.trend)}%
              </p>
            )}
          </div>
          {stat.progress !== undefined && (
            <div className="sw-bar mt-3">
              <div className="sw-bar-fill" style={{
                width: `${stat.progress}%`,
                background: stat.progressColor ?? "linear-gradient(90deg,#6366f1,#8b5cf6)"
              }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────
interface ActivityItem {
  id: string
  icon: string
  title: string
  description: string
  timestamp: string
  color?: string
}

interface ActivityFeedProps {
  items: ActivityItem[]
  loading?: boolean
  title?: string
}

export function ActivityFeed({ items, loading, title = "Recent Activity" }: ActivityFeedProps) {
  return (
    <div className="sw-glass overflow-hidden" style={{padding:0}}>
      <style>{S}</style>
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <p className="font-bold text-sm">{title}</p>
        <div className="flex items-center gap-1.5 text-xs text-zinc-700">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full sw-live" />
          Live
        </div>
      </div>
      <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-white/5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 bg-white/5 rounded" />
                <div className="h-2 w-48 bg-white/5 rounded" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-600">No recent activity</div>
        ) : (
          items.map(item => (
            <div key={item.id} className="px-5 py-3 flex gap-3 hover:bg-white/2 transition-all">
              <span className="text-lg shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-300 truncate">{item.title}</p>
                <p className="text-[11px] text-zinc-600 truncate">{item.description}</p>
              </div>
              <span className="text-[10px] text-zinc-700 shrink-0">{item.timestamp}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── AI USAGE METER ──────────────────────────────────────────────────────────
interface AIUsageMeterProps {
  used: number
  total: number
  plan?: string
  onUpgrade?: () => void
}

export function AIUsageMeter({ used, total, plan = "Pro", onUpgrade }: AIUsageMeterProps) {
  const pct = Math.min((used / total) * 100, 100)
  const critical = pct > 85
  const warning = pct > 65

  return (
    <div className="sw-glass" style={{borderColor: critical ? "rgba(239,68,68,.25)" : warning ? "rgba(245,158,11,.2)" : "rgba(139,92,246,.2)"}}>
      <style>{S}</style>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-purple-400">✦</span>
          <p className="font-bold text-sm">AI Token Usage</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/8 text-zinc-500 font-semibold">{plan}</span>
        </div>
        <p className="text-sm font-mono text-zinc-400">
          {used.toLocaleString()} / {total.toLocaleString()}
        </p>
      </div>
      <div className="sw-bar mb-2">
        <div className="sw-bar-fill" style={{
          width: `${pct}%`,
          background: critical ? "linear-gradient(90deg,#ef4444,#f97316)" : warning ? "linear-gradient(90deg,#f59e0b,#f97316)" : "linear-gradient(90deg,#6366f1,#8b5cf6)"
        }} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-600">{pct.toFixed(0)}% used this period</p>
        {onUpgrade && pct > 50 && (
          <button onClick={onUpgrade} className="text-xs text-purple-400 hover:underline font-semibold">
            Upgrade →
          </button>
        )}
      </div>
    </div>
  )
}

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────
interface QuickAction { label: string; icon: string; href: string; color: string; bg: string }

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div>
      <style>{S}</style>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((a, i) => (
          <a key={i} href={a.href}>
            <div className="sw-glass hover:-translate-y-1 hover:border-white/12 transition-all cursor-pointer text-center" style={{padding:"1rem"}}>
              <div className="w-10 h-10 rounded-xl mx-auto mb-2.5 flex items-center justify-center text-xl" style={{background: a.bg}}>
                <span style={{color: a.color}}>{a.icon}</span>
              </div>
              <p className="text-xs font-semibold text-zinc-400">{a.label}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── BILLING WIDGET ──────────────────────────────────────────────────────────
interface BillingWidgetProps {
  plan: string
  amount: number
  nextRenewal?: string
  status?: string
  onManage?: () => void
}

export function BillingWidget({ plan, amount, nextRenewal, status = "ACTIVE", onManage }: BillingWidgetProps) {
  return (
    <div className="sw-glass" style={{borderColor:"rgba(59,130,246,.2)", boxShadow:"0 0 25px rgba(59,130,246,.06)"}}>
      <style>{S}</style>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-zinc-600 mb-1">Current Plan</p>
          <p className="font-black text-xl text-blue-400">{plan}</p>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-full font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
          {status}
        </span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-2xl font-black">${(amount / 100).toFixed(2)}<span className="text-sm text-zinc-600">/mo</span></p>
        {nextRenewal && <p className="text-xs text-zinc-600">Renews {nextRenewal}</p>}
      </div>
      {onManage && (
        <button onClick={onManage}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all border border-white/10 text-zinc-400 hover:text-white hover:border-white/20">
          Manage Subscription →
        </button>
      )}
    </div>
  )
}
