"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowRight, ExternalLink, X, Volume2, VolumeX, Play, Pause } from "lucide-react"

// ─── Auto-playing video that bypasses browser autoplay restrictions ────────────
function AutoPlayingVideo({ src, loop = true }: { src: string; loop?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || !src) return
    el.muted = true
    el.playsInline = true
    el.load()
    const tryPlay = () => {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
    el.readyState >= 3 ? tryPlay() : el.addEventListener("canplay", tryPlay, { once: true })
    return () => el.removeEventListener("canplay", tryPlay)
  }, [src])

  const togglePlay = () => {
    const el = ref.current
    if (!el) return
    el.paused ? el.play().then(() => setPlaying(true)).catch(() => {}) : (el.pause(), setPlaying(false))
  }
  const toggleMute = () => {
    const el = ref.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
  }

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden group">
      <video ref={ref} src={src} loop={loop} muted={muted} playsInline className="w-full h-full object-cover" />
      {/* Controls overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={togglePlay}
          className="flex items-center gap-1.5 bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 hover:bg-black transition-all">
          {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={toggleMute}
          className="flex items-center gap-1.5 bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 hover:bg-black transition-all">
          {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          {muted ? "Unmute" : "Sound"}
        </button>
      </div>
      {playing && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" /> LIVE VIDEO
        </div>
      )}
    </div>
  )
}

// ─── Countdown timer ───────────────────────────────────────────────────────────
function Countdown({ endsAt }: { endsAt: string }) {
  const [t, setT] = useState("")
  useEffect(() => {
    const tick = () => {
      const d = new Date(endsAt).getTime() - Date.now()
      if (d <= 0) return setT("Ended")
      const h = Math.floor(d / 3_600_000)
      const m = Math.floor((d % 3_600_000) / 60_000)
      const s = Math.floor((d % 60_000) / 1_000)
      setT(h > 0 ? `${h}h ${m}m left` : `${m}m ${s}s left`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [endsAt])
  if (!t) return null
  return <span className="text-xs font-mono font-semibold text-amber-300 bg-amber-950/70 border border-amber-500/30 px-3 py-1 rounded-full">⏱ {t}</span>
}

interface Campaign {
  id: string
  name: string
  description: string | null
  bannerUrl: string | null
  videoUrl: string | null
  ctaLabel: string | null
  landingUrl: string | null
  endsAt: string | null
  targetAudience: Record<string, any> | null
}

const BUTTON_STYLES: Record<string, string> = {
  gradient_gold: "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-zinc-950 font-bold hover:brightness-110 shadow-lg shadow-amber-500/30",
  neon_cyber: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:brightness-110 shadow-lg shadow-cyan-500/30",
  glass: "bg-white/15 backdrop-blur border border-white/40 text-white font-bold hover:bg-white/25",
  dark_bold: "bg-zinc-900 border border-zinc-700 text-white font-bold hover:bg-zinc-800",
  emerald_active: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:brightness-110 shadow-lg shadow-emerald-500/30",
}

const BADGE_COLORS: Record<string, string> = {
  amber: "bg-amber-400 text-amber-950 font-bold",
  emerald: "bg-emerald-400 text-emerald-950 font-bold",
  crimson: "bg-red-500 text-white font-bold",
  violet: "bg-violet-500 text-white font-bold",
  gold: "bg-yellow-400 text-yellow-950 font-black",
  cyan: "bg-cyan-400 text-cyan-950 font-bold",
}

// ─── Centered Large Campaign Modal Component ─────────────────────────────────
export default function SmartCampaignBanner() {
  const pathname = usePathname()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let alive = true
    setCampaign(null)
    setDismissed(false)
    setVisible(false)
    ;(async () => {
      try {
        const r = await fetch(`/api/campaigns/targeted?page=${encodeURIComponent(pathname)}`, { cache: "no-store" })
        if (!alive) return          // component unmounted / route changed — bail silently
        if (!r.ok) {
          console.error("[SmartCampaignBanner] API error:", r.status, r.statusText)
          return
        }
        const j = await r.json()
        if (!alive) return
        if (!j.success) {
          console.error("[SmartCampaignBanner] API returned success=false", j)
          return
        }
        const list: Campaign[] = j.data ?? []
        // Use sessionStorage so campaigns reappear on every new browser session
        const pick = list.find(c => {
          try { return sessionStorage.getItem(`scb_dismissed_${c.id}`) !== "1" } catch { return true }
        })
        if (pick && alive) {
          setCampaign(pick)
          setTimeout(() => { if (alive) setVisible(true) }, 600)
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("[SmartCampaignBanner] Fetch exception:", err)
        }
      }
    })()
    return () => { alive = false }
  }, [pathname])

  const dismiss = () => {
    if (!campaign) return
    try { sessionStorage.setItem(`scb_dismissed_${campaign.id}`, "1") } catch {}
    setVisible(false)
    setTimeout(() => setDismissed(true), 300)
  }

  if (!campaign || dismissed) return null
  if (campaign.endsAt && new Date(campaign.endsAt) <= new Date()) return null

  const pc = ((campaign.targetAudience ?? {}) as any)?.posterConfig ?? {}
  const badgeText: string = pc.badgeText || "🔥 SPECIAL OFFER"
  const badgeColor: string = pc.badgeColor || "amber"
  const btnStyle: string = pc.buttonStyle || "gradient_gold"
  const secondaryLabel: string = pc.secondaryLabel || "View Details"
  const secondaryUrl: string = pc.secondaryUrl || "/services"
  const videoLoop: boolean = pc.videoLoop ?? true
  const primaryUrl = campaign.landingUrl || "/services"
  const hasMedia = !!(campaign.bannerUrl || campaign.videoUrl)

  return (
    // ── Centered Backdrop Overlay ──
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Campaign offer"
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-all duration-300 ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      }`}
    >
      {/* ── Large Centered Modal Panel ── */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/20 bg-zinc-950 text-white shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3.5 py-1 rounded-full text-xs uppercase tracking-wider shadow-md ${BADGE_COLORS[badgeColor] || BADGE_COLORS.amber}`}>
              {badgeText}
            </span>
            {campaign.endsAt && <Countdown endsAt={campaign.endsAt} />}
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close poster"
            className="flex items-center gap-2 rounded-full bg-red-600/90 hover:bg-red-600 border border-white/20 text-white text-xs font-bold px-4 py-2 transition-all hover:scale-105 shadow-lg cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>Close Poster</span>
          </button>
        </div>

        {/* Modal Main Content Grid */}
        <div className={`grid gap-8 items-center ${hasMedia ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
          
          {/* Media Column (Banner Image & Video Player) */}
          {hasMedia && (
            <div className="space-y-4">
              {campaign.bannerUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black shadow-xl aspect-video max-h-[280px]">
                  <img src={campaign.bannerUrl} alt={campaign.name} className="w-full h-full object-cover" />
                </div>
              )}

              {campaign.videoUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black shadow-xl aspect-video min-h-[220px]">
                  <AutoPlayingVideo src={campaign.videoUrl} loop={videoLoop} />
                </div>
              )}
            </div>
          )}

          {/* Details & Active Redirect Buttons Column */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                {campaign.name}
              </h2>
              {campaign.description && (
                <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
                  {campaign.description}
                </p>
              )}
            </div>

            {/* Active Redirect Links Section */}
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Explore Active Campaign Offers:
              </p>
              <div className="flex flex-col gap-3">
                {/* Primary CTA */}
                <Link
                  href={primaryUrl}
                  onClick={dismiss}
                  className={`flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                    BUTTON_STYLES[btnStyle] || BUTTON_STYLES.gradient_gold
                  }`}
                >
                  <span>🚀 {campaign.ctaLabel || "Explore Offer Now"}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>

                {/* Secondary CTA */}
                <Link
                  href={secondaryUrl}
                  onClick={dismiss}
                  className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl text-sm font-semibold border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  <span>⚡ {secondaryLabel}</span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-amber-300" />
                </Link>

                {/* Services Catalog */}
                <Link
                  href="/services"
                  onClick={dismiss}
                  className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl text-sm font-semibold border border-amber-500/30 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 transition-all"
                >
                  <span>🏢 Browse All Services</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>

                {/* Marketplace */}
                <Link
                  href="/marketplace"
                  onClick={dismiss}
                  className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl text-sm font-semibold border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-all"
                >
                  <span>🏪 Explore Marketplace</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
