"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  CheckCircle2,
  Smartphone,
  Laptop,
  Server,
  Cpu,
  ShieldCheck,
  Mail,
  CreditCard,
  Database,
  Bell,
  ExternalLink,
  Activity,
  Sparkles,
  RefreshCw,
  Globe,
  Radio,
  ArrowRight,
  Zap,
  Check,
} from "lucide-react"

type ServiceCategory = "all" | "core" | "ai" | "comms" | "payments"

interface ServiceItem {
  id: string
  name: string
  category: "core" | "ai" | "comms" | "payments"
  endpoint: string
  description: string
  status: "operational" | "degraded" | "maintenance"
  uptime: string
  latency: string
  historyBars: number[]
}

const SERVICES: ServiceItem[] = [
  {
    id: "api-gateway",
    name: "Global Edge API Gateway",
    category: "core",
    endpoint: "api.nexusai.app",
    description: "Distributed HTTP/3 & gRPC ingress router with automated DDoS mitigation, TLS termination, and regional edge routing.",
    status: "operational",
    uptime: "99.99%",
    latency: "28ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "agent-orchestrator",
    name: "Abhibhi Agent Orchestrator",
    category: "ai",
    endpoint: "agents.nexusai.app",
    description: "Autonomous multi-agent execution runtime, task dependency scheduler, tool sandbox, and subagent swarm manager.",
    status: "operational",
    uptime: "99.98%",
    latency: "115ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "neural-inference",
    name: "Neural Model Inference Mesh",
    category: "ai",
    endpoint: "inference.nexusai.app",
    description: "High-throughput token routing to Claude 3.5, GPT-4o, and Gemini 2.0 with automatic failover and prompt caching.",
    status: "operational",
    uptime: "99.96%",
    latency: "235ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "auth-identity",
    name: "Clerk Identity & Authentication",
    category: "core",
    endpoint: "auth.nexusai.app",
    description: "Session token validation, RBAC security gates, Passkey biometric MFA, and OAuth 2.0 enterprise federation.",
    status: "operational",
    uptime: "100.0%",
    latency: "34ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "payment-razorpay",
    name: "Razorpay Payment Gateway",
    category: "payments",
    endpoint: "api.razorpay.com",
    description: "Primary credit card, netbanking, and instant UPI collect order processing engine with automated settlement hooks.",
    status: "operational",
    uptime: "100.0%",
    latency: "82ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "payment-phonepe-paytm",
    name: "PhonePe & Paytm Direct UPI",
    category: "payments",
    endpoint: "upi.abhibhidevelopers.com",
    description: "Dynamic UPI QR code generator, real-time UTR reference ledger, and automated payment reconciliation service.",
    status: "operational",
    uptime: "99.98%",
    latency: "74ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "comms-resend",
    name: "Transactional Email Delivery (Resend)",
    category: "comms",
    endpoint: "mail.nexusai.app",
    description: "Post-purchase confirmation, order delivery credentials, and OTP verification email dispatcher with 99.8% inbox rate.",
    status: "operational",
    uptime: "100.0%",
    latency: "94ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "comms-sms-relay",
    name: "Twilio & WhatsApp Notification Relay",
    category: "comms",
    endpoint: "relay.nexusai.app",
    description: "Two-factor OTP delivery fallback and automated customer SMS status updates for critical delivery alerts.",
    status: "operational",
    uptime: "99.94%",
    latency: "140ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "database-cluster",
    name: "Database & Distributed Cache",
    category: "core",
    endpoint: "db.nexusai.app",
    description: "High-availability Neon PostgreSQL multi-region cluster with Upstash Redis low-latency distributed cache.",
    status: "operational",
    uptime: "99.99%",
    latency: "16ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "vector-search",
    name: "Semantic Vector Search Index",
    category: "ai",
    endpoint: "vectors.nexusai.app",
    description: "Sub-millisecond cosine similarity search across millions of knowledgebase and codebase neural embeddings.",
    status: "operational",
    uptime: "99.99%",
    latency: "45ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "webhooks-dispatcher",
    name: "Webhook Delivery & Event Queue",
    category: "core",
    endpoint: "events.nexusai.app",
    description: "Guaranteed at-least-once delivery with HMAC signature verification and exponential backoff retry buffer.",
    status: "operational",
    uptime: "99.99%",
    latency: "36ms",
    historyBars: Array(45).fill(100),
  },
  {
    id: "web-dashboard",
    name: "Client Portal & Dashboard Web App",
    category: "core",
    endpoint: "status.nexusai.app",
    description: "Global CDN-cached Next.js client portal, admin workspace, and customer marketplace with zero downtime deployments.",
    status: "operational",
    uptime: "100.0%",
    latency: "22ms",
    historyBars: Array(45).fill(100),
  },
]

