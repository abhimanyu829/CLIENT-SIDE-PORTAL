"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

interface TargetedCampaign {
  id: string
  name: string
  description: string | null
  bannerUrl: string | null
  ctaLabel: string | null
  landingUrl: string | null
  endsAt: string | null
}

interface VisitorContext {
  visitorType: "guest" | "logged_in" | "paid_customer" | "free_user"
  hasPurchased: boolean
  purchaseCount: number
}

const VISITOR_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  guest: { label: "New Visitor", color: "bg-sky-500/20 text-sky-700 border-sky-300/40", icon: "👤" },
  logged_in: { label: "Signed In", color: "bg-emerald-500/20 text-emerald-700 border-emerald-300/40", icon: "✅" },
  paid_customer: { label: "Customer", color: "bg-amber-500/20 text-amber-800 border-amber-300/40", icon: "⭐" },
  free_user: { label: "Free User", color: "bg-purple-500/20 text-purple-700 border-purple-300/40", icon: "🔓" },
}

const TYPE_STYLES: Record<string, string> = {
  FESTIVAL: "from-purple-600/70 via-indigo-600/50 to-blue-600/40 border-purple-400/30",
  FLASH: "from-red-600/70 via-orange-600/50 to-yellow-600/40 border-red-400/30",
  BLACKFRIDAY: "from-zinc-900/90 via-zinc-800/70 to-zinc-900/90 border-white/10",
  DEFAULT: "from-amber-700/60 via-orange-600/40 to-amber-500/30 border-amber-400/30",
}

export default function SmartCampaignBanner() {
  const pathname = usePathname()
  const [campaign, setCampaign] = useState<TargetedCampaign | null>(null)
  const [context, setContext] = useState<VisitorContext | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/campaigns/targeted?page=${encodeURIComponent(pathname)}`, {
          cache: "no-store",
        })
        if (!res.ok || cancelled) return
        const json = await res.json()
        if (!json.success || cancelled) return

        const campaigns: TargetedCampaign[] = json.data
        if (campaigns.length === 0) return

        // Show the top-priority campaign that hasn't been dismissed
        const firstVisible = campaigns.find((c) => {
          try {
            return localStorage.getItem(`sc_banner_dismissed_${c.id}`) !== "true"
          } catch {
            return true
          }
        })
        if (firstVisible && !cancelled) {
          setCampaign(firstVisible)
          setContext(json.visitorContext)
        }
      } catch (err) {
        // Silently ignore — banner is non-critical
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    fetchCampaign()
    return () => { cancelled = true }
  }, [pathname])

  const dismiss = () => {
    if (!campaign) return
    try {
      localStorage.setItem(`sc_banner_dismissed_${campaign.id}`, "true")
    } catch {}
    setDismissed(true)
  }

  if (!loaded || !campaign || dismissed) return null
  if (campaign.endsAt && new Date(campaign.endsAt) <= new Date()) return null

  const visitorInfo = context ? VISITOR_LABELS[context.visitorType] : null
  const bg = TYPE_STYLES.DEFAULT

  return (
    <div
      className={`relative bg-gradient-to-r ${bg} border-b border-t backdrop-blur-sm overflow-hidden transition-all`}
      role="banner"
      aria-label="Special Campaign Banner"
    >
      {/* Subtle animated shimmer */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] animate-[shimmer_3s_linear_infinite] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Visitor type badge */}
          {visitorInfo && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${visitorInfo.color} uppercase tracking-wider`}
            >
              {visitorInfo.icon} {visitorInfo.label}
            </span>
          )}

          {/* Campaign message */}
          <span className="text-sm font-semibold text-white">
            {campaign.description ?? campaign.name}
          </span>

          {/* Countdown if endsAt is set */}
          {campaign.endsAt && (
            <CampaignCountdown endsAt={campaign.endsAt} />
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* CTA button */}
          {campaign.landingUrl && campaign.ctaLabel && (
            <a
              href={campaign.landingUrl}
              className="bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-all hover:scale-105 whitespace-nowrap"
            >
              {campaign.ctaLabel} →
            </a>
          )}

          {/* Dismiss */}
          <button
            onClick={dismiss}
            aria-label="Dismiss banner"
            className="text-white/40 hover:text-white/90 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// Inline countdown (no dependency on external CountdownTimer to keep this self-contained)
function CampaignCountdown({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    function calc() {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft("Ended"); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <span className="text-amber-300 font-mono text-xs">
      ⏱ Ends in: <strong>{timeLeft}</strong>
    </span>
  )
}
