import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { CallToAction } from "@/components/public/CallToAction"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "System Status — NexusAI",
  description: "Real-time system status and uptime history for NexusAI APIs, Agents, and Webhooks.",
}

const SERVICES = [
  { name: "Global API Gateway", status: "operational", uptime: "99.99%" },
  { name: "Agent Orchestrator", status: "operational", uptime: "99.98%" },
  { name: "Webhook Delivery", status: "operational", uptime: "100%" },
  { name: "Database Clusters", status: "operational", uptime: "99.99%" },
  { name: "LLM Inference (GPT-4)", status: "degraded", uptime: "98.5%" },
  { name: "LLM Inference (Claude)", status: "operational", uptime: "99.9%" },
]

export default function StatusPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="System Status"
        description="Real-time status for all NexusAI services and infrastructure components."
        pillText="All Systems Operational"
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Overall Status Banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 mb-12 flex items-center gap-4">
          <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-emerald-400">All Core Systems Operational</h2>
            <p className="text-sm text-emerald-500/80 mt-1">Last updated just now</p>
          </div>
        </div>

        {/* Services List */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden mb-16">
          <div className="p-4 bg-black/50 border-b border-white/10 flex justify-between text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span>Service</span>
            <span>Status / Uptime</span>
          </div>
          <div className="divide-y divide-white/5">
            {SERVICES.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-5">
                <span className="font-medium">{s.name}</span>
                <div className="flex items-center gap-6">
                  <span className="text-sm font-mono text-zinc-500 hidden sm:block">{s.uptime}</span>
                  <div className="flex items-center gap-2">
                    {s.status === "operational" ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-sm font-medium text-emerald-400">Operational</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-sm font-medium text-amber-400">Degraded Performance</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CallToAction 
        title="Get real-time updates"
        description="Subscribe to incident updates and get notified via email or SMS when an issue is detected."
        ctaText="Subscribe to Updates"
        ctaHref="#"
      />
    </div>
  )
}
