import React from "react"
import Link from "next/link"
import { Metadata } from "next"
import {
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  Ban,
  FileCheck,
  Mail,
  Scale,
  Cpu,
  Terminal,
  Zap,
  Lock,
  ArrowRight,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Acceptable Use Policy (AUP) — Abhibhideveloper",
  description:
    "Acceptable Use Policy governing lawful, authorized, and responsible use of Abhibhideveloper websites, software, AI agents, and cloud platforms.",
  alternates: { canonical: "https://abhibhideveloper.tech/acceptable-use-policy" },
}

const PROHIBITED_CATEGORIES = [
  {
    title: "Cyberattacks & Malicious Activity",
    description: "Distributing malware, trojans, ransomware, or malicious payload scripts. Conducting unauthorized penetration tests, port scans, packet spoofing, or Distributed Denial of Service (DDoS) attacks against our infrastructure or any third party.",
    severity: "Strict Prohibition",
  },
  {
    title: "Unauthorized Access & Exploitation",
    description: "Attempting to probe, scan, or breach system authentication, token signatures, or security boundaries. Reverse-engineering proprietary microservices, bypassing payment checks, or subverting license seat limits.",
    severity: "Strict Prohibition",
  },
  {
    title: "Spam & Mass Unsolicited Outreach",
    description: "Using our email dispatcher (Resend), SMS relay (Twilio), or WhatsApp automation pipelines to transmit unsolicited commercial bulk email, phone spam, deceptive lottery notifications, or mass marketing in violation of CAN-SPAM or Indian DLT regulations.",
    severity: "Strict Prohibition",
  },
  {
    title: "Deceptive Impersonation & Fraud",
    description: "Misrepresenting identity, spoofing domain headers, fabricating transactional receipts, forging government identifiers (Aadhaar/PAN/Tax IDs), or operating fraudulent investment, crypto-doubler, or pyramid schemes.",
    severity: "Strict Prohibition",
  },
  {
    title: "Harmful Synthetic Content & Deepfakes",
    description: "Generating non-consensual sexually explicit imagery, political deepfakes designed to deceive electors, cyberbullying materials, or weaponized biological/chemical instructions via autonomous prompt chains.",
    severity: "Strict Prohibition",
  },
  {
    title: "Unlicensed High-Stakes Automation",
    description: "Using autonomous AI agents to provide unlicensed binding medical diagnostics, legal counsel, or financial portfolio management without certified professional human-in-the-loop oversight.",
    severity: "Conditional Human Review",
  },
]

const FAIR_USE_RULES = [
  {
    title: "API Throughput & Rate Limits",
    description: "All client tiers carry defined concurrency limits. Automated scripts must implement exponential backoff upon receiving HTTP 429 (Too Many Requests) and must not flood endpoints with redundant loops.",
  },
  {
    title: "AI Token Quotas & Compute Abuse",
    description: "Shared GPU inference pools and LLM context windows are monitored for denial-of-service token depletion. Customers may not deploy infinite recursion loops without circuit-breaker safeguards.",
  },
  {
    title: "Database & Storage Utilization",
    description: "Storage buckets and PostgreSQL database tables must not be utilized as public pirated media mirrors, torrent trackers, or unauthorized video hosting repositories.",
  },
]

