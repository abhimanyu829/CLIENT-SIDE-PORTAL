import React from "react"
import Link from "next/link"
import { Metadata } from "next"
import {
  ShieldCheck,
  Lock,
  Key,
  Server,
  Eye,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Download,
  Mail,
  Zap,
  Globe,
  Terminal,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Security & Trust Center — ABHIBHIDEVELOPERS GROUP | NexusAI",
  description:
    "Enterprise-grade security architecture, AES-256 encryption, zero customer data training, SOC 2 compliance, and AI governance at Abhibhi Developers & NexusAI.",
}

const SECURITY_PILLARS = [
  {
    icon: Lock,
    title: "End-to-End Cryptography",
    description: "All customer data is encrypted in transit using TLS 1.3 with Perfect Forward Secrecy, and encrypted at rest using industry-standard AES-256 with automated key rotation.",
    badge: "AES-256 / TLS 1.3",
  },
  {
    icon: Key,
    title: "Hardware Security Modules (HSM)",
    description: "API keys, database credentials, and OAuth tokens are stored in tamper-resistant HSMs (AWS KMS & HashiCorp Vault). Secrets are never logged or exposed in plain text.",
    badge: "FIPS 140-2 Level 3",
  },
  {
    icon: ShieldCheck,
    title: "Penetration Testing & Audits",
    description: "Independent, CREST-accredited cybersecurity firms perform regular black-box and white-box penetration tests on our APIs, orchestrator, and web dashboards.",
    badge: "Biannual Audits",
  },
  {
    icon: Server,
    title: "Multi-Tenant VPC Network Isolation",
    description: "Customer workloads execute within strictly isolated Virtual Private Clouds (VPCs) with zero cross-tenant packet leakage. Dedicated single-tenant clusters are available for enterprise tiers.",
    badge: "Zero-Trust Architecture",
  },
  {
    icon: Eye,
    title: "Immutable Observability & Auditing",
    description: "Every API call, authorization grant, token refresh, and configuration mutation generates an append-only audit log with microsecond timestamps for forensic integrity.",
    badge: "Write-Once Logs",
  },
  {
    icon: FileCheck,
    title: "Global Regulatory Compliance",
    description: "Built to satisfy SOC 2 Type II, ISO/IEC 27001, HIPAA readiness, and GDPR European data residency requirements with documented governance controls.",
    badge: "SOC 2 & ISO 27001",
  },
]

