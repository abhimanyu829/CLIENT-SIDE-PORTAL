"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Network,
  Handshake,
  Gem,
  Zap,
  Shield,
  ArrowRight,
  Check,
  CheckCircle2,
  Building,
  Laptop,
  Globe,
  Sparkles,
  Users,
  Award,
  Layers,
  ChevronRight,
  Phone,
} from "lucide-react"

const PARTNER_TRACKS = [
  {
    id: "integrators",
    title: "Solution Integrators & Agencies",
    badge: "Most Popular",
    tagline: "For digital agencies, consultancies, and systems integrators building custom AI workflows for corporate clients.",
    revShare: "Up to 25% Recurring",
    benefits: [
      "20%–25% recurring commission on all referred software & AI seats",
      "Dedicated Partner Solutions Architect for technical scoping",
      "Free unlimited sandbox environments for client demos",
      "Co-branded pitch decks, proposal templates & sales collateral",
      "Priority VIP escalation Slack channel with our engineering team",
    ],
  },
  {
    id: "technology",
    title: "Technology & ISV Partners",
    badge: "Ecosystem",
    tagline: "For SaaS platforms, developer tool makers, and LLM providers looking to natively embed inside Abhibhideveloper.",
    revShare: "Revenue & API Sync",
    benefits: [
      "Featured listing in the Abhibhi Developers Marketplace and Tool Directory",
      "Native MCP (Model Context Protocol) tool bridge integration",
      "Joint webinars, case studies, and co-marketing campaigns",
      "Bi-weekly sync with our core engineering & product roadmap team",
      "Early alpha access to new model routers and agent schedulers",
    ],
  },
  {
    id: "cloud",
    title: "Cloud & Infrastructure Hosts",
    badge: "Enterprise",
    tagline: "For cloud service providers, data centers, and managed hosting firms deploying Abhibhi Developers platforms within private VPCs.",
    revShare: "Custom Licensing",
    benefits: [
      "Enterprise white-label and managed cluster licensing options",
      "Multi-tenant architectural blueprints and Kubernetes Helm charts",
      "Joint PR press releases and enterprise event sponsorships",
      "24/7/365 tier-3 infrastructure escalation SLA",
      "Revenue sharing on compute and dedicated inference instances",
    ],
  },
  {
    id: "affiliates",
    title: "Affiliate & Growth Ambassadors",
    badge: "Growth",
    tagline: "For content creators, tech influencers, educators, and community builders sharing modern AI tools.",
    revShare: "15% Lifetime",
    benefits: [
      "15% recurring commission on every active subscriber you refer",
      "Dedicated tracking dashboard with real-time conversion stats",
      "60-day cookie window with cross-device attribution",
      "Exclusive discount coupon codes for your audience",
      "Automated monthly payouts via Direct Bank Wire or UPI",
    ],
  },
]

const BENEFITS_GRID = [
  {
    icon: Gem,
    title: "Generous Recurring Revenue Share",
    description: "Earn predictable, long-term recurring revenue for every client you introduce to our SaaS tools, AI agents, and custom enterprise deployments.",
  },
  {
    icon: Handshake,
    title: "Joint Go-To-Market & Co-Marketing",
    description: "Amplify your brand through featured partner case studies, co-hosted technical webinars, guest blogs, and joint industry press releases.",
  },
  {
    icon: Zap,
    title: "Deep Technical Enablement",
    description: "Direct access to our senior architects. We help you review client architectures, optimize agent prompt chains, and configure custom tool sandboxes.",
  },
  {
    icon: Shield,
    title: "Dedicated Partner Portal & Sandbox",
    description: "Access deal registration, sales enablement collateral, trial licenses, and dedicated staging environments for proof-of-concept testing.",
  },
  {
    icon: Award,
    title: "Official Partner Certification",
    description: "Earn official Abhibhi Certified Partner badges to display on your website and RFP proposals to demonstrate verified technical capability.",
  },
  {
    icon: Users,
    title: "Direct Engineering Slack Channel",
    description: "Skip standard support queues. Your technical leads gain a direct shared Slack or Discord channel with our core platform developers.",
  },
]