export default function AcceptableUsePolicyPage() {
  return (
    <div className="min-h-screen bg-[#fcfbf9] text-zinc-900 selection:bg-amber-100 selection:text-amber-900 font-sans">
      {/* Top Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-80 pointer-events-none z-0 overflow-hidden opacity-60">
        <div className="absolute top-[-100px] left-1/4 w-[500px] h-[500px] bg-rose-100/60 rounded-full blur-[120px]" />
        <div className="absolute top-[-80px] right-1/4 w-[450px] h-[450px] bg-amber-100/60 rounded-full blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
        {/* Breadcrumb / Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-zinc-200/80">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              ABHIBHIDEVELOPERS GROUP • GOVERNANCE
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <Scale className="w-3.5 h-3.5 text-amber-600" />
            <span>Effective: 2026/2027 Policy Baseline</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 mb-6 shadow-xs">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
            <span>Responsible Platform Standards &amp; Safety</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-950 mb-6 leading-tight">
            Acceptable Use Policy
          </h1>
          <p className="text-base sm:text-xl text-zinc-600 leading-relaxed max-w-2xl mx-auto mb-8">
            This Acceptable Use Policy (AUP) outlines prohibited behaviors, responsible AI guidelines, and resource fairness standards governing all products, websites, APIs, and AI agents operated by Abhibhi Developers &amp; NexusAI.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#prohibitions"
              className="px-6 py-3 rounded-xl bg-zinc-950 hover:bg-black text-white font-bold text-sm shadow-sm transition-all"
            >
              View Prohibited Uses
            </a>
            <a
              href="mailto:abuse@abhibhideveloper.tech"
              className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 font-bold text-sm shadow-xs transition-all flex items-center gap-2"
            >
              <Mail className="w-4 h-4 text-zinc-500" />
              <span>Report Abuse Desk</span>
            </a>
          </div>
        </div>

        {/* Scope Notice */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 mb-16 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-950">Binding Contractual Addendum</h2>
              <p className="text-xs sm:text-sm text-zinc-600 mt-0.5">
                This policy forms an integral part of your Master Services Agreement, Terms of Service, and software licensing contracts. Violation may result in immediate suspension.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-zinc-500 shrink-0">
            Version 2.4 • Updated Oct 2026
          </span>
        </div>

        {/* Prohibited Activities Grid */}
        <div id="prohibitions" className="mb-16 scroll-mt-28">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Strictly Prohibited Activities
            </h2>
            <p className="text-sm text-zinc-600 mt-2 font-medium">
              You must not use our software, agents, webhooks, or cloud services to engage in, facilitate, or promote any of the following activities:
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PROHIBITED_CATEGORIES.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs hover:border-rose-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                      <Ban className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      {item.severity}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-zinc-950 mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Responsible AI Standards */}
        <div className="rounded-3xl border border-zinc-200 bg-gradient-to-b from-white via-amber-50/20 to-white p-8 sm:p-12 mb-16 shadow-xs">
          <div className="max-w-3xl mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider mb-3">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>AI Governance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Responsible AI &amp; Agent Deployment Rules
            </h2>
            <p className="text-sm text-zinc-600 mt-2 font-medium">
              Because NexusAI tools can automate significant operational workflows, subscribers are obligated to uphold human oversight and downstream transparency.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs">
              <h3 className="text-base font-black text-zinc-950 mb-2">1. Human-in-the-Loop</h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Workflows that generate financial transactions, medical summaries, or critical employment decisions must incorporate human verification prior to final execution.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs">
              <h3 className="text-base font-black text-zinc-950 mb-2">2. Communication Disclosure</h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                When using agents for automated customer service, customers should be clearly informed that they are interacting with an AI assistant where legally required.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs">
              <h3 className="text-base font-black text-zinc-950 mb-2">3. Zero Model Misuse</h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Adversarial jailbreak attacks, prompt leaking, and model weight extraction attempts are treated as severe security violations and trigger immediate credential revocation.
              </p>
            </div>
          </div>
        </div>

        {/* Fair Use & Resource Quotas */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10 mb-16 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mb-2">
            Resource Quotas &amp; Fair Use Policy
          </h2>
          <p className="text-sm text-zinc-600 mb-8 font-medium">
            To ensure zero performance degradation for shared platform tenants, all API keys and workspace runtimes are subject to fair use monitoring.
          </p>

          <div className="space-y-6 divide-y divide-zinc-100">
            {FAIR_USE_RULES.map((rule, i) => (
              <div key={i} className={i > 0 ? "pt-6" : ""}>
                <h3 className="text-base font-bold text-zinc-950 mb-1.5">{rule.title}</h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Enforcement & Reporting Desk */}
        <div className="rounded-3xl border border-zinc-200 bg-gradient-to-r from-rose-50 via-white to-amber-50/40 p-8 sm:p-10 mb-16 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-black text-zinc-950 mb-2">Notice of Policy Violation or Abuse</h3>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-xl font-medium">
              If you suspect an account or agent deployed via Abhibhi Developers is violating this policy, please notify our dedicated abuse desk immediately.
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs font-mono text-zinc-600">
              <span>Abuse Desk: <strong className="text-zinc-900">abuse@abhibhideveloper.tech</strong></span>
              <span>•</span>
              <span>SLA: <strong className="text-rose-700">Under 12 Hours</strong></span>
            </div>
          </div>
          <a
            href="mailto:abuse@abhibhideveloper.tech?subject=AUP%20Violation%20Report"
            className="px-6 py-3 rounded-xl bg-zinc-950 hover:bg-black text-white font-bold text-sm shadow-sm transition-all shrink-0"
          >
            Report Abuse →
          </a>
        </div>

        {/* Footer Navigation */}
        <div className="pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-medium">
          <p>© {new Date().getFullYear()} ABHIBHIDEVELOPERS GROUP • Acceptable Use &amp; Platform Governance</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/security" className="hover:text-zinc-900 transition-colors">
              Security
            </Link>
            <Link href="/gdpr" className="hover:text-zinc-900 transition-colors">
              GDPR Compliance
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
