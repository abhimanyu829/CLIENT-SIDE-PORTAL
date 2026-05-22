"use client"
import { useEffect, useState } from "react"
import CountdownTimer from "./CountdownTimer"

interface Campaign {
  id: string
  bannerText?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  bannerImageUrl?: string | null
  endsAt: string
  discountPercent?: number
  type: string
}

interface Props {
  campaign: Campaign | null
}

export default function OfferBanner({ campaign }: Props) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!campaign) return
    try {
      const key = `nx_offer_dismissed_${campaign.id}`
      if (localStorage.getItem(key) === "true") setDismissed(true)
    } catch {}
  }, [campaign])

  if (!campaign || dismissed) return null
  if (new Date(campaign.endsAt) <= new Date()) return null

  const dismiss = () => {
    try { localStorage.setItem(`nx_offer_dismissed_${campaign.id}`, "true") } catch {}
    setDismissed(true)
  }

  const bgMap: Record<string, string> = {
    FLASH_SALE: "from-red-900/60 via-orange-900/40 to-yellow-900/30 border-red-500/30",
    FESTIVAL: "from-purple-900/60 via-indigo-900/40 to-blue-900/30 border-purple-500/30",
    BLACKFRIDAY: "from-zinc-900/90 via-zinc-800/70 to-zinc-900/90 border-white/10",
    DEFAULT: "from-purple-900/50 via-indigo-900/30 to-blue-900/20 border-purple-500/20",
  }
  const bg = bgMap[campaign.type] || bgMap.DEFAULT
  const emoji = campaign.type === "FLASH_SALE" ? "⚡" : campaign.type === "FESTIVAL" ? "🎉" : campaign.type === "BLACKFRIDAY" ? "🖤" : "🔥"

  return (
    <div className={`relative bg-gradient-to-r ${bg} border-b border-t backdrop-blur-sm overflow-hidden`}
      style={{ background: campaign.bannerImageUrl ? `url(${campaign.bannerImageUrl}) center/cover` : undefined }}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-4 flex-wrap">
        <span className="text-lg">{emoji}</span>
        <span className="text-sm font-semibold text-white text-center">
          {campaign.bannerText || `Special offer — ${campaign.discountPercent ? `${campaign.discountPercent}% off` : "Limited time deal"}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-xs">Ends in:</span>
          <CountdownTimer endDate={campaign.endsAt} variant="compact" className="text-amber-300 font-mono" />
        </div>
        {campaign.ctaUrl && campaign.ctaText && (
          <a href={campaign.ctaUrl}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-all hover:scale-105">
            {campaign.ctaText} →
          </a>
        )}
      </div>
      <button onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors text-lg leading-none">
        ✕
      </button>
    </div>
  )
}
