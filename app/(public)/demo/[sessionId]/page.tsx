"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import CRMTemplate from "@/components/demo/templates/CRMTemplate"
import ChatbotTemplate from "@/components/demo/templates/ChatbotTemplate"
import AnalyticsTemplate from "@/components/demo/templates/AnalyticsTemplate"

interface DemoPageProps {
  params: Promise<{ sessionId: string }>
}

const TEMPLATE_MAP: Record<string, { label: string; icon: string; component: React.ComponentType }> = {
  CRM:       { label: "Sales CRM",    icon: "🏢", component: CRMTemplate },
  "ai-agent":{ label: "AI Chatbot",   icon: "🤖", component: ChatbotTemplate },
  analytics: { label: "Analytics",    icon: "📊", component: AnalyticsTemplate },
  crm:       { label: "Sales CRM",    icon: "🏢", component: CRMTemplate },
}

export default function DemoPage({ params }: DemoPageProps) {
  const { sessionId } = use(params)

  const [timeLeft, setTimeLeft] = useState(300)
  const [template, setTemplate] = useState<string>(() => {
    // derive template from sessionId slug if possible
    const k = sessionId.toLowerCase()
    return Object.keys(TEMPLATE_MAP).find(t => k.includes(t)) ?? "CRM"
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([
    "● Session initialized",
    "● Sandbox environment ready",
    "● AI model connected",
    "● Waiting for input...",
  ])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Simulate log updates
  useEffect(() => {
    const logs = [
      "● Processing user request...",
      "● AI response generated",
      "● Data synced to sandbox",
      "● Memory updated",
      "● Session heartbeat OK",
    ]
    let i = 0
    const interval = setInterval(() => {
      setLogLines(prev => [...prev.slice(-6), logs[i % logs.length]])
      i++
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const TemplateComponent = TEMPLATE_MAP[template]?.component ?? CRMTemplate
  const urgentTime = timeLeft < 60
  const expired = timeLeft === 0

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .btn-gradient { background: linear-gradient(135deg,#6366f1,#8b5cf6); }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .blink { animation: blink 1s ease-in-out infinite; }
        @keyframes urgent { 0%,100%{border-color:rgba(239,68,68,0.6)} 50%{border-color:rgba(239,68,68,0.2)} }
        .urgent { animation: urgent 1s ease-in-out infinite; }
        .terminal { font-family: 'Courier New', monospace; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
      `}</style>

      {/* ── TOP BAR ──────────────────────────────────────────────────── */}
      <header className="glass border-b border-white/5 px-4 py-2.5 flex items-center gap-4 shrink-0 z-30">
        {/* Logo */}
        <Link href="/demo" className="flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white transition-colors shrink-0">
          <span className="text-lg">⬡</span>
          <span className="hidden sm:inline">NexusAI</span>
          <span className="text-zinc-600 text-xs font-normal">/ Demo</span>
        </Link>

        <div className="h-4 w-px bg-white/10" />

        {/* Template switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {Object.entries(TEMPLATE_MAP).filter(([k])=>!["crm"].includes(k)).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setTemplate(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                template === key
                  ? "bg-purple-600/30 border border-purple-500/50 text-purple-200"
                  : "glass text-zinc-500 hover:text-zinc-300 hover:border-white/20"
              }`}
            >
              <span>{val.icon}</span>
              <span>{val.label}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Session ID */}
          <span className="hidden md:inline text-xs text-zinc-700 terminal">
            session:{sessionId.slice(0, 8)}
          </span>

          {/* Timer */}
          <div className={`glass flex items-center gap-2 px-3 py-1.5 rounded-lg ${urgentTime ? "border-red-500/50 urgent" : ""}`}>
            <span className={`w-2 h-2 rounded-full ${expired ? "bg-red-500" : urgentTime ? "bg-red-400 blink" : "bg-green-400 blink"}`} />
            <span className={`text-sm font-mono font-bold ${expired ? "text-red-400" : urgentTime ? "text-red-400" : "text-white"}`}>
              {expired ? "EXPIRED" : formatTime(timeLeft)}
            </span>
          </div>

          {/* Upgrade */}
          <Link href="/register">
            <button className="btn-gradient px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:scale-105 transition-all">
              Upgrade →
            </button>
          </Link>

          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="glass w-8 h-8 rounded-lg flex items-center justify-center text-xs text-zinc-500 hover:text-zinc-300 transition-all"
          >
            ⊟
          </button>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside className={`${sidebarOpen ? "w-64" : "w-0"} glass border-r border-white/5 transition-all duration-300 overflow-hidden shrink-0 z-20`}>
          <div className="w-64 h-full flex flex-col">
            <div className="p-4 border-b border-white/5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-3">Quick Actions</p>
              <div className="space-y-2">
                {["↺ Restart sandbox","⬇ Export data","🔗 Share session","📋 View logs"].map(action => (
                  <button key={action} className="w-full glass rounded-lg px-3 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-all text-left">
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Session info */}
            <div className="p-4 border-b border-white/5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-3">Session Info</p>
              <div className="space-y-2 text-xs">
                {[["Environment","Isolated Sandbox"],["Runtime","Node.js 20 + Edge"],["AI Model","GPT-4 Turbo"],["Storage","Ephemeral"],["Region","ap-south-1"]].map(([k,v])=>(
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-zinc-600">{k}</span>
                    <span className="text-zinc-400 font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal log */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-3">Logs</p>
              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1">
                {logLines.map((line, i) => (
                  <p key={i} className={`text-xs terminal ${i === logLines.length - 1 ? "text-green-400" : "text-zinc-600"}`}>
                    {line}
                  </p>
                ))}
                <p className="text-xs terminal text-zinc-700 flex items-center gap-1">
                  <span className="blink">▊</span>
                </p>
              </div>
            </div>

            {/* Upgrade prompt */}
            <div className="p-4 border-t border-white/5">
              <div className="glass rounded-xl p-3 text-center">
                <p className="text-xs text-zinc-500 mb-2">Unlock unlimited sessions</p>
                <Link href="/register">
                  <button className="w-full btn-gradient py-2 rounded-lg text-xs font-bold text-white">
                    Start Free →
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto relative">
          {expired ? (
            /* Expired screen */
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-6">⏰</div>
                <h2 className="text-3xl font-black mb-3">Demo session ended</h2>
                <p className="text-zinc-400 mb-8">Your 5-minute demo has expired. Sign up to get unlimited access with no time limits.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/register">
                    <button className="btn-gradient px-8 py-3 rounded-xl font-bold text-white hover:scale-105 transition-all">
                      Start Free — No limits
                    </button>
                  </Link>
                  <Link href="/demo">
                    <button className="glass px-8 py-3 rounded-xl font-bold text-white hover:border-purple-500/50 transition-all">
                      Try Again
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Live template */
            <div className="h-full">
              <TemplateComponent />
            </div>
          )}
        </main>

        {/* ── STATUS BAR ────────────────────────────────────────────── */}
        {!expired && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
            {/* AI status */}
            <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full blink" />
              <span className="text-zinc-400">AI Active</span>
            </div>
            {/* Upgrade floating */}
            {timeLeft < 120 && (
              <Link href="/register">
                <div className="glass rounded-xl px-4 py-2.5 text-xs font-bold text-white border-purple-500/50 cursor-pointer hover:bg-purple-900/20 transition-all text-center">
                  ⚡ Get unlimited access
                </div>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM STATUS BAR ────────────────────────────────────────── */}
      <footer className="glass border-t border-white/5 px-4 py-1.5 flex items-center gap-4 text-xs text-zinc-700 shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 blink" />
          Connected
        </span>
        <span className="terminal">sandbox:{sessionId.slice(0,12)}</span>
        <span className="ml-auto">NexusAI Demo Platform · <Link href="/register" className="text-purple-400 hover:underline">Sign up free</Link></span>
      </footer>
    </div>
  )
}
