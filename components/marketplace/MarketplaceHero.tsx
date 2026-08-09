"use client"

import React, { ReactNode, CSSProperties } from "react"
import { motion } from "framer-motion"

type FadeUpProps = {
  children: ReactNode
  delay?: number
  duration?: number
  y?: number
  className?: string
  style?: CSSProperties
  as?: "div" | "section" | "span" | "h1" | "h2" | "h3" | "p" | "nav" | "a"
  once?: boolean
}

export function FadeUp({
  children,
  delay = 0,
  duration = 0.7,
  y = 24,
  className,
  style,
  as = "div",
  once = true,
}: FadeUpProps) {
  const Tag = motion[as] as any
  return (
    <Tag
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  )
}

interface MarketplaceHeroProps {
  pillText?: string
  titleText?: string
  description?: string
  ctaText?: string
  ctaHref?: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
}

export function MarketplaceHero({
  pillText = "NexusAI Ecosystem",
  titleText = "THE ENTERPRISE AI MARKETPLACE",
  description = "Discover, deploy, and scale production-grade AI agents, SaaS tools, and developer APIs in seconds. The trusted ecosystem for modern AI infrastructure.",
  ctaText = "Start Deploying",
  ctaHref = "/register",
  secondaryCtaText = "View Documentation",
  secondaryCtaHref = "/docs",
}: MarketplaceHeroProps) {
  const words = titleText.split(" ")

  return (
    <div className="relative w-full h-screen overflow-hidden font-helvetica-now bg-slate-50 text-slate-900">
      <style jsx global>{`
        @import url("https://db.onlinewebfonts.com/c/e66905e07608167a84e6ad52f638c3c6?family=Helvetica+Now+Var");
        .font-helvetica-now {
          font-family: "Helvetica Now Var", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }
      `}</style>

      {/* Light GIF Background with Soft Ambient Glow Overlay */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/uploads/utr/hf_20260514_135830_bb6491d1-9b66-4aec-9722-13b4dfe3fb46-ezgif.com-speed.gif"
          alt="Marketplace Background"
          className="w-full h-full object-cover opacity-85 mix-blend-multiply"
        />
        {/* Soft light gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/40 via-white/50 to-slate-50/90" />
      </div>

      {/* Full Viewport 100vh Transparent Hero Section */}
      <section className="relative z-10 w-full h-full flex flex-col justify-center px-6 sm:px-12 lg:px-20 pt-[90px] md:pt-[70px] pb-8 bg-transparent">
        <div className="flex flex-col items-start max-w-[720px] w-full">
          {pillText && (
            <FadeUp delay={0.05} y={16} className="mb-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-slate-200 text-xs font-bold text-purple-700 backdrop-blur-md uppercase tracking-wider shadow-xs">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                {pillText}
              </div>
            </FadeUp>
          )}

          {/* Staggered Word Heading */}
          <h2 className="flex flex-wrap gap-x-[0.25em] gap-y-1 text-slate-950 font-extrabold uppercase tracking-[-0.01em] leading-[1.08] text-[clamp(28px,3.5vw,46px)] m-0 drop-shadow-xs">
            {words.map((word, idx) => (
              <motion.span
                key={idx}
                className="inline-block text-slate-950"
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.7,
                  delay: 0.15 + idx * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {word}
              </motion.span>
            ))}
          </h2>

          {/* Subtext */}
          <FadeUp delay={0.9} y={24} as="p" className="mt-6 text-sm sm:text-base leading-[1.65] text-slate-700 max-w-[560px] font-medium">
            {description}
          </FadeUp>

          {/* CTA Buttons */}
          {(ctaText || secondaryCtaText) && (
            <FadeUp delay={1.1} y={20} className="mt-8 flex flex-wrap items-center gap-4">
              {ctaText && ctaHref && (
                <a
                  href={ctaHref}
                  className="px-7 py-3.5 rounded-xl bg-slate-950 text-white font-bold text-sm shadow-xl shadow-slate-950/20 hover:bg-slate-800 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {ctaText} →
                </a>
              )}
              {secondaryCtaText && secondaryCtaHref && (
                <a
                  href={secondaryCtaHref}
                  className="px-7 py-3.5 rounded-xl bg-white/80 border border-slate-300 text-slate-900 font-bold text-sm backdrop-blur-md hover:bg-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-xs"
                >
                  {secondaryCtaText}
                </a>
              )}
            </FadeUp>
          )}
        </div>
      </section>
    </div>
  )
}