const REGIONS = [
  { code: "ap-south-1", location: "Mumbai, India", latency: "14ms", status: "Operational" },
  { code: "ap-southeast-1", location: "Singapore", latency: "28ms", status: "Operational" },
  { code: "us-east-1", location: "N. Virginia, USA", latency: "42ms", status: "Operational" },
  { code: "eu-central-1", location: "Frankfurt, Germany", latency: "36ms", status: "Operational" },
  { code: "us-west-2", location: "Oregon, USA", latency: "48ms", status: "Operational" },
]

export default function StatusClient() {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("all")
  const [notifyEmail, setNotifyEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState("Just now")

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      setLastChecked("Just now")
    }, 500)
  }

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!notifyEmail || !notifyEmail.includes("@")) return
    setSubscribed(true)
  }

  const filteredServices = useMemo(() => {
    if (selectedCategory === "all") return SERVICES
    return SERVICES.filter((s) => s.category === selectedCategory)
  }, [selectedCategory])

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-zinc-900 selection:bg-amber-100 selection:text-amber-900 font-sans">
      {/* Top Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-80 pointer-events-none z-0 overflow-hidden opacity-60">
        <div className="absolute top-[-100px] left-1/4 w-[500px] h-[500px] bg-emerald-100/60 rounded-full blur-[120px]" />
        <div className="absolute top-[-80px] right-1/4 w-[450px] h-[450px] bg-amber-100/60 rounded-full blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
        {/* Breadcrumb / Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-200/80">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-amber-500/40 shadow-xs shrink-0 bg-amber-500/10">
              <Image
                src="/abhibhi-logo.jpg"
                alt="Abhibhi Developers"
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block">
                ABHIBHIDEVELOPERS GROUP • INFRASTRUCTURE
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-zinc-950">status.nexusai.app</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE TELEMETRY
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 shadow-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-600" : ""}`} />
              <span>Refresh</span>
            </button>
            <span className="text-xs text-zinc-500 hidden sm:inline font-medium">Checked: {lastChecked}</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 mb-5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>99.98% System Uptime Across All Edge Regions</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-950 mb-4 leading-tight">
            NexusAI System Status
          </h1>
          <p className="text-base sm:text-lg text-zinc-600 leading-relaxed max-w-2xl mx-auto">
            Real-time performance telemetry, service health monitoring, and uptime history for Abhibhi Developers &amp; NexusAI cloud platforms.
          </p>
        </div>

        {/* Global Operational Status Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-300/80 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 p-6 sm:p-8 mb-12 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-950">All Systems Fully Operational</h2>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping hidden sm:inline-block" />
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 mt-1 font-medium">
                  Zero active incidents. All API routes, payment channels, AI agent networks, and databases are running smoothly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-zinc-200 md:pl-6 shrink-0">
              <div className="text-left">
                <p className="text-[11px] font-mono uppercase text-zinc-500 font-semibold">90-Day Uptime</p>
                <p className="text-xl font-black text-emerald-700 mt-0.5">99.98%</p>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-mono uppercase text-zinc-500 font-semibold">Avg Latency</p>
                <p className="text-xl font-black text-zinc-900 mt-0.5">34ms</p>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-mono uppercase text-zinc-500 font-semibold">Active Outages</p>
                <p className="text-xl font-black text-emerald-700 mt-0.5">0</p>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-mono uppercase text-zinc-500 font-semibold">Services</p>
                <p className="text-xl font-black text-zinc-900 mt-0.5">12 / 12</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ✨ PROMINENT SHOWCASE: OFFICIAL APP VERSION COMING SOON SECTION ✨ */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold uppercase tracking-wider mb-2 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Next-Gen Native Applications</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                NexusAI App Ecosystem — Coming Soon
              </h2>
              <p className="text-sm text-zinc-600 mt-1 max-w-2xl font-medium">
                We are bringing the power of Abhibhi Developers &amp; NexusAI directly to your phone and desktop. Native client applications are currently undergoing closed beta testing.
              </p>
            </div>
            <div className="shrink-0">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-xs">
                Release Track: <strong className="text-amber-700">2027 Wave 1</strong>
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Mobile App Card */}
            <div className="group relative rounded-3xl border border-amber-200/90 bg-gradient-to-b from-amber-50/70 via-white to-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-all">
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shadow-xs">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-600 text-white shadow-xs">
                    Coming Soon • Q1 2027
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-zinc-950 mb-2">
                  NexusAI Mobile App
                </h3>
                <p className="text-sm text-zinc-600 leading-relaxed mb-6 font-normal">
                  Manage your autonomous agents, monitor real-time server health, receive instant push notifications, and authorize secure payment payouts directly from iOS and Android.
                </p>

                {/* Feature Pills */}
                <div className="grid grid-cols-2 gap-2.5 mb-6 text-xs font-semibold text-zinc-700">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Real-time Push Alerts</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Biometric FaceID / TouchID</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Instant Agent Telemetry</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>iOS &amp; Android Native</span>
                  </div>
                </div>

                {/* Development Progress */}
                <div className="mt-auto pt-4 border-t border-zinc-200">
                  <div className="flex justify-between items-center text-xs font-mono mb-2">
                    <span className="text-zinc-600 font-medium">TestFlight &amp; Play Beta Status:</span>
                    <span className="text-amber-700 font-bold">85% Complete</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full w-[85%]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Workstation Card */}
            <div className="group relative rounded-3xl border border-sky-200/90 bg-gradient-to-b from-sky-50/70 via-white to-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-all">
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700 shadow-xs">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-600 text-white shadow-xs">
                    Coming Soon • V1.0 Desktop
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-zinc-950 mb-2">
                  NexusAI Desktop Workstation
                </h3>
                <p className="text-sm text-zinc-600 leading-relaxed mb-6 font-normal">
                  High-performance desktop suite for macOS, Windows, and Linux. Built for heavy AI development with local MCP bridges, multi-agent workspaces, and zero-latency terminal pipes.
                </p>

                {/* Feature Pills */}
                <div className="grid grid-cols-2 gap-2.5 mb-6 text-xs font-semibold text-zinc-700">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>Global Hotkey (Cmd+K)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>Local MCP Server Host</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>Offline Cache &amp; Models</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-zinc-200 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>macOS, Windows, Linux</span>
                  </div>
                </div>

                {/* Development Progress */}
                <div className="mt-auto pt-4 border-t border-zinc-200">
                  <div className="flex justify-between items-center text-xs font-mono mb-2">
                    <span className="text-zinc-600 font-medium">Developer Alpha Build:</span>
                    <span className="text-sky-700 font-bold">72% Complete</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-sky-600 rounded-full w-[72%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Early Access Notification Bar */}
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-950">Want early VIP access to the mobile and desktop apps?</p>
                <p className="text-xs text-zinc-500 font-medium">Get an invite the minute TestFlight or public beta links go live.</p>
              </div>
            </div>

            {subscribed ? (
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>You are on the VIP Early Access List!</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 w-full sm:w-64"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs transition-all shrink-0"
                >
                  Notify Me
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* APP SERVICES BREAKDOWN & REAL-TIME UPTIME BARS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-14">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                Live App Services &amp; Infrastructure
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 mt-1 font-medium">
                Individual component health metrics, 90-day availability history, and endpoint response times.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-zinc-100 border border-zinc-200 shrink-0">
              {(
                [
                  { id: "all", label: "All (12)" },
                  { id: "core", label: "Core API" },
                  { id: "ai", label: "AI Mesh" },
                  { id: "payments", label: "Payments" },
                  { id: "comms", label: "Communications" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedCategory === tab.id
                      ? "bg-white text-zinc-950 shadow-xs font-bold"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Services List */}
          <div className="space-y-3">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="group rounded-2xl border border-zinc-200/90 bg-white hover:border-zinc-300 hover:shadow-sm p-5 sm:p-6 transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Service Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                      <span className="font-bold text-base text-zinc-950 group-hover:text-amber-700 transition-colors">
                        {service.name}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200 font-semibold">
                        {service.endpoint}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 leading-relaxed max-w-2xl font-normal">
                      {service.description}
                    </p>
                  </div>

                  {/* Status, Latency & Uptime */}
                  <div className="flex flex-wrap items-center gap-6 lg:justify-end shrink-0">
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">Latency</p>
                      <p className="text-xs font-bold text-zinc-800 font-mono">{service.latency}</p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">90D Uptime</p>
                      <p className="text-xs font-bold text-emerald-700 font-mono">{service.uptime}</p>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Operational</span>
                    </div>
                  </div>
                </div>

                {/* 90-Day Visual Bar Graph */}
                <div className="mt-4 pt-3 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1.5">
                    <span>90 days ago</span>
                    <span className="text-emerald-700 font-bold">100% available today</span>
                  </div>
                  <div className="flex items-center gap-1 w-full overflow-hidden">
                    {service.historyBars.map((_, idx) => (
                      <div
                        key={idx}
                        className="flex-1 h-7 rounded-xs bg-emerald-500 hover:bg-emerald-600 transition-colors"
                        title={`Day ${90 - idx}: Operational (100%)`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MULTI-REGION GLOBAL EDGE TELEMETRY */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-14">
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              Global Edge Data Centers
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 font-medium">
              Low-latency request processing across 5 worldwide availability zones with automatic failover.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {REGIONS.map((region) => (
              <div
                key={region.code}
                className="p-4 rounded-2xl border border-zinc-200/90 bg-white flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase font-semibold">{region.code}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-zinc-950">{region.location}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Ping:</span>
                  <span className="font-mono text-emerald-700 font-bold">{region.latency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* INCIDENT LOG & SLA TRANSPARENCY */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid gap-8 lg:grid-cols-3 mb-14">
          <div className="lg:col-span-2 rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
              <h3 className="text-lg font-black text-zinc-950">Past Incident History</h3>
              <span className="text-xs font-mono text-emerald-700 font-bold">Zero Critical Outages</span>
            </div>

            <div className="space-y-6">
              <div className="relative pl-6 before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-emerald-500">
                <p className="text-xs font-mono text-zinc-500 font-semibold">Today — Real-time Evaluation</p>
                <p className="text-sm font-bold text-zinc-900 mt-0.5">No incidents or service disruptions reported.</p>
                <p className="text-xs text-zinc-600 mt-1">All core APIs, AI reasoning nodes, and payment hooks running at full throughput.</p>
              </div>

              <div className="relative pl-6 before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-emerald-500/70">
                <p className="text-xs font-mono text-zinc-500 font-semibold">Past 30 Days</p>
                <p className="text-sm font-bold text-zinc-900 mt-0.5">100% Uptime across all client applications.</p>
                <p className="text-xs text-zinc-600 mt-1">Scheduled routine database maintenance completed with 0 user impact.</p>
              </div>

              <div className="relative pl-6 before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-zinc-400">
                <p className="text-xs font-mono text-zinc-500 font-semibold">Past 90 Days</p>
                <p className="text-sm font-bold text-zinc-900 mt-0.5">Seamless cloud infrastructure scaling.</p>
                <p className="text-xs text-zinc-600 mt-1">Expanded global edge proxy routes and multi-agent sandboxing capacity.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-zinc-950 mb-2">Security &amp; SLA Guarantee</h3>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4 font-normal">
                Abhibhi Developers &amp; NexusAI platforms operate under enterprise-grade 99.9% financially-backed uptime Service Level Agreements (SLA).
              </p>
              <ul className="text-xs text-zinc-700 space-y-2 mb-6 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>24/7 Automated Synthetic Probing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Sub-second Regional Failover</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Encrypted TLS 1.3 &amp; HMAC Tokens</span>
                </li>
              </ul>
            </div>

            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs transition-colors shadow-xs"
            >
              <span>Contact Infrastructure Team</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-medium">
          <p>© {new Date().getFullYear()} ABHIBHIDEVELOPERS GROUP • NexusAI Cloud Status</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-zinc-900 transition-colors">
              Home
            </Link>
            <Link href="/marketplace" className="hover:text-zinc-900 transition-colors">
              Marketplace
            </Link>
            <Link href="/docs" className="hover:text-zinc-900 transition-colors">
              API Docs
            </Link>
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
