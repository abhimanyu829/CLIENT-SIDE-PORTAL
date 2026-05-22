import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { StatsRow } from "@/components/public/StatsRow"
import { FAQSection } from "@/components/public/FAQSection"
import { CallToAction } from "@/components/public/CallToAction"
import { BookOpen, Code2, Terminal, Zap, Puzzle, Blocks } from "lucide-react"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Documentation — NexusAI",
  description: "Learn how to build, deploy, and scale with the NexusAI platform. Access guides, tutorials, and integration docs.",
}

export default function DocsPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="NexusAI Documentation"
        description="Everything you need to build, deploy, and scale your AI workflows. From quickstarts to advanced enterprise configurations."
        pillText="v2.0 Documentation"
        align="left"
      />

      <div className="max-w-7xl mx-auto px-6 pb-24 border-b border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="hidden md:block col-span-1 border-r border-white/10 pr-6">
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Getting Started</h3>
            <ul className="space-y-3 text-sm text-zinc-400 mb-8">
              <li><a href="#" className="hover:text-purple-400">Quickstart Guide</a></li>
              <li><a href="#" className="hover:text-purple-400">Authentication</a></li>
              <li><a href="#" className="hover:text-purple-400">Dashboard Overview</a></li>
            </ul>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">AI Agents</h3>
            <ul className="space-y-3 text-sm text-zinc-400 mb-8">
              <li><a href="#" className="hover:text-purple-400">Deploying Agents</a></li>
              <li><a href="#" className="hover:text-purple-400">Building Custom Agents</a></li>
              <li><a href="#" className="hover:text-purple-400">Monetizing Agents</a></li>
            </ul>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Integrations</h3>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li><a href="#" className="hover:text-purple-400">Webhooks</a></li>
              <li><a href="#" className="hover:text-purple-400">Stripe Billing</a></li>
              <li><a href="#" className="hover:text-purple-400">Slack & Teams</a></li>
            </ul>
          </div>

          {/* Main Content Area */}
          <div className="col-span-1 md:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-purple-500/50 transition-colors cursor-pointer">
                <Terminal className="w-8 h-8 text-purple-400 mb-4" />
                <h4 className="font-bold mb-2">Quickstart</h4>
                <p className="text-sm text-zinc-400">Get up and running with your first AI agent in under 5 minutes.</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-blue-500/50 transition-colors cursor-pointer">
                <Code2 className="w-8 h-8 text-blue-400 mb-4" />
                <h4 className="font-bold mb-2">API Reference</h4>
                <p className="text-sm text-zinc-400">Explore our REST endpoints, request parameters, and response schemas.</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-green-500/50 transition-colors cursor-pointer">
                <Blocks className="w-8 h-8 text-green-400 mb-4" />
                <h4 className="font-bold mb-2">SDKs</h4>
                <p className="text-sm text-zinc-400">Official libraries for Node.js, Python, Go, and more.</p>
              </div>
            </div>

            <div className="prose prose-invert max-w-none">
              <h2>Introduction to NexusAI</h2>
              <p>
                NexusAI is the operating system for the AI-native enterprise. We provide a unified infrastructure layer for deploying AI agents, 
                automating workflows, and monetizing AI applications through our global marketplace.
              </p>
              <div className="bg-black border border-white/10 rounded-xl p-4 my-6">
                <pre className="text-sm text-purple-300"><code>npm install @nexusai/sdk</code></pre>
              </div>
              <h3>Core Concepts</h3>
              <p>
                Before diving into the code, it's helpful to understand the core primitives that make up the NexusAI ecosystem:
              </p>
              <ul>
                <li><strong>Agents:</strong> Autonomous AI models that can execute workflows.</li>
                <li><strong>Tools:</strong> SaaS products or APIs that Agents can invoke.</li>
                <li><strong>Workflows:</strong> Multi-step automations triggered by events.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <FeatureGrid 
        title="Explore by Topic"
        features={[
          { icon: BookOpen, title: "Platform Guides", description: "Step-by-step tutorials for using the NexusAI dashboard and features." },
          { icon: Zap, title: "Performance Tuning", description: "Learn how to optimize your AI prompts and workflows for speed." },
          { icon: Puzzle, title: "Integration Ecosystem", description: "Connect your existing software stack using our 100+ native integrations." }
        ]}
      />

      <CallToAction 
        title="Can't find what you're looking for?"
        description="Our enterprise support team is available 24/7 to help you architect your solution."
        ctaText="Contact Support"
        ctaHref="/contact-sales"
      />
    </div>
  )
}
