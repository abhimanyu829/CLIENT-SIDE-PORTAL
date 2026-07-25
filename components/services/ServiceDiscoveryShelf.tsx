"use client"

import Link from "next/link"
import { useEffect, useState, useRef } from "react"
import { ArrowRight, Sparkles, Video, Image as ImageIcon } from "lucide-react"

function AutoPlayingVideo({ src, loop = true, className = "" }: { src: string; loop?: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
    video.playsInline = true
    const promise = video.play()
    if (promise !== undefined) {
      promise
        .then(() => setIsPlaying(true))
        .catch(() => {
          video.muted = true
          setIsMuted(true)
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        })
    }
  }, [src, isMuted])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  return (
    <div className="relative group w-full h-full overflow-hidden bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop={loop}
        muted={isMuted}
        playsInline
        controls
        className={className || "h-full w-full object-cover"}
      />
      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[11px] font-semibold border border-white/20">
        <button type="button" onClick={togglePlay} className="hover:text-amber-300 transition-colors">
          {isPlaying ? "⏸ Pause" : "▶️ Play"}
        </button>
        <span className="text-zinc-500">|</span>
        <button type="button" onClick={toggleMute} className="hover:text-amber-300 transition-colors">
          {isMuted ? "🔇 Muted" : "🔊 Sound On"}
        </button>
      </div>
    </div>
  )
}

type ServiceCard = { id: string; slug: string; title: string; description: string; imageUrl?: string | null; category?: { name: string; slug: string } | null; tags: { name: string; slug: string }[] }
type Discovery = {
  campaigns: {
    id: string
    name: string
    description?: string | null
    bannerUrl?: string | null
    backgroundUrl?: string | null
    videoUrl?: string | null
    ctaLabel?: string | null
    landingUrl?: string | null
    targetAudience?: Record<string, unknown> | null
    tags: string[]
  }[]
  collections: { id: string; name: string; description?: string | null; services: ServiceCard[] }[]
  sections: { key: string; title: string; services: ServiceCard[] }[]
}

const BADGE_STYLES: Record<string, string> = {
  amber: "bg-amber-100 border border-amber-300 text-amber-900",
  emerald: "bg-emerald-100 border border-emerald-300 text-emerald-900",
  crimson: "bg-red-100 border border-red-300 text-red-900",
  violet: "bg-purple-100 border border-purple-300 text-purple-900",
  gold: "bg-yellow-200 border border-yellow-400 text-yellow-950 font-bold",
  cyan: "bg-cyan-100 border border-cyan-300 text-cyan-900",
}

const BUTTON_CLASS_MAP: Record<string, string> = {
  gradient_gold: "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black font-bold shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-transform",
  neon_cyber: "bg-gradient-to-r from-cyan-500 to-amber-500 text-black font-bold shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-transform",
  glass: "bg-white/20 backdrop-blur-md border border-white/40 text-white font-bold shadow-lg hover:bg-white/30 transition-all",
  dark_bold: "bg-zinc-950 border border-zinc-700 text-white font-bold shadow-lg hover:bg-zinc-900 transition-colors",
  emerald_active: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-transform",
}

const POSITION_CLASS_MAP: Record<string, string> = {
  "bottom-right": "justify-end items-end",
  "bottom-left": "justify-start items-end",
  "center": "justify-center items-center",
  "top-right": "justify-end items-start",
}

function sessionKey() {
  const key = "nexusai-service-discovery-session"
  const current = window.localStorage.getItem(key)
  if (current) return current
  const created = crypto.randomUUID()
  window.localStorage.setItem(key, created)
  return created
}

function track(payload: Record<string, unknown>) {
  void fetch("/api/service-discovery/events", {
    method: "POST", headers: { "content-type": "application/json", "x-discovery-session": sessionKey() }, body: JSON.stringify(payload), keepalive: true,
  })
}

