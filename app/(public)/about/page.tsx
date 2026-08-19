import React from "react"
import Link from "next/link"
import { Metadata } from "next"
import { Globe, Users, Target, Code, Heart, Zap, Shield, Rocket, Sparkles, ArrowRight, CheckCircle2, Cpu, Layers, Award } from "lucide-react"

export const metadata: Metadata = {
  title: "About Us — ABHIBHIDEVELOPERS Platform",
  description: "Learn about ABHIBHIDEVELOPERS's mission, our team, and our vision for building the world's best AI SaaS infrastructure and marketplace.",
}

const STATS = [
  { value: "2024", label: "Founded", desc: "Built from the ground up for AI" },
  { value: "10+", label: "Global Team", desc: "Remote-first engineering" },
  { value: "99.99%", label: "Uptime SLA", desc: "Enterprise edge infrastructure" },
]

const TIMELINE = [
  {
    step: "01",
    title: "The Problem",
    tag: "Early 2024",
    desc: "While LLMs were evolving rapidly, enterprise infrastructure for agent deployment, billing, auth, and vector routing was severely fragmented.",
    highlight: "DevOps complexity blocked AI innovation."
  },
  {
    step: "02",
    title: "The Breakthrough",
    tag: "Late 2024",
    desc: "ABHIBHIDEVELOPERS created a unified operating system—allowing developers to package, deploy, and monetize autonomous AI agents with one-click edge hosting.",
    highlight: "A single OS for intelligent software."
  },
  {
    step: "03",
    title: "The Scale",
    tag: "Present",
    desc: "Today, ABHIBHIDEVELOPERS powers thousands of production agents, SaaS integrations, and enterprise automated workflows across 140+ countries.",
    highlight: "Empowering 10,000+ AI builders worldwide."
  }
]

const VALUES = [
  { icon: Users, title: "Customer Obsession", desc: "We build for real-world utility over hype, listening closely to developers and enterprise clients." },
  { icon: Shield, title: "Security & Governance", desc: "Strict data isolation, SOC 2 compliance, and zero third-party training on customer payloads." },
  { icon: Code, title: "Developer Delight", desc: "Flawless API design, SDKs in 5+ languages, and developer documentation crafted with immense care." },
  { icon: Globe, title: "Global & Async First", desc: "We hire top-tier talent anywhere on earth, fostering a high-trust, asynchronous remote culture." },
  { icon: Heart, title: "Open Source Commitment", desc: "We actively sponsor and contribute back to open-source libraries powering the AI ecosystem." },
  { icon: Zap, title: "Relentless Iteration", desc: "The AI boundary shifts weekly. We deploy daily updates to keep our platform at the bleeding edge." }
]

export default function AboutPage() {
  return (
    <div className="bg-white text-zinc-900 min-h-screen py-12 md:py-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* 1. Hero Header Section */}
        <div className="bg-gradient-to-br from-purple-50/60 via-white to-zinc-50 border border-zinc-200/90 rounded-3xl p-8 md:p-14 shadow-xs relative overflow-hidden">
          <div className="max-w-3xl space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 bg-purple-100/80 text-purple-900 border border-purple-200/80 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-purple-700" />
              <span>About ABHIBHIDEVELOPERS Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 leading-[1.1]">
              Democratizing the Future of{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600">
                Autonomous AI Software
              </span>
            </h1>

            <p className="text-base sm:text-xl text-zinc-600 font-medium leading-relaxed">
              We build the cloud orchestration layer, developer marketplace, and high-speed edge runtime that allow anyone to build, host, and deploy production-grade AI agents effortlessly.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href="/marketplace"
                className="px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-sm transition-all shadow-sm hover:shadow-purple-500/25 hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
              >
                <span>Explore Marketplace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/careers"
                className="px-6 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-sm transition-all border border-zinc-200 cursor-pointer"
              >
                View Careers (We're Hiring!)
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Structured Stat Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-xs hover:border-purple-300 transition-all text-center space-y-1">
              <p className="text-3xl sm:text-4xl font-black text-purple-600 tracking-tight">{stat.value}</p>
              <p className="text-sm font-bold text-zinc-900">{stat.label}</p>
              <p className="text-xs text-zinc-500 font-medium">{stat.desc}</p>
            </div>
          ))}
        </div>

        {/* 3. Founder Story / Company Narrative Timeline */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-zinc-200/90 shadow-xs space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-extrabold text-purple-700 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              Our Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">The ABHIBHIDEVELOPERS Story</h2>
            <p className="text-zinc-600 text-sm font-medium">How we built the unified operating system for artificial intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIMELINE.map((item, idx) => (
              <div key={idx} className="bg-zinc-50/70 p-6 rounded-2xl border border-zinc-200/80 space-y-3 flex flex-col justify-between hover:bg-zinc-50 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-purple-600 text-white font-black text-xs flex items-center justify-center">
                      {item.step}
                    </span>
                    <span className="text-xs font-bold text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full font-mono">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-zinc-900">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">{item.desc}</p>
                </div>
                <div className="pt-3 border-t border-zinc-200/60 text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{item.highlight}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Core Values Grid */}
        <div className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-extrabold text-purple-700 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              Principles
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">Our Core Values</h2>
            <p className="text-zinc-600 text-sm font-medium">The non-negotiable principles that shape our product, culture, and engineering.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {VALUES.map((val, idx) => {
              const Icon = val.icon
              return (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-xs hover:shadow-md hover:border-purple-200 transition-all space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
                    <Icon className="w-5.5 h-5.5" />
                  </div>
                  <h3 className="text-lg font-extrabold text-zinc-900">{val.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">{val.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* 5. Executive Call To Action Card */}
        <div className="bg-gradient-to-r from-zinc-900 via-purple-950 to-zinc-900 text-white rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 text-purple-200 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
              <Rocket className="w-3.5 h-3.5 text-purple-400" />
              <span>Join the Autonomous Movement</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Ready to deploy or build your next AI product?
            </h2>

            <p className="text-zinc-300 text-sm sm:text-base font-medium leading-relaxed">
              Explore 500+ AI SaaS tools, autonomous agents, and developer APIs, or join our global engineering team.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm transition-all shadow-lg hover:scale-[1.02] cursor-pointer"
              >
                Start Building Free
              </Link>
              <Link
                href="/careers"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm transition-all border border-white/20 cursor-pointer"
              >
                View Open Positions →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

