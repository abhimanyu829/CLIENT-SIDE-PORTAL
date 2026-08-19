import React from "react"
import { Metadata } from "next"
import Link from "next/link"
import {
  ShieldCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  HelpCircle,
  ArrowRight,
  Bot,
  Code2,
  Cpu,
  Globe,
  Server,
  Zap,
  Layers,
  CreditCard,
  Building2,
  ShieldAlert,
  Sliders,
  Sparkles,
  Search,
  ChevronRight
} from "lucide-react"
import { CallToAction } from "@/components/public/CallToAction"

export const metadata: Metadata = {
  title: "Refund Policy & Cancellation Terms — NexusAI",
  description: "Comprehensive refund policy and cancellation terms for NexusAI SaaS products, AI agents, custom development, subscriptions, APIs, and digital services.",
}

export default function RefundPolicyPage() {
  const serviceCategories = [
    {
      title: "SaaS Products",
      icon: Cpu,
      badge: "Pre-Activation Only",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Cloud-hosted software tools and automated web applications.",
      rule: "Refund requests may be submitted within 24 hours of purchase if the SaaS account/instance has not been activated, logged into, or consumed. Post-activation refunds are unavailable except in cases of verified platform non-delivery."
    },
    {
      title: "AI Tools",
      icon: Sparkles,
      badge: "Usage Dependent",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      description: "AI prompt engineering tools, content generators, and analytical utilities.",
      rule: "Eligible for 24-hour pre-use cancellation. Once AI processing tokens, compute hours, or queries have been executed, purchases become non-refundable due to upstream LLM infrastructure costs."
    },
    {
      title: "AI Agents",
      icon: Bot,
      badge: "Pre-Deployment Only",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Autonomous AI agent instances, specialized workflow bots, and agent keys.",
      rule: "Eligible for refund prior to agent instance deployment or API key generation. Deployed or customized agent instances are non-refundable."
    },
    {
      title: "AI Model Development",
      icon: Layers,
      badge: "Milestone Based",
      badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      description: "Custom model fine-tuning, dataset curation, and domain adaptation.",
      rule: "Non-refundable once GPU compute allocation, dataset training, or model optimization has initiated. Pre-training cancellations may receive a partial refund minus setup costs."
    },
    {
      title: "Automation Services",
      icon: Zap,
      badge: "Pre-Execution Only",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Workflow integrations, API pipelines, and cross-platform automation triggers.",
      rule: "Eligible for refund if requested within 24 hours and before workflow architecture design or credential integration has commenced."
    },
    {
      title: "Websites & Landing Pages",
      icon: Globe,
      badge: "Work-Based Limits",
      badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      description: "Custom web development, landing pages, and web app deployments.",
      rule: "Non-refundable once initial design wireframes, code repository initialization, or domain binding has begun."
    },
    {
      title: "APIs & Credit Top-ups",
      icon: Code2,
      badge: "Strictly Non-Refundable",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
      description: "API access keys, token top-up packages, and pay-as-you-go developer credits.",
      rule: "API credits involve immediate server resource allocation and third-party inference costs; API top-ups and token bundles are strictly non-refundable."
    },
    {
      title: "Enterprise Services",
      icon: Building2,
      badge: "MSA Governed",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      description: "Custom SLA agreements, dedicated cloud infrastructure, and consulting.",
      rule: "Governed primarily by your executed Master Services Agreement (MSA) or Statement of Work (SOW). Standard online refunds do not apply post project kickoff."
    },
    {
      title: "Cloud & Deployment Services",
      icon: Server,
      badge: "Pre-Provisioning Only",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Managed server deployments, Cloudflare R2 storage buckets, and edge nodes.",
      rule: "Refundable within 24 hours provided cloud resource provisioning or server spin-up has not been executed."
    },
    {
      title: "Digital Products & Code",
      icon: FileText,
      badge: "Download Restricted",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
      description: "Downloadable source code, templates, UI kits, and digital asset packs.",
      rule: "Strictly non-refundable once the digital download link or license key has been revealed, accessed, or generated."
    },
    {
      title: "Custom Development",
      icon: Sliders,
      badge: "Phase Restricted",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      description: "Bespoke software features, custom scripts, and tailored module builds.",
      rule: "Non-refundable for completed or active milestones. If cancelled prior to developer assignment, a refund may be approved minus administrative fees."
    },
    {
      title: "Subscriptions",
      icon: RefreshCw,
      badge: "Cancellation Stops Renewal",
      badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
      description: "Monthly and annual recurring subscription plans for NexusAI platform.",
      rule: "Cancelling a subscription halts future automatic renewals. Subscriptions do not automatically issue prorated refunds for the active billing cycle."
    },
    {
      title: "Paid Add-Ons",
      icon: CreditCard,
      badge: "Activation Restricted",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Storage upgrades, priority support badges, and custom domain slots.",
      rule: "Refundable within 24 hours if the add-on feature has not been attached or utilized in an active deployment."
    },
    {
      title: "One-Time Purchases",
      icon: CheckCircle2,
      badge: "24-Hour Window",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Flat-rate lifetime licenses, single-use utility passes, and fixed deliverables.",
      rule: "Eligible for cancellation within 24 hours of transaction, provided no assets have been downloaded or services initiated."
    }
  ]

  const statusLifecycle = [
    {
      state: "PURCHASED → PAYMENT VERIFIED",
      condition: "Deployment Pending / Unactivated",
      status: "Potentially Eligible",
      statusColor: "text-emerald-800 bg-emerald-50 border-emerald-200",
      note: "Full refund available within 24-hour window if no work, code, or cloud provisioning has commenced."
    },
    {
      state: "PURCHASED → DEPLOYED / ACTIVATED",
      condition: "Service Live or Consumed",
      status: "Generally Non-Refundable",
      statusColor: "text-rose-800 bg-rose-50 border-rose-200",
      note: "Digital licenses, server resources, or AI compute have been allocated and activated."
    },
    {
      state: "PURCHASED → CUSTOMIZATION STARTED",
      condition: "Work / Development In Progress",
      status: "Generally Non-Refundable",
      statusColor: "text-amber-800 bg-amber-50 border-amber-200",
      note: "Developer time, architecture design, or model training has already been incurred."
    },
    {
      state: "PURCHASED → SERVICE UNDELIVERABLE",
      condition: "NexusAI Delivery Failure",
      status: "Admin Review / Possible Refund",
      statusColor: "text-purple-800 bg-purple-50 border-purple-200",
      note: "If NexusAI cannot deliver the ordered service due to technical constraints, full or partial refund will be issued."
    },
    {
      state: "DUPLICATE PAYMENT DETECTED",
      condition: "Multiple Charges for Same Order",
      status: "Instant Review & Full Refund",
      statusColor: "text-sky-800 bg-sky-50 border-sky-200",
      note: "Accidental duplicate transactions are verified via gateway logs and refunded in full."
    }
  ]

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen selection:bg-purple-600 selection:text-white">
      {/* Top Banner - Whitish Background with Crisp Slate Typography */}
      <div className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2.5 text-slate-800">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span className="text-slate-900 font-bold">NexusAI Official Operating Policy</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 font-medium">Last Revised: August 19, 2026</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/my-products"
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700 transition-all flex items-center gap-1.5 shadow-sm hover:scale-105"
            >
              <span>Request a Refund</span>
              <ChevronRight className="w-4 h-4 text-white" />
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative pt-16 pb-16 px-4 sm:px-6 max-w-7xl mx-auto overflow-hidden">
        {/* Soft Background Orbs for Light Theme */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] opacity-40 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-200 via-indigo-100 to-pink-200 blur-3xl rounded-full" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-purple-200 text-xs font-bold text-purple-900 mb-6 shadow-xs">
            <Clock className="w-4 h-4 text-purple-600" />
            <span>Standard 24-Hour Pre-Deployment Cancellation Policy</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 mb-6 leading-tight">
            NexusAI <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-pink-600 bg-clip-text text-transparent">Refund & Cancellation</span> Policy
          </h1>

          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-3xl mx-auto mb-10">
            NexusAI provides high-performance SaaS tools, autonomous AI agents, cloud deployments, and custom engineering services. This policy clearly outlines refund eligibility, non-refundable services, subscription rules, and administrative request procedures.
          </p>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 text-purple-700 text-xs font-bold uppercase tracking-wider mb-1">
                <Clock className="w-4 h-4 text-purple-600" /> 24-Hour Window
              </div>
              <p className="text-xs text-slate-600 font-medium">Cancellation window for unactivated, undeployed services.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> State-Based Review
              </div>
              <p className="text-xs text-slate-600 font-medium">Refunds are evaluated on actual service deployment state.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">
                <RefreshCw className="w-4 h-4 text-emerald-600" /> Seamless Support
              </div>
              <p className="text-xs text-slate-600 font-medium">Directly connected to your NexusAI Dashboard order system.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 space-y-16">

        {/* 1. Core Operating Principles */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-700 border border-purple-200 text-sm font-bold">1</span>
              Core Refund Principles & 24-Hour Policy
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">24-Hour Pre-Deployment Cancellation</h3>
                  <p className="text-xs text-slate-500 font-medium">Eligible Requests</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-normal">
                Customers may submit a cancellation and refund request within <strong className="text-slate-900">24 hours of purchase</strong> for eligible digital services, provided that the service has <strong className="text-slate-900">NOT</strong> been deployed, activated, materially customized, delivered, consumed, or otherwise started.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Post-Deployment Non-Refundable Rule</h3>
                  <p className="text-xs text-slate-500 font-medium">Standard Rule</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-normal">
                Once a digital product or service has been deployed, activated, customized, or delivered, refunds are <strong className="text-slate-900">not automatically available</strong>. Exceptions are only granted if NexusAI is unable to fulfill the service or if an Admin approves an exception.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Service Status Matrix */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 text-sm font-bold">2</span>
                Service Status Lifecycle & Refund Eligibility
              </h2>
              <p className="text-xs text-slate-600 font-medium mt-1">Refund decisions depend strictly on the real-time fulfillment status of your purchase.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-xs text-slate-900 font-extrabold uppercase tracking-wider">
                  <th className="py-4 px-6 font-bold">Purchase Lifecycle State</th>
                  <th className="py-4 px-6 font-bold">Fulfillment Status</th>
                  <th className="py-4 px-6 font-bold">Eligibility Outcome</th>
                  <th className="py-4 px-6 font-bold">Policy Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {statusLifecycle.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 font-mono text-xs font-bold text-slate-900">{item.state}</td>
                    <td className="py-4 px-6 text-slate-600 text-xs font-medium">{item.condition}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-600 leading-relaxed max-w-xs">{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Comprehensive Service Category Rules (All 14 Services) */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-100 text-pink-700 border border-pink-200 text-sm font-bold">3</span>
              Detailed Policy by Service Category
            </h2>
            <p className="text-xs text-slate-600 font-medium mt-1">Specific guidelines for every product, service, subscription, and custom offering on NexusAI.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {serviceCategories.map((cat, idx) => {
              const Icon = cat.icon
              return (
                <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${cat.badgeColor}`}>
                        {cat.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900">{cat.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">{cat.description}</p>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed pt-2 border-t border-slate-100">
                      {cat.rule}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 4. Subscriptions, Payments & Special Conditions */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-100 text-sky-700 border border-sky-200 text-sm font-bold">4</span>
              Subscriptions, Payments & Administrative Rules
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-3 text-sky-700">
                <RefreshCw className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Subscription Renewal & Cancellation</h3>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                You may cancel your recurring subscription at any time through the Billing section in your NexusAI Dashboard. Cancellation stops all future renewal charges. However, cancelling a subscription does not automatically grant a prorated refund for the remainder of the current billing cycle. You will retain full access until the end of your current paid period.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-3 text-emerald-700">
                <CreditCard className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Duplicate & Failed Payment Handling</h3>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                If an error or network glitch results in a duplicate charge for the same order, NexusAI will verify gateway transaction logs and automatically refund the duplicate amount to your original payment method. Failed payments will be retried or automatically cancelled without charging your account.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-3 text-amber-700">
                <Sliders className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Partial Refunds & Custom Work Limits</h3>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                For custom development, AI model tuning, or multi-phase automation projects, partial refunds may be issued at Admin discretion if a portion of the project deliverables cannot be completed. Partial amounts are calculated based on unfulfilled project milestones minus incurred third-party compute or setup fees.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-3 text-purple-700">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Administrative Exceptions & Fraud Prevention</h3>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                NexusAI reserves the right to review refund requests on a case-by-case basis and grant administrative exceptions in extraordinary circumstances (e.g. prolonged server downtime). Abusive refund requests, fraud, chargeback abuse, or bad-faith claims will result in immediate account suspension and entitlement revocation.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Step-by-Step Request Procedure */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-bold">5</span>
              How to Request a Refund (Step-by-Step)
            </h2>
            <p className="text-xs text-slate-600 font-medium mt-1">Refund requests are processed seamlessly through the existing NexusAI Admin/Refund workflow.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2 relative">
              <span className="text-3xl font-black text-purple-200">01</span>
              <h3 className="text-sm font-bold text-slate-900">Access Your Dashboard</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Log into your NexusAI account and navigate to <strong>My Products</strong> or <strong>Subscriptions</strong>.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2 relative">
              <span className="text-3xl font-black text-purple-200">02</span>
              <h3 className="text-sm font-bold text-slate-900">Select Order & Request</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Locate your order or entitlement ID and click <strong>Request Refund</strong> or open a support ticket.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2 relative">
              <span className="text-3xl font-black text-purple-200">03</span>
              <h3 className="text-sm font-bold text-slate-900">Provide Details</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Submit your Order ID, account email, reason category (Bug, Accidental, Undeliverable), and description.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2 relative">
              <span className="text-3xl font-black text-purple-200">04</span>
              <h3 className="text-sm font-bold text-slate-900">Admin Review & Settlement</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Requests are reviewed within 1-3 business days. Approved refunds are credited via payment gateway in 5-7 days.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3 text-xs text-purple-950 font-medium">
              <AlertCircle className="w-4 h-4 text-purple-700 shrink-0" />
              <span>Upon approved refund, access to associated digital licenses, API keys, or deployments will be suspended immediately.</span>
            </div>
            <Link
              href="/dashboard/my-products"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all inline-flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <span>Go to My Products</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </Link>
          </div>
        </section>

        {/* 6. Legal & Statutory Rights Disclaimer */}
        <section className="p-6 rounded-2xl bg-slate-100/90 border border-slate-200 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-700" />
            Legal Notice & Mandatory Statutory Rights
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            This policy defines operational terms for NexusAI digital products and cloud services and does not constitute formal legal advice. Nothing in this document overrides or waives mandatory consumer protection laws or statutory rights granted under applicable jurisdiction that cannot contractually be excluded.
          </p>
        </section>

      </div>

      {/* Call To Action Component Connected to Existing System */}
      <CallToAction
        title="Have Questions About Your Order or Billing?"
        description="Our dedicated support and billing team is available to assist with refund evaluations, payment inquiries, or custom service requests."
        ctaText="Request a Refund in Dashboard"
        ctaHref="/dashboard/my-products"
        secondaryCtaText="Contact Support"
        secondaryCtaHref="/dashboard/tickets"
      />
    </div>
  )
}
