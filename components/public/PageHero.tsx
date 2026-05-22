import React from "react"

interface PageHeroProps {
  title: string | React.ReactNode
  description: string
  pillText?: string
  ctaText?: string
  ctaHref?: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
  align?: "center" | "left"
}

export function PageHero({
  title,
  description,
  pillText,
  ctaText,
  ctaHref,
  secondaryCtaText,
  secondaryCtaHref,
  align = "center"
}: PageHeroProps) {
  return (
    <div className={`relative w-full pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden flex flex-col ${align === "center" ? "items-center text-center" : "items-start text-left"}`}>
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-purple-500/30 blur-[100px] rounded-full mix-blend-screen" />
      </div>

      {pillText && (
        <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          {pillText}
        </div>
      )}

      <h1 className={`text-4xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight max-w-4xl`}>
        {title}
      </h1>

      <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed">
        {description}
      </p>

      {(ctaText || secondaryCtaText) && (
        <div className={`flex flex-col sm:flex-row items-center gap-4 ${align === "center" ? "justify-center" : "justify-start"}`}>
          {ctaText && ctaHref && (
            <a href={ctaHref} className="px-8 py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]">
              {ctaText}
            </a>
          )}
          {secondaryCtaText && secondaryCtaHref && (
            <a href={secondaryCtaHref} className="px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors">
              {secondaryCtaText}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
