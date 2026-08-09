import React from "react"
import Link from "next/link"
import { ArrowRight, ShieldCheck, Zap, Globe, RefreshCw } from "lucide-react"

interface CallToActionProps {
  title: string
  description: string
  ctaText?: string
  ctaHref?: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
}

export function CallToAction({
  title,
  description,
  ctaText = "Explore All Products",
  ctaHref = "/register",
  secondaryCtaText = "Schedule Enterprise Demo",
  secondaryCtaHref = "/custom-service",
}: CallToActionProps) {
  const highlights = [
    { icon: Zap, text: "Instant 1-Click Deployment" },
    { icon: ShieldCheck, text: "SOC2 Type II Certified" },
    { icon: Globe, text: "Global Edge Network" },
    { icon: RefreshCw, text: "14-Day Money Back Guarantee" },
  ]

  return (
    <section className="py-20 px-4 sm:px-6 relative z-10 overflow-hidden">
      <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/70 border border-purple-200/80 p-8 sm:p-14 md:p-20 text-center relative overflow-hidden shadow-xl">
        {/* Soft Background Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-purple-200 text-xs font-extrabold text-purple-950 uppercase tracking-wider mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
            <span style={{ color: "#4c1d95" }}>NexusAI Enterprise Ready</span>
          </div>

          {/* Main Title - Black Text */}
          <h2 style={{ color: "#0f172a" }} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-5 text-slate-900 drop-shadow-xs">
            {title}
          </h2>

          {/* Description - Dark Text */}
          <p style={{ color: "#334155" }} className="text-base sm:text-lg text-slate-700 mb-10 max-w-2xl leading-relaxed font-semibold">
            {description}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <Link
              href={ctaHref}
              style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white border border-slate-300 text-slate-900 font-extrabold text-base shadow-md hover:bg-slate-50 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <span style={{ color: "#0f172a" }}>{ctaText}</span>
              <ArrowRight className="w-5 h-5 text-slate-900" style={{ color: "#0f172a" }} />
            </Link>

            {secondaryCtaText && secondaryCtaHref && (
              <Link
                href={secondaryCtaHref}
                style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white border border-slate-300 text-slate-900 font-extrabold text-base hover:bg-slate-50 transition-all duration-200 hover:scale-105 active:scale-95 shadow-xs"
              >
                <span style={{ color: "#0f172a" }}>{secondaryCtaText}</span>
              </Link>
            )}
          </div>

          {/* Trust Highlights Grid - Black/Dark Text */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full pt-8 border-t border-purple-200/60">
            {highlights.map((item, idx) => {
              const Icon = item.icon
              return (
                <div key={idx} className="flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/80 border border-purple-100 text-xs font-bold text-slate-900 shadow-xs">
                  <Icon className="w-4 h-4 text-purple-700 shrink-0" />
                  <span style={{ color: "#0f172a" }}>{item.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
