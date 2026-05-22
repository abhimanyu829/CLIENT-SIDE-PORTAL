import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { StatsRow } from "@/components/public/StatsRow"
import { CallToAction } from "@/components/public/CallToAction"
import { Globe, Users, Target, Code, Heart, Zap, Shield } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us — NexusAI",
  description: "Learn about NexusAI's mission, our team, and our vision for the future of AI software.",
}

export default function AboutPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title={<>Our Mission is to <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">Democratize AI</span></>}
        description="We believe that the future of software isn't just written by humans. Our goal is to build the infrastructure that allows anyone to deploy autonomous AI agents effortlessly."
        pillText="About NexusAI"
      />

      <StatsRow stats={[
        { value: "2024", label: "Founded" },
        { value: "Series B", label: "Funding" },
        { value: "85+", label: "Employees" },
        { value: "Remote", label: "HQ" }
      ]} />

      {/* Founder Story Section */}
      <section className="py-24 px-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">The NexusAI Story</h2>
            <p className="text-zinc-400">How we started and where we are going.</p>
          </div>
          <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed text-lg">
            <p>
              In early 2024, our founders recognized a widening gap in the AI industry. While large language models were becoming incredibly powerful, the infrastructure required to securely deploy them in enterprise environments was lagging far behind.
            </p>
            <p>
              Building a custom AI agent required piecing together disparate tools for authentication, billing, vector databases, and model routing. It was a DevOps nightmare.
            </p>
            <p>
              <strong>NexusAI was born from a simple idea:</strong> What if there was a unified operating system for AI? A single platform where developers could build, host, and monetize intelligent agents, and where businesses could discover and deploy them with one click.
            </p>
          </div>
        </div>
      </section>

      <FeatureGrid 
        title="Our Core Values"
        features={[
          { icon: Users, title: "Customer Obsession", description: "We build what our users actually need, prioritizing real-world utility over hype." },
          { icon: Shield, title: "Security First", description: "AI is powerful. We believe in strict data governance, isolation, and responsible AI deployment." },
          { icon: Code, title: "Developer Experience", description: "We sweat the small stuff. Our APIs, SDKs, and docs are crafted with love for developers." },
          { icon: Globe, title: "Global & Remote", description: "We hire the best talent regardless of geography, fostering a diverse and async-first culture." },
          { icon: Heart, title: "Open Source Ecosystem", description: "We actively contribute to and sponsor open-source projects that push the AI boundary forward." },
          { icon: Zap, title: "Move Fast", description: "The AI landscape shifts weekly. We iterate rapidly to ensure our customers always have the cutting edge." }
        ]}
      />

      <CallToAction 
        title="Join our journey"
        description="We are actively hiring engineers, researchers, and designers."
        ctaText="View Open Positions"
        ctaHref="/careers"
      />
    </div>
  )
}
