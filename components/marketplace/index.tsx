"use client"

import { useState } from "react"
import Link from "next/link"

const S = `
.tc-glass{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:1.25rem;padding:1.75rem;transition:all .3s;position:relative;overflow:hidden}
.tc-glass:hover{border-color:rgba(255,255,255,.12);transform:translateY(-4px);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.tc-popular{border-color:rgba(139,92,246,.4)!important;background:rgba(139,92,246,.08)!important}
.tc-popular::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#60a5fa)}
.tc-cta{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.875rem;padding:.75rem 1.5rem;font-weight:800;color:#fff;width:100%;transition:all .2s;cursor:pointer}
.tc-cta:hover{opacity:.9;transform:scale(1.02)}
.tc-ghost{border:1px solid rgba(255,255,255,.12);border-radius:.875rem;padding:.75rem 1.5rem;font-weight:700;color:rgba(255,255,255,.6);width:100%;transition:all .2s;cursor:pointer}
.tc-ghost:hover{border-color:rgba(255,255,255,.25);color:#fff}
.tc-feature{font-size:.8125rem;color:rgba(255,255,255,.55);display:flex;align-items:flex-start;gap:.625rem;line-height:1.5}
.tc-check{color:#8b5cf6;flex-shrink:0;margin-top:.15rem}
.tc-gradient{background:linear-gradient(135deg,#fff,#a78bfa 60%,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
`

export interface TierData {
  id: string
  name: string
  price?: number | null
  billingPeriod?: "monthly" | "yearly"
  description?: string
  features?: string[]
  popular?: boolean
  cta?: string
  ctaHref?: string
  onSelect?: () => void
  badge?: string
}

interface TierCardProps extends TierData {
  selected?: boolean
}

export function TierCard({
  name, price, billingPeriod = "monthly", description, features = [],
  popular, cta = "Get started", ctaHref, onSelect, badge, selected
}: TierCardProps) {
  return (
    <div className={`tc-glass ${popular ? "tc-popular" : ""} ${selected ? "border-violet-500/50 shadow-violet-500/10 shadow-xl" : ""}`}>
      <style>{S}</style>

      {(popular || badge) && (
        <div className="absolute top-4 right-4 text-[9px] font-black px-2.5 py-1 rounded-full tracking-widest"
          style={{background:"rgba(139,92,246,.2)",border:"1px solid rgba(139,92,246,.35)",color:"#c4b5fd"}}>
          {badge ?? "POPULAR"}
        </div>
      )}

      <p className="font-black text-xl mb-1">{name}</p>
      {description && <p className="text-xs text-zinc-600 mb-5 leading-relaxed">{description}</p>}

      <div className="mb-6">
        {price === null || price === undefined ? (
          <p className="text-4xl font-black tc-gradient">Custom</p>
        ) : price === 0 ? (
          <p className="text-4xl font-black">Free</p>
        ) : (
          <div className="flex items-baseline gap-1">
            <p className="text-4xl font-black">${price}</p>
            <p className="text-zinc-600 text-sm">/{billingPeriod === "yearly" ? "yr" : "mo"}</p>
          </div>
        )}
      </div>

      <div className="space-y-2.5 mb-7">
        {features.map((f, i) => (
          <p key={i} className="tc-feature">
            <span className="tc-check">✓</span> {f}
          </p>
        ))}
      </div>

      {ctaHref ? (
        <Link href={ctaHref}>
          <button className={popular ? "tc-cta" : "tc-ghost"}>{cta}</button>
        </Link>
      ) : (
        <button onClick={onSelect} className={popular ? "tc-cta" : "tc-ghost"}>{cta}</button>
      )}
    </div>
  )
}

// ─── REVIEW CARD ─────────────────────────────────────────────────────────────

interface ReviewCardProps {
  author: string
  avatarUrl?: string | null
  rating: number
  content: string
  date?: string
  role?: string
  verified?: boolean
}

export function ReviewCard({ author, avatarUrl, rating, content, date, role, verified }: ReviewCardProps) {
  const initials = author.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <div className="tc-glass" style={{padding:"1.25rem"}}>
      <style>{S}</style>
      <div className="flex items-start gap-3 mb-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={author} className="w-9 h-9 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
            <span className="text-white">{initials}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold">{author}</p>
            {verified && <span className="text-[9px] text-blue-400 font-black">✓ VERIFIED</span>}
          </div>
          {role && <p className="text-xs text-zinc-600">{role}</p>}
        </div>
        {date && <p className="text-xs text-zinc-700 shrink-0">{date}</p>}
      </div>
      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`text-sm ${i < rating ? "text-amber-400" : "text-zinc-700"}`}>★</span>
        ))}
      </div>
      <p className="text-sm text-zinc-500 leading-relaxed">&ldquo;{content}&rdquo;</p>
    </div>
  )
}

// ─── PRODUCT FILTERS ─────────────────────────────────────────────────────────

interface FilterState {
  type: string
  sort: string
  search: string
}

interface ProductFiltersProps {
  value: FilterState
  onChange: (f: FilterState) => void
  resultCount?: number
}

const TYPES = [
  { value:"ALL",          label:"All" },
  { value:"SAAS_PRODUCT", label:"SaaS" },
  { value:"AI_AGENT",     label:"AI Agents" },
  { value:"TEMPLATE",     label:"Templates" },
  { value:"API",          label:"APIs" },
  { value:"WORKFLOW",     label:"Workflows" },
]
const SORTS = [
  { value:"newest",   label:"Newest" },
  { value:"popular",  label:"Popular" },
  { value:"rating",   label:"Highest Rated" },
  { value:"price_asc",label:"Price: Low" },
]

export function ProductFilters({ value, onChange, resultCount }: ProductFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <style>{S}</style>
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">⌕</span>
        <input
          value={value.search}
          onChange={e => onChange({ ...value, search: e.target.value })}
          placeholder="Search products..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-700 outline-none"
          style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}
        />
      </div>

      {/* Type filters */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPES.map(t => (
          <button key={t.value}
            onClick={() => onChange({ ...value, type: t.value })}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={value.type === t.value
              ? {background:"rgba(139,92,246,.2)",border:"1px solid rgba(139,92,246,.4)",color:"#c4b5fd"}
              : {background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",color:"rgba(255,255,255,.45)"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <select
        value={value.sort}
        onChange={e => onChange({ ...value, sort: e.target.value })}
        className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 outline-none"
        style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}>
        {SORTS.map(s => (
          <option key={s.value} value={s.value} style={{background:"#111"}}>{s.label}</option>
        ))}
      </select>

      {resultCount !== undefined && (
        <p className="text-xs text-zinc-700 ml-auto">{resultCount.toLocaleString()} results</p>
      )}
    </div>
  )
}