function ServiceCardView({ service }: { service: ServiceCard }) {
  return (
    <Link href={`/services/${service.slug}`} onClick={() => track({ eventType: "CLICK", servicePageId: service.id })} className="group min-w-[260px] max-w-[280px] rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-700/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Sparkles className="h-5 w-5" /></div>
        {service.category && <span className="text-xs font-medium text-muted-foreground">{service.category.name}</span>}
      </div>
      <h3 className="mt-5 font-semibold text-foreground group-hover:text-amber-800">{service.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
      {service.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{service.tags.slice(0, 3).map((tag) => <span key={tag.slug} className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{tag.name}</span>)}</div>}
      <div className="mt-5 flex items-center text-sm font-medium text-amber-800">Explore <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
    </Link>
  )
}

export function ServiceDiscoveryShelf() {
  const [data, setData] = useState<Discovery | null>(null)
  const [dismissedCampaigns, setDismissedCampaigns] = useState<string[]>([])

  useEffect(() => {
    let active = true
    fetch("/api/service-discovery?placement=services")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload?.success) setData(payload.data) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!data?.campaigns.length) return
    data.campaigns.forEach((campaign) => track({ eventType: "VIEW", campaignId: campaign.id, campaignEventType: "IMPRESSION" }))
  }, [data])

  const dismissCampaign = (id: string) => {
    setDismissedCampaigns((prev) => [...prev, id])
    try {
      localStorage.setItem(`sc_banner_dismissed_${id}`, "true")
    } catch {}
  }

  if (!data) return null
  const activeCampaigns = data.campaigns.filter((c) => !dismissedCampaigns.includes(c.id))
  const shelves = [...data.sections, ...data.collections.map((collection) => ({ key: `collection-${collection.id}`, title: collection.name, services: collection.services }))].filter((section) => section.services.length > 0)
  if (!activeCampaigns.length && !shelves.length) return null

  return (
    <section className="space-y-10" aria-label="Service discovery">
      {activeCampaigns.map((campaign) => {
        const hasBg = !!campaign.backgroundUrl
        const target = (campaign.targetAudience ?? {}) as Record<string, unknown>
        const posterConfig = (target.posterConfig ?? {}) as Record<string, any>

        const badgeText = posterConfig.badgeText ?? ""
        const badgeColor = posterConfig.badgeColor ?? "amber"
        const buttonStyle = posterConfig.buttonStyle ?? "gradient_gold"
        const buttonPosition = posterConfig.buttonPosition ?? "bottom-right"
        const secondaryLabel = posterConfig.secondaryLabel ?? ""
        const secondaryUrl = posterConfig.secondaryUrl ?? ""
        const videoAutoplay = posterConfig.videoAutoplay ?? true
        const videoLoop = posterConfig.videoLoop ?? true

        return (
          <div key={campaign.id} className="relative overflow-hidden rounded-3xl border border-amber-800/20 bg-gradient-to-r from-amber-50/90 via-white to-orange-50/90 shadow-sm transition hover:shadow-md">
            {/* Floating Close Poster Button */}
            <button
              onClick={() => dismissCampaign(campaign.id)}
              aria-label="Close poster"
              title="Close poster"
              className="absolute top-4 right-4 z-30 flex items-center gap-1 rounded-full bg-black/60 hover:bg-red-600 text-white border border-white/30 px-3 py-1 text-xs font-bold shadow-md backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
            >
              ✕ Close Poster
            </button>

            <div className="relative z-10 p-7 space-y-6">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div className="max-w-2xl space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Service campaign
                    </p>
                    {badgeText && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${BADGE_STYLES[badgeColor] || BADGE_STYLES.amber}`}>
                        {badgeText}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">{campaign.name}</h2>
                  {campaign.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">{campaign.description}</p>
                  )}
                  {secondaryLabel && (
                    <Link href={secondaryUrl || "/services"} className="inline-block text-xs font-semibold text-amber-800 hover:underline pt-1">
                      {secondaryLabel} →
                    </Link>
                  )}
                </div>

                <div className={`flex ${POSITION_CLASS_MAP[buttonPosition] || "justify-end items-end"}`}>
                  <Link
                    href={campaign.landingUrl || "/services"}
                    onClick={() => track({ eventType: "CLICK", campaignId: campaign.id, campaignEventType: "CLICK" })}
                    className={`inline-flex items-center shrink-0 rounded-xl px-5 py-3 text-sm font-semibold shadow-md ${BUTTON_CLASS_MAP[buttonStyle] || "bg-amber-800 text-white hover:bg-amber-900"}`}
                  >
                    {campaign.ctaLabel || "Explore now"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Media assets: Banner Image & Video Player */}
              {(campaign.bannerUrl || campaign.videoUrl) && (
                <div className={`grid gap-4 pt-2 ${campaign.bannerUrl && campaign.videoUrl ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                  {campaign.bannerUrl && (
                    <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-black/5 max-h-80 flex items-center justify-center shadow-inner">
                      <img src={campaign.bannerUrl} alt={campaign.name} className="h-full w-full object-cover max-h-80" />
                    </div>
                  )}
                  {campaign.videoUrl && (
                    <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-black max-h-80 shadow-inner relative">
                      <AutoPlayingVideo src={campaign.videoUrl} loop={videoLoop} className="h-full w-full object-cover max-h-80" />
                    </div>
                  )}
                </div>
              )}

              {/* Multiple Direct Offer Link Bar */}
              <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-amber-200/60 text-xs">
                <span className="font-bold text-amber-900">Direct Offer Links:</span>
                <Link href={campaign.landingUrl || "/services"} className="font-bold text-amber-800 hover:underline">
                  🚀 {campaign.ctaLabel || "Explore Offer Now"}
                </Link>
                {secondaryLabel && (
                  <Link href={secondaryUrl || "/services"} className="font-semibold text-amber-900 hover:underline">
                    ⚡ {secondaryLabel}
                  </Link>
                )}
                <Link href="/services" className="font-medium text-amber-700 hover:underline">
                  🏢 Services Catalog
                </Link>
                <Link href="/marketplace" className="font-medium text-amber-700 hover:underline">
                  🏪 Marketplace Offers
                </Link>
              </div>
            </div>
          </div>
        )
      })}
      {shelves.map((section) => (
        <div key={section.key} className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-bold tracking-tight text-foreground">{section.title}</h2><Link href="/services" className="text-sm font-medium text-amber-800 hover:underline">See all</Link></div>
          <div className="flex gap-4 overflow-x-auto pb-2">{section.services.map((service) => <ServiceCardView key={service.id} service={service} />)}</div>
        </div>
      ))}
    </section>
  )
}

