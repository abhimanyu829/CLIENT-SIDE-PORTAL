"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import CRMTemplate from "@/components/demo/templates/CRMTemplate"
import ChatbotTemplate from "@/components/demo/templates/ChatbotTemplate"
import AnalyticsTemplate from "@/components/demo/templates/AnalyticsTemplate"

interface DemoPageProps {
  params: { sessionId: string }
}

export default function DemoPage({ params }: DemoPageProps) {
  const { sessionId } = params
  
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes demo
  const [template, setTemplate] = useState("CRM")

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  // Session Validation UI if expired
  if (timeLeft === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
        <div className="bg-background p-8 rounded-xl shadow-lg text-center space-y-6 max-w-md w-full">
          <div className="text-4xl">⏱️</div>
          <h2 className="text-2xl font-bold">Demo Session Expired</h2>
          <p className="text-muted-foreground">
            Your 5-minute interactive demo session ({sessionId}) has concluded. Subscribe to unlock full access.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/checkout" className="block w-full">
              <Button className="w-full font-bold">Subscribe Now</Button>
            </Link>
            <Link href="/marketplace" className="block w-full">
              <Button variant="outline" className="w-full">Return to Marketplace</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Bar */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-sm bg-primary text-primary-foreground px-2 py-1 rounded">LIVE DEMO</span>
          <span className="text-sm text-muted-foreground hidden sm:inline-block">ID: {sessionId}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium mr-2 hidden sm:inline-block">Template:</span>
          <select 
            value={template} 
            onChange={(e) => setTemplate(e.target.value)}
            className="text-sm border rounded p-1 bg-background"
          >
            <option value="CRM">Sales CRM</option>
            <option value="Chatbot">AI Chatbot</option>
            <option value="Analytics">Data Analytics</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-mono bg-muted px-3 py-1 rounded-md">
            <span>⏳</span>
            <span className={timeLeft < 60 ? "text-destructive font-bold" : ""}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <Link href="/marketplace">
            <Button variant="ghost" size="sm">Exit</Button>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {template === "CRM" && <CRMTemplate />}
        {template === "Chatbot" && <ChatbotTemplate />}
        {template === "Analytics" && <AnalyticsTemplate />}
      </main>
    </div>
  )
}
