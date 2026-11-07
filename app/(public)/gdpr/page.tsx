import React from "react"
import Link from "next/link"
import { Metadata } from "next"
import {
  ShieldCheck,
  Lock,
  Globe,
  FileText,
  UserCheck,
  Download,
  Mail,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check,
  Server,
  Database,
  ArrowRight,
} from "lucide-react"

export const metadata: Metadata = {
  title: "GDPR Compliance & EU Privacy — Abhibhideveloper",
  description:
    "Abhibhideveloper's comprehensive commitment to General Data Protection Regulation (GDPR) compliance, data subject rights, EU data residency, and subprocessor transparency.",
  alternates: { canonical: "https://abhibhideveloper.tech/gdpr" },
}

const DATA_SUBJECT_RIGHTS = [
  {
    article: "Article 15",
    title: "Right to Access",
    description: "You have the right to request full confirmation of whether your personal data is being processed, and to obtain an export of all account, billing, and agent records.",
  },
  {
    article: "Article 16",
    title: "Right to Rectification",
    description: "You may correct inaccurate or incomplete personal information at any time directly through your dashboard profile or by contacting our Data Protection Officer.",
  },
  {
    article: "Article 17",
    title: "Right to Erasure (To Be Forgotten)",
    description: "You can request permanent deletion of your account, API tokens, and workspace telemetry. Hard database purge and backup zeroization completes within 30 days.",
  },
  {
    article: "Article 18",
    title: "Right to Restrict Processing",
    description: "You have the right to freeze processing of your personal data where you contest accuracy or legality, while retaining the data for legal dispute resolution.",
  },
  {
    article: "Article 20",
    title: "Right to Data Portability",
    description: "Export all your invoices, order licenses, agent configurations, and audit telemetry in structured, machine-readable JSON and CSV formats at zero cost.",
  },
  {
    article: "Article 21",
    title: "Right to Object",
    description: "You can object at any time to the processing of your data for direct marketing, profiling, or research purposes with a single click in your communications settings.",
  },
]

const SUBPROCESSORS = [
  { name: "Amazon Web Services (AWS)", purpose: "Cloud infrastructure, storage, and VPC compute hosting", location: "EU (Frankfurt) & US (N. Virginia)" },
  { name: "Clerk Inc.", purpose: "Authentication, session verification, and Passkey MFA", location: "Global Edge Network" },
  { name: "Neon Inc.", purpose: "Serverless PostgreSQL database clusters with point-in-time recovery", location: "EU (Frankfurt) & US (East)" },
  { name: "Resend Inc.", purpose: "Transactional order confirmation and verification email routing", location: "United States" },
  { name: "Twilio Inc.", purpose: "SMS and WhatsApp customer alert delivery relay", location: "Global Carrier Gateway" },
  { name: "Razorpay / Stripe", purpose: "PCI-DSS Level 1 compliant payment processing and billing", location: "India & Global" },
]

const FAQS = [
  {
    q: "Where is European customer data stored?",
    a: "European enterprise clients can mandate EU-only data residency during onboarding. In this tier, your databases, vector indexes, and agent sandboxes remain exclusively within our Frankfurt (eu-central-1) and Dublin (eu-west-1) availability zones.",
  },
  {
    q: "How does NexusAI handle international data transfers?",
    a: "Where data is transferred outside the European Economic Area (EEA), we execute the European Commission's approved Standard Contractual Clauses (SCCs) alongside supplementary technical encryption safeguards (AES-256 and TLS 1.3).",
  },
  {
    q: "How do I submit a Data Subject Access Request (DSAR)?",
    a: "You can submit a DSAR anytime by emailing dpo@abhibhideveloper.tech with the subject 'GDPR Data Subject Request'. Our legal team verifies your identity and fulfills the request within 30 calendar days as required by GDPR Article 12.",
  },
  {
    q: "Does NexusAI use customer data to train AI models?",
    a: "No. NexusAI operates under strict zero-data-retention and zero-training commercial agreements with foundation model providers (OpenAI, Anthropic, Google). Customer prompt content and outputs are never repurposed for model training.",
  },
  {
    q: "What is your Data Breach Notification policy?",
    a: "In the unlikely event of a security incident impacting personal data, NexusAI will notify relevant supervisory authorities and affected customers within 72 hours of becoming aware of the breach, pursuant to GDPR Articles 33 and 34.",
  },
]

