import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { CallToAction } from "@/components/public/CallToAction"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Live Demos — NexusAI",
  description: "Experience the power of NexusAI firsthand. Interactive sandboxes, workflow simulations, and live AI agent previews.",
}

const DEMOS = [
  { id: 1, title: "Autonomous Sales SDR", category: "AI Agents", color: "from-blue-500 to-cyan-400" },
  { id: 2, title: "Customer Support Triage", category: "Workflow", color: "from-purple-500 to-pink-500" },
  { id: 3, title: "Financial Data Extractor", category: "AI SaaS", color: "from-emerald-500 to-teal-400" },
  { id: 4, title: "Multi-Agent Research Swarm", category: "Enterprise", color: "from-orange-500 to-red-500" },
]

export default function LiveDemosPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="Interactive Playgrounds"
        description="Don't just read about our capabilities—experience them. Try out our live sandboxes simulating real enterprise environments."
        pillText="Live Demos"
        ctaText="Request Custom Demo"
        ctaHref="/contact-sales"
      />

      <div className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {DEMOS.map(demo => (
            <div key={demo.id} className="group relative rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden hover:border-white/20 transition-all cursor-pointer">
              <div className={`h-48 bg-gradient-to-br ${demo.color} opacity-20 group-hover:opacity-30 transition-opacity`} />
              <div className="absolute inset-0 flex flex-col justify-end p-8 bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{demo.category}</span>
                <h3 className="text-2xl font-bold text-white mb-4">{demo.title}</h3>
                <div className="flex gap-4">
                  <button className="px-6 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-zinc-200 transition-colors">
                    Launch Sandbox
                  </button>
                  <button className="px-6 py-2 bg-white/10 text-white text-sm font-bold rounded-lg hover:bg-white/20 transition-colors">
                    View Source
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CallToAction 
        title="Ready to build your own?"
        description="Sign up for free and get $50 in credits to start experimenting immediately."
        ctaText="Create Free Account"
        ctaHref="/register"
      />
    </div>
  )
}
