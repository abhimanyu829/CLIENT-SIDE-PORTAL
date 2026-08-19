import React from "react"
import { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck, Lock, Database, Layers, Share2, UserCheck, ArrowRight, ExternalLink, BookOpen, AlertCircle, FileText, CheckCircle2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Privacy Policy — ABHIBHIDEVELOPERS",
  description: "How ABHIBHIDEVELOPERS collects, uses, protects, and isolates your data and AI agent payloads.",
}

const SECTIONS = [
  { id: "collection", number: "01", title: "Information We Collect", icon: Database },
  { id: "usage", number: "02", title: "How We Use Your Data", icon: Layers },
  { id: "ai-isolation", number: "03", title: "AI Processing & Data Isolation", icon: ShieldCheck },
  { id: "sharing", number: "04", title: "Data Sharing & Vendors", icon: Share2 },
  { id: "user-rights", number: "05", title: "Your Rights & Controls", icon: UserCheck },
  { id: "security", number: "06", title: "Security & Retention", icon: Lock },
]

export default function PrivacyPage() {
  return (
    <div className="bg-white text-zinc-900 min-h-screen py-12 md:py-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Hero Card */}
        <div className="bg-gradient-to-br from-purple-50/60 via-white to-zinc-50 rounded-3xl p-8 md:p-12 border border-zinc-200/90 shadow-sm relative overflow-hidden">
          <div className="max-w-3xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 bg-purple-100/80 text-purple-900 border border-purple-200/80 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
              <span>Data Privacy & Protection Policy</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900">
              Privacy Policy
            </h1>
            
            <p className="text-base sm:text-lg text-zinc-600 font-medium leading-relaxed">
              At ABHIBHIDEVELOPERS, we prioritize the confidentiality, security, and strict isolation of your data across our cloud orchestration platform, API endpoints, and agent marketplace.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200/60">
              <span>Last Updated: <strong className="text-zinc-900">May 21, 2026</strong></span>
              <span>•</span>
              <span>Version: <strong className="text-zinc-900">2.4 (Enterprise Trust)</strong></span>
              <span>•</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">Active Policy</span>
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
                  { href: "/terms", label: "Terms of Service", icon: FileText },
                  { href: "/refund-policy", label: "Refund & Cancellation Policy", icon: FileText },
                  { href: "/gdpr", label: "GDPR Compliance", icon: ShieldCheck },
                  { href: "/security", label: "Security Portal", icon: Lock },
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

          {/* Right Column: Structured Privacy Sections */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* 1. Collection */}
            <section id="collection" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  01
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">1. Information We Collect</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                We collect information necessary to provide and operate the ABHIBHIDEVELOPERS platform. This includes:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium pt-1">
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 space-y-1">
                  <span className="font-bold text-zinc-900 block">👤 Account & Auth Data</span>
                  <span className="text-zinc-600">Email, name, organization details, and OAuth profile links.</span>
                </div>
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 space-y-1">
                  <span className="font-bold text-zinc-900 block">📊 Usage & API Telemetry</span>
                  <span className="text-zinc-600">API call volume, latency metrics, IP address, and browser headers.</span>
                </div>
              </div>
            </section>

            {/* 2. Usage */}
            <section id="usage" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  02
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">2. How We Use Your Data</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                We use collected information solely to power, secure, and improve our services:
              </p>
              
              <ul className="space-y-2 text-sm text-zinc-700 font-medium">
                {[
                  "Provisioning and maintaining your developer workspace and agent infrastructure.",
                  "Processing payments, invoices, and managing subscription renewals.",
                  "Sending critical security advisories, system status alerts, and billing receipts.",
                  "Detecting, preventing, and mitigating security threats or abusive API usage.",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-purple-50/50 p-3 rounded-xl border border-purple-100 text-xs font-semibold text-purple-950">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 3. AI Processing & Data Isolation (CRUCIAL HIGHLIGHT) */}
            <section id="ai-isolation" className="bg-white rounded-2xl p-6 md:p-8 border border-purple-200 shadow-sm space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm">
                  03
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">3. AI Processing & Data Isolation</h2>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 border border-purple-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-purple-900 font-black text-sm uppercase tracking-wide">
                  <ShieldCheck className="w-5 h-5 text-purple-700" />
                  <span>Strict Data Isolation Guarantee</span>
                </div>
                <p className="text-xs sm:text-sm text-purple-950 font-bold leading-relaxed">
                  Crucial Commitment: We NEVER use your proprietary business data, API payloads, prompt logs, or agent conversation history to train our underlying foundational models or third-party LLMs.
                </p>
              </div>

              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                All model inference requests pass through end-to-end encrypted pipelines with zero persistent log retention on intermediate proxy routers.
              </p>
            </section>

            {/* 4. Sharing */}
            <section id="sharing" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  04
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">4. Data Sharing & Third-Party Vendors</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                We never sell or monetize your personal or business data. We only share data with essential, audited third-party subprocessors strictly required to operate our service (e.g. Stripe for payments, AWS/GCP for hosting). All subprocessors are bound by Data Processing Addendums (DPAs).
              </p>
            </section>

            {/* 5. User Rights */}
            <section id="user-rights" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  05
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">5. Your Rights & Controls</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                Depending on your jurisdiction (e.g., GDPR in Europe, CCPA in California), you possess explicit rights regarding your data:
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {["Right to Access", "Right to Rectification", "Right to Erasure (Delete)", "Right to Data Portability"].map((r, i) => (
                  <span key={i} className="text-xs font-bold text-zinc-800 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-xl">
                    ✓ {r}
                  </span>
                ))}
              </div>

              <p className="text-xs text-zinc-500 font-medium">
                See our <Link href="/gdpr" className="text-purple-600 font-bold underline">GDPR Compliance</Link> page for specific instructions on submitting data subject requests.
              </p>
            </section>

            {/* 6. Security */}
            <section id="security" className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200/90 shadow-xs space-y-4 scroll-mt-28">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                  06
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900">6. Security & Retention</h2>
              </div>
              <p className="text-zinc-600 text-sm leading-relaxed font-medium">
                We employ AES-256 encryption at rest and TLS 1.3 in transit. Data is retained only for as long as your account remains active or as required by law.
              </p>

              <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-zinc-900">Have privacy concerns?</p>
                  <p className="text-xs text-zinc-500">Our Data Protection Officer (DPO) is ready to help.</p>
                </div>
                <Link
                  href="/contact-sales"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-xs hover:scale-[1.02] shrink-0"
                >
                  Contact DPO →
                </Link>
              </div>
            </section>

          </div>
        </div>

      </div>
    </div>
  )
}