export default function GDPRPage() {
  return (
    <div className="min-h-screen bg-[#fcfbf9] text-zinc-900 selection:bg-amber-100 selection:text-amber-900 font-sans">
      {/* Top Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-80 pointer-events-none z-0 overflow-hidden opacity-60">
        <div className="absolute top-[-100px] left-1/4 w-[500px] h-[500px] bg-sky-100/60 rounded-full blur-[120px]" />
        <div className="absolute top-[-80px] right-1/4 w-[450px] h-[450px] bg-amber-100/60 rounded-full blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
        {/* Breadcrumb / Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-zinc-200/80">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              ABHIBHIDEVELOPERS GROUP • LEGAL &amp; PRIVACY
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-300">
            <Globe className="w-3.5 h-3.5 text-sky-600" />
            <span>GDPR (EU 2016/679) Compliant</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-xs font-bold text-sky-800 mb-6 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>European Data Privacy &amp; Data Subject Rights</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-950 mb-6 leading-tight">
            GDPR Compliance Center
          </h1>
          <p className="text-base sm:text-xl text-zinc-600 leading-relaxed max-w-2xl mx-auto mb-8">
            Abhibhi Developers &amp; NexusAI are dedicated to full compliance with the EU General Data Protection Regulation. We empower you with transparent data stewardship, EU residency options, and complete control over your personal records.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:dpo@abhibhideveloper.tech?subject=GDPR%20DPA%20Execution%20Request"
              className="px-6 py-3 rounded-xl bg-zinc-950 hover:bg-black text-white font-bold text-sm shadow-sm transition-all"
            >
              Sign Data Processing Agreement (DPA)
            </a>
            <a
              href="mailto:dpo@abhibhideveloper.tech"
              className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 font-bold text-sm shadow-xs transition-all flex items-center gap-2"
            >
              <Mail className="w-4 h-4 text-zinc-500" />
              <span>Contact Data Protection Officer</span>
            </a>
          </div>
        </div>

        {/* Controller vs Processor Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10 mb-16 shadow-xs">
          <h2 className="text-2xl font-black text-zinc-950 mb-6">Our Roles Under GDPR</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200">
              <span className="text-xs font-mono font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                Role 1: Data Controller
              </span>
              <h3 className="text-lg font-black text-zinc-950 mt-3 mb-2">Customer Account &amp; Billing Data</h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                When you create an account, purchase digital licenses, subscribe to SaaS tools, or communicate with our support desk, Abhibhi Developers acts as a <strong>Data Controller</strong>. We process your contact and transaction details lawfully to fulfill our contractual commitments.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200">
              <span className="text-xs font-mono font-bold uppercase text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                Role 2: Data Processor
              </span>
              <h3 className="text-lg font-black text-zinc-950 mt-3 mb-2">AI Agent &amp; Customer Workloads</h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                When you deploy AI agents, trigger API automations, or ingest knowledge documents into NexusAI, you remain the Data Controller and we act strictly as the <strong>Data Processor</strong>. We execute instructions exclusively pursuant to our Data Processing Agreement (DPA).
              </p>
            </div>
          </div>
        </div>

        {/* 6 Data Subject Rights */}
        <div className="mb-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Exercising Your Data Subject Rights
            </h2>
            <p className="text-sm text-zinc-600 mt-2 font-medium">
              We provide direct self-service dashboard tools and a dedicated DPO office to ensure all Chapter III GDPR rights are fulfilled without delay.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {DATA_SUBJECT_RIGHTS.map((right) => (
              <div
                key={right.title}
                className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs hover:border-zinc-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-md inline-block mb-3">
                    {right.article}
                  </span>
                  <h3 className="text-base font-black text-zinc-950 mb-2">{right.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                    {right.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subprocessor Directory */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10 mb-16 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                Authorised Subprocessors
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 mt-1">
                We maintain an exhaustive, vetted register of third-party infrastructure providers that process data on our behalf.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 shrink-0">
              Updated: October 2026
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-zinc-600 font-semibold">
                  <th className="py-3 px-4">Subprocessor Name</th>
                  <th className="py-3 px-4">Core Purpose</th>
                  <th className="py-3 px-4">Hosting Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.name} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-zinc-950">{s.name}</td>
                    <td className="py-3.5 px-4 text-zinc-600">{s.purpose}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-zinc-700">{s.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* GDPR FAQs */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10 mb-16 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mb-8">
            Frequently Asked GDPR Questions
          </h2>
          <div className="space-y-6 divide-y divide-zinc-100">
            {FAQS.map((faq, i) => (
              <div key={i} className={i > 0 ? "pt-6" : ""}>
                <h3 className="text-base font-bold text-zinc-950 mb-2">{faq.q}</h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* DPO Contact CTA */}
        <div className="rounded-3xl border border-zinc-200 bg-gradient-to-r from-sky-50 via-white to-amber-50/40 p-8 sm:p-10 mb-16 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-black text-zinc-950 mb-2">Have a GDPR Inquiry or Data Subject Request?</h3>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-xl">
              Our Data Protection Officer reviews all European privacy inquiries, DSAR requests, and custom DPA countersignatures within 24–48 hours.
            </p>
          </div>
          <a
            href="mailto:dpo@abhibhideveloper.tech"
            className="px-6 py-3 rounded-xl bg-zinc-950 hover:bg-black text-white font-bold text-sm shadow-sm transition-all shrink-0"
          >
            Email DPO Team →
          </a>
        </div>

        {/* Footer Navigation */}
        <div className="pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-medium">
          <p>© {new Date().getFullYear()} ABHIBHIDEVELOPERS GROUP • GDPR &amp; Privacy Governance</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/security" className="hover:text-zinc-900 transition-colors">
              Security
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