const AI_DEFENSES = [
  {
    icon: Terminal,
    title: "Prompt Injection & Jailbreak Defense",
    description: "Multi-stage heuristic and neural classifier firewalls inspect incoming prompts to detect, sanitize, and neutralize prompt injections, indirect jailbreaks, and adversarial payloads before reaching models.",
  },
  {
    icon: Eye,
    title: "Automated PII Masking & Redaction",
    description: "Built-in privacy middleware automatically scans and masks Personally Identifiable Information (Aadhaar, PAN, SSN, Credit Cards, Phone Numbers) prior to external model routing.",
  },
  {
    icon: ShieldCheck,
    title: "Zero Model Training Guarantee",
    description: "We enforce strict zero-retention commercial API agreements with all foundation model partners (OpenAI, Anthropic, Google). Your business data is NEVER used to train foundational AI models.",
  },
  {
    icon: Cpu,
    title: "Sandboxed Tool & Agent Execution",
    description: "Autonomous agent tools execute within ephemeral, memory-limited, read-only Docker/gVisor micro-sandboxes with isolated network namespaces to prevent host compromise.",
  },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#fcfbf9] text-zinc-900 selection:bg-amber-100 selection:text-amber-900 font-sans">
      {/* Top Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-80 pointer-events-none z-0 overflow-hidden opacity-60">
        <div className="absolute top-[-100px] left-1/4 w-[500px] h-[500px] bg-amber-100/60 rounded-full blur-[120px]" />
        <div className="absolute top-[-80px] right-1/4 w-[450px] h-[450px] bg-emerald-100/60 rounded-full blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
        {/* Breadcrumb / Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-zinc-200/80">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              ABHIBHIDEVELOPERS GROUP • TRUST CENTER
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All Security Systems Operational</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-xs font-bold text-amber-800 mb-6 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Bank-Grade Infrastructure &amp; AI Safety Governance</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-950 mb-6 leading-tight">
            Security &amp; Trust Center
          </h1>
          <p className="text-base sm:text-xl text-zinc-600 leading-relaxed max-w-2xl mx-auto mb-8">
            Security is not an afterthought; it is the mathematical foundation of Abhibhi Developers &amp; NexusAI. We safeguard your workflows, proprietary code, and enterprise data.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact-sales"
              className="px-6 py-3 rounded-xl bg-zinc-950 hover:bg-black text-white font-bold text-sm shadow-sm transition-all"
            >
              Request Security Whitepaper
            </Link>
            <a
              href="mailto:security@abhibhideveloper.tech"
              className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 font-bold text-sm shadow-xs transition-all flex items-center gap-2"
            >
              <Mail className="w-4 h-4 text-zinc-500" />
              <span>Contact Security Team</span>
            </a>
          </div>
        </div>

        {/* Compliance Badges Banner */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 mb-16 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-xl font-black text-zinc-950">SOC 2 Type II</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Audited Controls</p>
          </div>
          <div>
            <p className="text-xl font-black text-zinc-950">ISO/IEC 27001</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Certified Information Security</p>
          </div>
          <div>
            <p className="text-xl font-black text-zinc-950">GDPR &amp; DPA</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">EU Data Sovereignty</p>
          </div>
          <div>
            <p className="text-xl font-black text-zinc-950">HIPAA Ready</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Healthcare Data Protection</p>
          </div>
        </div>

        {/* 6 Core Architecture Pillars */}
        <div className="mb-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Enterprise Security Architecture
            </h2>
            <p className="text-sm text-zinc-600 mt-2 font-medium">
              Multi-tiered defense mechanisms engineered for enterprise scale, high concurrency, and zero cross-tenant contamination.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SECURITY_PILLARS.map((pillar) => {
              const Icon = pillar.icon
              return (
                <div
                  key={pillar.title}
                  className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-7 shadow-xs hover:border-zinc-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {pillar.badge}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-zinc-950 mb-2">
                      {pillar.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* AI Safety & Model Governance Deep Dive */}
        <div className="rounded-3xl border border-zinc-200 bg-gradient-to-b from-white via-amber-50/20 to-white p-8 sm:p-12 mb-16 shadow-xs">
          <div className="max-w-3xl mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider mb-3">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Responsible AI Governance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              AI Model Defense &amp; Privacy Shield
            </h2>
            <p className="text-sm text-zinc-600 mt-2 font-medium">
              Deploying autonomous agents requires real-time sanitization and guardrails. NexusAI embeds defense layers at every prompt, completion, and tool invocation.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {AI_DEFENSES.map((defense) => {
              const Icon = defense.icon
              return (
                <div key={defense.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-black text-zinc-950">{defense.title}</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                    {defense.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Vulnerability Disclosure & Bug Bounty */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10 mb-16 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mb-2">
                Responsible Vulnerability Disclosure Program
              </h2>
              <p className="text-sm text-zinc-600 leading-relaxed font-normal">
                We welcome submissions from security researchers worldwide. If you believe you have discovered a potential vulnerability within Abhibhi Developers or NexusAI infrastructure, please report it responsibly. We provide safe harbor for researchers operating in good faith.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-600">
                <span>Security Desk: <strong className="text-zinc-900">security@abhibhideveloper.tech</strong></span>
                <span>•</span>
                <span>Response SLA: <strong className="text-emerald-700">Within 24 Hours</strong></span>
              </div>
            </div>

            <div className="shrink-0">
              <a
                href="mailto:security@abhibhideveloper.tech?subject=Security%20Vulnerability%20Report"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-xs transition-colors"
              >
                <span>Submit Security Report</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-medium">
          <p>© {new Date().getFullYear()} ABHIBHIDEVELOPERS GROUP • Trust Center &amp; Security</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/gdpr" className="hover:text-zinc-900 transition-colors">
              GDPR Compliance
            </Link>
            <Link href="/acceptable-use-policy" className="hover:text-zinc-900 transition-colors">
              Acceptable Use Policy
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
