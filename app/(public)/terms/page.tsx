import React from "react"
import { Metadata } from "next"
import Link from "next/link"
import { FileText, ShieldCheck, CreditCard, Scale, AlertCircle, ArrowRight, Lock, ExternalLink, BookOpen, CheckCircle2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Terms of Service — NexusAI",
  description: "Terms and conditions for using the NexusAI platform, API, and marketplace.",
}

const SECTIONS = [
  { id: "acceptance", number: "01", title: "Acceptance of Terms", icon: Scale },
  { id: "services", number: "02", title: "Description of Service & API", icon: FileText },
  { id: "conduct", number: "03", title: "User Conduct & AI Usage Rules", icon: ShieldCheck },
  { id: "billing", number: "04", title: "Billing, Subscriptions & Marketplace", icon: CreditCard },
  { id: "ip-rights", number: "05", title: "Intellectual Property & Output Rights", icon: Lock },
  { id: "liability", number: "06", title: "Limitation of Liability & SLA", icon: AlertCircle },
  { id: "termination", number: "07", title: "Account Termination & Governance", icon: BookOpen },
]

export default function TermsPage() {
  return (
    <div className="bg-white text-zinc-900 min-h-screen py-12 md:py-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Hero Card */}
        <div className="bg-gradient-to-br from-zinc-50 via-white to-purple-50/40 rounded-3xl p-8 md:p-12 border border-zinc-200/90 shadow-sm relative overflow-hidden">
          <div className="max-w-3xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 bg-purple-100/80 text-purple-900 border border-purple-200/80 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5 text-purple-700" />
              <span>Legal Agreement & Operating Terms</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900">
              Terms of Service
            </h1>
            
            <p className="text-base sm:text-lg text-zinc-600 font-medium leading-relaxed">
              These terms govern your access to and use of the NexusAI platform, developer APIs, autonomous agent marketplace, and enterprise deployment services.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200/60">
              <span>Last Updated: <strong className="text-zinc-900">May 21, 2026</strong></span>
              <span>•</span>
              <span>Version: <strong className="text-zinc-900">2.4 (Enterprise Ready)</strong></span>
              <span>•</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">Active Document</span>
            </div>
          </div>
        </div>

        {/* Main Grid: Sidebar TOC + Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Sticky Table of Contents */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <div className="bg-zinc-50/80 rounded-2xl p-5 border border-zinc-200/80 space-y-4">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" />
                Table of Contents
              </h2>

              <nav className="space-y-1">
                {SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:text-purple-700 hover:bg-purple-50/80 transition-all group"
                  >
                    <span className="text-xs font-mono font-bold text-zinc-400 group-hover:text-purple-600">{sec.number}</span>
                    <span className="flex-1 truncate">{sec.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-purple-600" />
                  </a>
                ))}
              </nav>
            </div>

            {/* Related Policies Box */}
            <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-xs space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-500">Related Legal Documents</h3>
              <div className="space-y-2 text-sm font-semibold">
                {[
                  { href: "/privacy", label: "Privacy Policy", icon: Lock },
                  { href: "/refund-policy", label: "Refund & Cancellation Policy", icon: CreditCard },
                  { href: "/gdpr", label: "GDPR Compliance", icon: ShieldCheck },
                  { href: "/security", label: "Security & Trust Portal", icon: Lock },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 hover:border-purple-200 hover:bg-purple-50/50 text-zinc-700 hover:text-purple-900 transition-all text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <item.icon className="w-3.5 h-3.5 text-purple-600" />
                      {item.label}
                    </span>
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Structured Legal Sections */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* 1. Acceptance */}
            <section id="acceptance" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  01
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">1. Acceptance of Terms</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                By accessing, registering for, or using the NexusAI platform, APIs, developer SDKs, or hosted AI workflows (collectively, the "Service"), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or other legal entity, you represent that you have authority to bind such entity.
              </p>
              
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-4 text-xs font-semibold text-amber-900 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Important Notice:</strong> If you do not agree with any part of these terms, you must immediately cease accessing the platform and disconnect your API integrations.
                </p>
              </div>
            </section>

            {/* 2. Description of Service */}
            <section id="services" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  02
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">2. Description of Service & API</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                NexusAI provides an intelligent orchestration platform, developer marketplace, and high-performance API for deploying autonomous AI agents and SaaS tools. You acknowledge that computational usage, token consumption, and edge deployments are monitored and billed according to your active subscription plan.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-medium">
                <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 space-y-1">
                  <span className="font-bold text-zinc-900 block">⚡ High-Speed Edge Delivery</span>
                  <span className="text-zinc-600">Sub-100ms response targets for all streaming AI endpoints.</span>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 space-y-1">
                  <span className="font-bold text-zinc-900 block">🔒 Rate Limit Enforcement</span>
                  <span className="text-zinc-600">Fair usage rules apply based on tier allocations.</span>
                </div>
              </div>
            </section>

            {/* 3. Conduct & AI Rules */}
            <section id="conduct" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  03
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">3. User Conduct & AI Usage Rules</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                To maintain system security and ethical standards across our AI agent infrastructure, you strictly agree not to use the Service for any prohibited activities:
              </p>

              <ul className="space-y-2.5 text-sm text-zinc-700 font-medium">
                {[
                  "Generating, transmitting, or deploying malware, exploit payloads, or malicious scripts.",
                  "Attempting to bypass rate limits, probe internal infrastructure, or launch DDoS attacks.",
                  "Creating non-consensual deepfakes, CSAM, or deceptive synthetic media targeting individuals.",
                  "Scraping or harvesting NexusAI data to train competing foundational AI models.",
                  "Reverse engineering proprietary agent prompts, backend workflows, or system architecture.",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 bg-rose-50/40 p-3 rounded-xl border border-rose-100/80">
                    <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-zinc-800">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 4. Billing & Subscriptions */}
            <section id="billing" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  04
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">4. Billing, Subscriptions & Marketplace</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                NexusAI uses secure PCI-DSS compliant gateways (Stripe, Razorpay) for transaction processing. Paid subscriptions auto-renew at the start of each billing period unless explicitly cancelled via your billing dashboard.
              </p>

              <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-4 text-xs font-semibold text-purple-950 flex items-start gap-3">
                <CreditCard className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-purple-900">Automatic Billing & Cancellation Policy</p>
                  <p className="text-purple-800 leading-normal">
                    You can manage or cancel your subscription at any time under your Account Settings. Refunds are governed strictly by our <Link href="/refund-policy" className="underline font-bold text-purple-900">Refund Policy</Link>.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. Intellectual Property */}
            <section id="ip-rights" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  05
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">5. Intellectual Property & Output Rights</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                <strong>Your Data Remains Yours:</strong> You retain full ownership of all data, text, code, and media payloads uploaded to NexusAI. We do not claim ownership over output generated by your deployed AI agents.
              </p>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                NexusAI retains all rights, titles, and interest in and to the platform codebase, user interfaces, system architecture, and brand logos.
              </p>
            </section>

            {/* 6. Limitation of Liability */}
            <section id="liability" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  06
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">6. Limitation of Liability & SLA</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                To the maximum extent permitted by applicable law, NexusAI shall not be liable for indirect, incidental, special, or consequential damages resulting from platform downtime, loss of data, or third-party LLM service interruptions. Enterprise SLAs (99.9% uptime) apply solely to qualified Enterprise Plan customers.
              </p>
            </section>

            {/* 7. Termination */}
            <section id="termination" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  07
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">7. Account Termination & Governance</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                We reserve the right to suspend or terminate accounts that violate our conduct policies, fail to settle outstanding balances, or pose security risks to our platform. You may request account deletion at any time by contacting support.
              </p>
              
              <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-zinc-900">Questions about our Terms?</p>
                  <p className="text-xs text-zinc-500">Our legal team is available for compliance inquiries.</p>
                </div>
                <Link
                  href="/contact-sales"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs transition-all shadow-xs hover:scale-[1.02] shrink-0"
                >
                  Contact Legal Team →
                </Link>
              </div>
            </section>

          </div>
        </div>

      </div>
    </div>
  )
}