export default function PartnersClient() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    track: "integrators",
    message: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!formData.name.trim() || !formData.email.trim() || !formData.company.trim()) {
      setError("Please fill in your name, business email, and company name.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/public/partner-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSubmitted(true)
      } else {
        setError(data.error || "Failed to submit partner application. Please try again.")
      }
    } catch (err: any) {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-zinc-900 selection:bg-amber-100 selection:text-amber-900 font-sans">
      {/* Top Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-80 pointer-events-none z-0 overflow-hidden opacity-60">
        <div className="absolute top-[-100px] left-1/4 w-[500px] h-[500px] bg-amber-100/60 rounded-full blur-[120px]" />
        <div className="absolute top-[-80px] right-1/4 w-[450px] h-[450px] bg-emerald-100/60 rounded-full blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
        {/* Breadcrumb / Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-zinc-200/80">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              ABHIBHIDEVELOPERS GROUP • PARTNER ECOSYSTEM
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Applications Open for 2026/2027 Cohort</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 mb-6 shadow-xs">
            <Handshake className="w-3.5 h-3.5 text-amber-600" />
            <span>Build, Integrate &amp; Scale with Abhibhi Developers</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-950 mb-6 leading-tight">
            The Abhibhi Developers Partner Network
          </h1>
          <p className="text-base sm:text-xl text-zinc-600 leading-relaxed max-w-2xl mx-auto mb-8">
            Accelerate your clients&apos; AI transformation. Earn recurring revenue, gain dedicated engineering support, and co-sell market-leading autonomous software solutions with Abhibhideveloper.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#apply-form"
              className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-sm transition-all"
            >
              Apply to Partner Network
            </a>
            <a
              href="#tracks"
              className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 font-bold text-sm shadow-xs transition-all"
            >
              Explore Partner Tracks
            </a>
          </div>
        </div>

        {/* Partner Metrics */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 mb-16 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl font-black text-amber-700">25%</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Max Recurring Rev-Share</p>
          </div>
          <div>
            <p className="text-2xl font-black text-zinc-950">14 Days</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Fast-Track Onboarding</p>
          </div>
          <div>
            <p className="text-2xl font-black text-zinc-950">Free</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Unlimited Client Sandboxes</p>
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-700">24/7</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Direct Engineering Escalation</p>
          </div>
        </div>

        {/* 4 Partner Tracks */}
        <div id="tracks" className="mb-16 scroll-mt-28">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Tailored Programs for Every Partner
            </h2>
            <p className="text-sm text-zinc-600 mt-2 font-medium">
              Choose the program that aligns with your business model, whether you deliver custom AI client solutions or develop native integrations.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {PARTNER_TRACKS.map((track) => (
              <div
                key={track.id}
                className="rounded-3xl border border-zinc-200/90 bg-white p-7 sm:p-8 shadow-xs hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                      {track.badge}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 font-mono">
                      {track.revShare}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-zinc-950 mb-2">{track.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mb-6 font-normal">
                    {track.tagline}
                  </p>

                  <div className="space-y-2.5 border-t border-zinc-100 pt-5">
                    {track.benefits.map((benefit, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-700 font-medium">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-zinc-100">
                  <a
                    href="#apply-form"
                    onClick={() => setFormData((prev) => ({ ...prev, track: track.id }))}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
                  >
                    <span>Apply for {track.title}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="mb-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Why Partner with Abhibhi Developers?
            </h2>
            <p className="text-sm text-zinc-600 mt-2 font-medium">
              We provide the tooling, architectural blueprints, commercial incentives, and co-marketing push so your business can thrive.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS_GRID.map((b) => {
              const Icon = b.icon
              return (
                <div key={b.title} className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4 shadow-xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-zinc-950 mb-2">{b.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">{b.description}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Interactive Application Form */}
        <div id="apply-form" className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-12 mb-16 shadow-xs scroll-mt-28">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-xs font-mono font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full mb-3 inline-block">
                Start Partnership
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                Submit Your Partner Application
              </h2>
              <p className="text-sm text-zinc-600 mt-1">
                Tell us about your organization and our Partner Director will review your application and be in touch within 24 hours.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-emerald-950 mb-2">Application Received!</h3>
                <p className="text-sm text-emerald-800 max-w-lg mx-auto leading-relaxed">
                  Thank you for applying to the <strong>Abhibhi Developers Partner Network</strong>. A notification with your details has been dispatched to <strong>luckypal5002@gmail.com</strong>, and our Partner Solutions Director will contact you within 24 hours to schedule an introductory call.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                    {error}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 block">
                    <span className="text-xs font-semibold text-zinc-700">Full Name *</span>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Jane Smith"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs font-semibold text-zinc-700">Business Email *</span>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jane@agency.com"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="space-y-1 block">
                    <span className="text-xs font-semibold text-zinc-700">Company Name *</span>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Apex Digital Solutions"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs font-semibold text-zinc-700">Phone / WhatsApp</span>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs font-semibold text-zinc-700">Company Website</span>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://agency.com"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </label>
                </div>

                <label className="space-y-1 block">
                  <span className="text-xs font-semibold text-zinc-700">Select Partner Track *</span>
                  <select
                    value={formData.track}
                    onChange={(e) => setFormData({ ...formData, track: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="integrators">Solution Integrator &amp; AI Agency (Up to 25% rev-share)</option>
                    <option value="technology">Technology &amp; ISV Partner (Marketplace &amp; Tools)</option>
                    <option value="cloud">Cloud &amp; Infrastructure Host (Private VPC &amp; Helm)</option>
                    <option value="affiliates">Affiliate &amp; Growth Ambassador (15% Lifetime)</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs font-semibold text-zinc-700">Brief Overview of Your Business &amp; Clients</span>
                  <textarea
                    rows={3}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="We manage software and AI workflows for 20+ clients and want to integrate Abhibhideveloper tools..."
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm shadow-xs transition-all disabled:opacity-50"
                >
                  {submitting ? "Submitting Application & Notifying…" : "Submit Partner Application →"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-medium">
          <p>© {new Date().getFullYear()} ABHIBHIDEVELOPERS GROUP • Partner Network</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-zinc-900 transition-colors">
              Home
            </Link>
            <Link href="/marketplace" className="hover:text-zinc-900 transition-colors">
              Marketplace
            </Link>
            <Link href="/contact-sales" className="hover:text-zinc-900 transition-colors">
              Contact Sales
            </Link>
            <Link href="/status" className="hover:text-zinc-900 transition-colors">
              System Status
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
