import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { StatsRow } from "@/components/public/StatsRow"
import { FAQSection } from "@/components/public/FAQSection"
import { CallToAction } from "@/components/public/CallToAction"
import { Code, Terminal, Key, Activity, RefreshCw, Cpu } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "API Products & Developer Tools — NexusAI",
  description: "Build powerful applications using our REST and GraphQL APIs. Access AI models, billing, and infrastructure with low latency.",
  openGraph: {
    title: "API Products & Developer Tools — NexusAI",
    description: "Build powerful applications using our REST and GraphQL APIs.",
  }
}

export default function ApiProductsPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="Developer-First APIs"
        description="Integrate NexusAI's powerful orchestration, AI models, and billing infrastructure directly into your own applications with our robust REST APIs and SDKs."
        pillText="For Developers"
        ctaText="Read the Docs"
        ctaHref="/api-reference"
        secondaryCtaText="Get API Key"
        secondaryCtaHref="/dashboard/settings"
      />

      <StatsRow stats={[
        { value: "2B+", label: "API Calls Monthly" },
        { value: "12ms", label: "Avg Latency" },
        { value: "7", label: "Official SDKs" },
        { value: "99.99%", label: "API Uptime" }
      ]} />

      <FeatureGrid 
        title="Built for Scale and Speed"
        description="Everything you need to build production-ready applications."
        features={[
          { icon: Code, title: "REST & GraphQL", description: "Flexible API interfaces to suit your architectural preferences. Fully documented with OpenAPI specs." },
          { icon: Terminal, title: "Official SDKs", description: "First-party SDKs for Node.js, Python, Go, Ruby, Java, PHP, and Rust to get you started in minutes." },
          { icon: Key, title: "Secure Authentication", description: "Granular scoped API keys, OAuth2 for integrations, and IP whitelisting for enterprise security." },
          { icon: Activity, title: "Real-time Analytics", description: "Monitor your API usage, error rates, and latency in real-time through the developer dashboard." },
          { icon: RefreshCw, title: "Webhooks", description: "Receive real-time HTTP pushes for asynchronous events like payment successes, agent completions, or data syncs." },
          { icon: Cpu, title: "Edge Routing", description: "Global edge network automatically routes your API requests to the closest geographic datacenter for minimal latency." }
        ]}
      />

      <FAQSection 
        title="Developer FAQs"
        faqs={[
          { question: "What are the API rate limits?", answer: "Free tier allows 100 requests/minute. Pro tier allows 1,000 req/min. Enterprise plans offer custom unmetered limits." },
          { question: "Do you provide testing environments?", answer: "Yes, every account comes with a sandbox environment and test API keys that don't incur charges." },
          { question: "Is the API versioned?", answer: "Yes. We use date-based versioning (e.g., v2024-01-01) to ensure backwards compatibility. We provide at least 12 months notice before retiring old versions." }
        ]}
      />

      <CallToAction 
        title="Start Building Today"
        description="Read our comprehensive documentation and make your first API call."
        ctaText="View API Reference"
        ctaHref="/api-reference"
      />
    </div>
  )
}
