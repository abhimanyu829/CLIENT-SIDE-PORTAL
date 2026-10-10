/**
 * components/content/HomeBrandShowcase.tsx
 * Master art UI presentation for Abhibhideveloper homepage brand architecture.
 * Strictly presents exact copy verbatim from lib/content/brand-blocks.ts (HOME_BRAND).
 * Zero backend impact, zero functionality alterations.
 */

import React from "react"
import Link from "next/link"
import {
  Bot,
  Code2,
  Boxes,
  Store,
  ShieldCheck,
  Compass,
  MousePointerClick,
  FileCheck2,
  Cpu,
  SlidersHorizontal,
  Sparkles,
  Target,
  Eye,
  ArrowRight,
  CheckCircle2,
  Layers,
  MessageSquareQuote,
  Sparkle,
  Workflow,
  Rocket,
  Package,
} from "lucide-react"
import { HOME_BRAND } from "@/lib/content/brand-blocks"

export function HomeBrandShowcase() {
  // Extract sections from HOME_BRAND to preserve 100% exact verbatim content
  const heroSection = HOME_BRAND[0]
  const whatWeDoSection = HOME_BRAND[1]
  const howItWorksSection = HOME_BRAND[2]
  const approachSection = HOME_BRAND[3]
  const missionSection = HOME_BRAND[4]
  const visionSection = HOME_BRAND[5]
  const startSection = HOME_BRAND[6]

  // Parse "What We Do" items: each string is "<Title> — <Description>"
  const whatWeDoCards = (whatWeDoSection?.body || []).map((item, index) => {
    const [title, ...descParts] = item.split(" — ")
    const desc = descParts.join(" — ")

    const configs = [
      {
        icon: Bot,
        badge: "AI & Intelligence",
        accent: "from-purple-500/15 via-purple-500/5 to-transparent",
        iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        hoverBorder: "hover:border-purple-500/40",
      },
      {
        icon: Code2,
        badge: "Engineering & UI",
        accent: "from-blue-500/15 via-blue-500/5 to-transparent",
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        hoverBorder: "hover:border-blue-500/40",
      },
      {
        icon: Boxes,
        badge: "Cloud & APIs",
        accent: "from-indigo-500/15 via-indigo-500/5 to-transparent",
        iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
        hoverBorder: "hover:border-indigo-500/40",
      },
      {
        icon: Store,
        badge: "Marketplace",
        accent: "from-amber-500/15 via-amber-500/5 to-transparent",
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        hoverBorder: "hover:border-amber-500/40",
      },
      {
        icon: ShieldCheck,
        badge: "Lifecycle Care",
        accent: "from-emerald-500/15 via-emerald-500/5 to-transparent",
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        hoverBorder: "hover:border-emerald-500/40",
      },
    ]

    const config = configs[index] || configs[0]
    return { title, desc, ...config, stepNum: `0${index + 1}` }
  })

  // Icons for "How It Works" 5 steps
  const stepIcons = [Compass, MousePointerClick, FileCheck2, Cpu, SlidersHorizontal]

  return (
    <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-background border-t border-border/80 overflow-hidden">
      {/* ── AMBIENT BACKGROUND GLOWS ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] max-w-full h-[550px] bg-gradient-to-b from-amber-500/10 via-primary/5 to-transparent blur-3xl opacity-70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -right-40 w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/5 to-transparent blur-3xl opacity-50"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-10 -left-40 w-[600px] h-[600px] bg-gradient-to-tr from-amber-500/5 to-transparent blur-3xl opacity-50"
      />

      <div className="relative mx-auto max-w-7xl space-y-20 sm:space-y-28">

        {/* ── 1. MAIN HERO SHOWCASE BOX (About Abhibhideveloper) ── */}
        <div className="relative rounded-none border border-primary/25 bg-card/85 backdrop-blur-2xl p-8 sm:p-12 md:p-16 shadow-[0_20px_70px_-15px_rgba(217,119,6,0.12)] dark:shadow-[0_25px_80px_-15px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-500 hover:border-primary/45 hover:shadow-[0_25px_90px_-10px_rgba(217,119,6,0.2)]">
          {/* Layer 1: Multi-stop Vibrant Ambient Light Orbs */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 -right-28 w-[520px] h-[520px] bg-gradient-to-br from-amber-500/30 via-primary/20 to-transparent blur-3xl opacity-85"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-28 w-[520px] h-[520px] bg-gradient-to-tr from-indigo-500/25 via-purple-500/20 to-transparent blur-3xl opacity-80"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-emerald-500/10 via-amber-500/15 to-transparent blur-3xl opacity-60"
          />

          {/* Layer 2: Precision Geometric Dot/Grid Circuit Mesh Pattern */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
            style={{
              backgroundImage: `radial-gradient(currentColor 1.2px, transparent 1.2px), radial-gradient(currentColor 1.2px, transparent 1.2px)`,
              backgroundSize: `24px 24px`,
              backgroundPosition: `0 0, 12px 12px`,
            }}
          />

          {/* Layer 3: Top Ambient Radiant Line */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/10 via-amber-500 to-amber-500/10 opacity-90"
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: Services Overview */}
            <div className="lg:col-span-7 space-y-7">
              {/* Monospace Eyebrow Badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-none text-xs font-mono font-bold tracking-widest uppercase bg-primary/15 text-primary border border-primary/30 shadow-xs backdrop-blur-md">
                <span className="h-2 w-2 rounded-none bg-primary animate-pulse" />
                <span>ABOUT ABHIBHIDEVELOPER</span>
              </div>

              {/* Main Headline */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold tracking-tight text-foreground text-balance font-display leading-[1.14]">
                {heroSection.heading}
              </h2>

              {/* Lead Statement */}
              {heroSection.lead ? (
                <div className="relative rounded-none border-l-4 border border-primary/25 border-l-primary bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4 backdrop-blur-md shadow-xs">
                  <p className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
                    {heroSection.lead}
                  </p>
                </div>
              ) : null}

              {/* Services Overview Paragraphs 1 & 2 */}
              <div className="grid gap-4 text-[15px] sm:text-[16px] leading-relaxed">
                {heroSection.body?.slice(0, 2).map((p, idx) => {
                  const isFirst = idx === 0
                  return (
                    <div
                      key={idx}
                      className={`relative rounded-none border backdrop-blur-md p-6 shadow-sm overflow-hidden transition-all ${
                        isFirst
                          ? "border-amber-500/30 border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent shadow-[0_8px_30px_-6px_rgba(217,119,6,0.15)] hover:border-amber-500/50 hover:shadow-[0_12px_36px_-6px_rgba(217,119,6,0.22)]"
                          : "border-indigo-500/30 border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent shadow-[0_8px_30px_-6px_rgba(99,102,241,0.15)] hover:border-indigo-500/50 hover:shadow-[0_12px_36px_-6px_rgba(99,102,241,0.22)]"
                      }`}
                    >
                      {/* Ambient colored corner aura */}
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full blur-2xl opacity-70 ${
                          isFirst ? "bg-amber-500/30" : "bg-indigo-500/30"
                        }`}
                      />

                      <div className="relative z-10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-mono font-bold tracking-widest uppercase ${
                              isFirst
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-indigo-700 dark:text-indigo-300"
                            }`}
                          >
                            {isFirst ? "CORE PLATFORM" : "CUSTOM SOLUTIONS"}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground/50">
                            0{idx + 1}
                          </span>
                        </div>
                        <p className="text-foreground/90 font-normal leading-relaxed text-pretty">
                          {p}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Feature Pills Banner for Services Overview (Paragraph 3) */}
              {heroSection.body?.[2] ? (
                <div className="pt-1">
                  <div className="rounded-none border border-primary/20 bg-gradient-to-br from-card/90 via-card/75 to-primary/5 p-5 sm:p-6 backdrop-blur-lg shadow-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3.5">
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-none bg-card border border-border/80 text-xs font-semibold text-foreground shadow-xs">
                        <div className="p-1 rounded-none bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Package className="h-3.5 w-3.5 shrink-0" />
                        </div>
                        <span>Explore technology products</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-none bg-card border border-border/80 text-xs font-semibold text-foreground shadow-xs">
                        <div className="p-1 rounded-lg rounded-none bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          <Cpu className="h-3.5 w-3.5 shrink-0" />
                        </div>
                        <span>Build custom solutions</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-none bg-card border border-border/80 text-xs font-semibold text-foreground shadow-xs">
                        <div className="p-1 rounded-none bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          <Workflow className="h-3.5 w-3.5 shrink-0" />
                        </div>
                        <span>Automate repetitive work</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-none bg-card border border-border/80 text-xs font-semibold text-foreground shadow-xs">
                        <div className="p-1 rounded-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Rocket className="h-3.5 w-3.5 shrink-0" />
                        </div>
                        <span>Keep operations moving</span>
                      </div>
                    </div>
                    <div className="border-t border-border/60 pt-2.5">
                      <p className="text-xs sm:text-sm font-medium text-foreground/85 text-pretty">
                        {heroSection.body[2]}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Right Column: Big Brand Image */}
            <div className="lg:col-span-5 flex justify-center items-center">
              <div className="relative w-full max-w-md lg:max-w-none group">
                {/* Radiant Ambient Aura */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-3 bg-gradient-to-tr from-amber-500/35 via-primary/30 to-amber-600/35 blur-2xl opacity-80 group-hover:opacity-100 transition-opacity"
                />

                {/* Pointed Frame */}
                <div className="relative rounded-none border-2 border-primary/40 bg-card p-3.5 shadow-2xl backdrop-blur-md transition-all duration-500 group-hover:border-primary/75 group-hover:shadow-[0_20px_60px_-10px_rgba(217,119,6,0.3)]">
                  <img
                    src="/abhibhi-brand.jpg"
                    alt="Abhibhi Developers - Innovation Written in Code"
                    className="w-full h-auto aspect-square object-cover block rounded-none border border-primary/20 shadow-md"
                  />
                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between px-1">
                    <span className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground">
                      ABHIBHI DEVELOPERS
                    </span>
                    <span className="text-[11px] font-mono font-bold text-primary">
                      EST. PLATFORM
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. "WHAT WE DO" MASTER ART BENTO BOXES ── */}
        <div className="space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-none text-xs font-mono font-semibold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span>CORE CAPABILITIES</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground font-display">
              {whatWeDoSection?.heading}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whatWeDoCards.map((card, idx) => {
              const IconComp = card.icon
              const isLarge = idx === 3 || idx === 4
              return (
                <div
                  key={card.title}
                  className={`group relative rounded-none border border-border/80 bg-card p-7 sm:p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${card.hoverBorder} ${
                    isLarge && idx === 3 ? "lg:col-span-1" : ""
                  } ${isLarge && idx === 4 ? "lg:col-span-2" : ""}`}
                >
                  {/* Subtle hover gradient wash */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-0 rounded-none bg-gradient-to-br ${card.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />

                  <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
                    <div className="flex items-center justify-between">
                      <div className={`p-3.5 rounded-none border ${card.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                        <IconComp className="h-6 w-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold tracking-widest text-muted-foreground/60 uppercase">
                          {card.badge}
                        </span>
                        <span className="text-xs font-mono font-black text-muted-foreground/30">
                          {card.stepNum}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display group-hover:text-primary transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-[15px] sm:text-base leading-relaxed text-muted-foreground">
                        {card.desc}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-1.5 text-xs font-semibold text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Explore service</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 3. "HOW IT WORKS" CONNECTED PROCESS PIPELINE ── */}
        <div className="space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-none text-xs font-mono font-semibold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              <Workflow className="h-3.5 w-3.5" />
              <span>STRUCTURED DELIVERY</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground font-display">
              {howItWorksSection?.heading}
            </h2>
          </div>

          <div className="relative">
            {/* Step cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
              {(howItWorksSection?.steps || []).map((step, idx) => {
                const StepIcon = stepIcons[idx] || CheckCircle2
                return (
                  <div
                    key={step.title}
                    className="group relative rounded-none border border-border/80 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-primary/50 flex flex-col justify-between"
                  >
                    {/* Top Step Pill & Icon */}
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center justify-center w-10 h-10 rounded-none bg-primary/10 text-primary border border-primary/20 font-mono font-black text-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                          0{idx + 1}
                        </div>
                        <StepIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>

                      <div className="space-y-2.5">
                        <h3 className="text-lg font-bold tracking-tight text-foreground font-display group-hover:text-primary transition-colors">
                          {step.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {step.text}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/50 flex items-center gap-1.5 text-xs font-mono text-muted-foreground/60">
                      <span>Phase {idx + 1} of 5</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── 4. ARCHITECTURAL TRILOGY ("Our Approach", "Our Mission", "Our Vision") ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Card 1: Our Approach */}
          <div className="group relative rounded-none border border-border/80 bg-card p-8 sm:p-9 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-amber-500/40 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="p-3.5 rounded-none bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Target className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono font-bold tracking-widest text-muted-foreground/60 uppercase">
                  PRACTICAL RIGOR
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
                  {approachSection?.heading}
                </h3>
                <div className="space-y-4 pt-1 text-[15px] sm:text-base leading-relaxed text-muted-foreground">
                  {approachSection?.body?.map((p, i) => (
                    <p key={i} className="text-pretty">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-border/50 flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Transparent & Defined Commitments</span>
            </div>
          </div>

          {/* Card 2: Our Mission */}
          <div className="group relative rounded-none border border-border/80 bg-card p-8 sm:p-9 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-purple-500/40 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="p-3.5 rounded-none bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Sparkles className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono font-bold tracking-widest text-muted-foreground/60 uppercase">
                  CORE PURPOSE
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
                  {missionSection?.heading}
                </h3>
                <div className="space-y-4 pt-1 text-[15px] sm:text-base leading-relaxed text-muted-foreground">
                  {missionSection?.body?.map((p, i) => (
                    <p key={i} className="text-pretty">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-border/50 flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
              <Sparkle className="h-4 w-4 shrink-0" />
              <span>All-In-One Accessible Platform</span>
            </div>
          </div>

          {/* Card 3: Our Vision */}
          <div className="group relative rounded-none border border-border/80 bg-card p-8 sm:p-9 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/40 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="p-3.5 rounded-none bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Eye className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono font-bold tracking-widest text-muted-foreground/60 uppercase">
                  LONG-TERM HORIZON
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
                  {visionSection?.heading}
                </h3>
                <div className="space-y-4 pt-1 text-[15px] sm:text-base leading-relaxed text-muted-foreground">
                  {visionSection?.body?.map((p, i) => (
                    <p key={i} className="text-pretty">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-border/50 flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Layers className="h-4 w-4 shrink-0" />
              <span>Dependable Technology Infrastructure</span>
            </div>
          </div>
        </div>

        {/* ── 5. "START WITH YOUR REQUIREMENT" MASTER CALLOUT BOX ── */}
        {startSection ? (
          <div className="relative rounded-none border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-8 sm:p-12 md:p-14 shadow-xl overflow-hidden">
            {/* Top decorative aura */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-3xl -mr-20 -mt-20"
            />

            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none text-xs font-mono font-semibold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                  <span>CONSULTATION & INTAKE</span>
                </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground font-display">
                  {startSection.heading}
                </h3>
                {startSection.body?.map((p, i) => (
                  <p key={i} className="text-base sm:text-lg leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-none bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Submit Your Requirement</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-none bg-background border border-border text-foreground font-semibold text-sm hover:border-primary/40 hover:text-primary transition-all"
                >
                  Browse Marketplace
                </Link>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </section>
  )
}
