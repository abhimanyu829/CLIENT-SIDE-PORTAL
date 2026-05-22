import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { CallToAction } from "@/components/public/CallToAction"
import { Network, Handshake, Gem, Zap, Shield, ArrowRight } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Partnerships — NexusAI",
  description: "Join the NexusAI Partner Network. Cloud providers, technology partners, and solution integrators.",
}

export default function PartnersPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="NexusAI Partner Network"
        description="Accelerate your customers' AI adoption by partnering with the leading AI orchestration platform."
        pillText="Ecosystem Partners"
        ctaText="Apply to Partner"
        ctaHref="/contact-sales"
      />

      <FeatureGrid 
        title="Why Partner with Us?"
        features={[
          { icon: Gem, title: "Revenue Share", description: "Earn generous recurring commissions on every customer you bring to the NexusAI enterprise platform." },
          { icon: Handshake, title: "Co-Marketing", description: "Collaborate on webinars, case studies, and joint go-to-market motions to expand your reach." },
          { icon: Zap, title: "Technical Enablement", description: "Get dedicated solution architects and early access to our roadmap to build deep integrations." },
          { icon: Shield, title: "Partner Portal", description: "Access training, deal registration, and sales collateral through our dedicated partner portal." },
          { icon: Network, title: "Global Reach", description: "Join a network of global system integrators and consultancies deploying cutting-edge AI." },
          { icon: ArrowRight, title: "Fast-Track Support", description: "Your clients receive priority escalation paths and dedicated slack channels for rapid issue resolution." }
        ]}
      />

      <section className="py-24 px-6 border-t border-white/5 bg-black">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-16">Partner Programs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 text-left">
              <h3 className="text-xl font-bold mb-4">Technology Partners</h3>
              <p className="text-zinc-400 text-sm mb-6">For ISVs and SaaS companies looking to natively integrate their software into the NexusAI Marketplace.</p>
              <ul className="space-y-2 text-sm text-zinc-300 mb-8">
                <li>✓ API early access</li>
                <li>✓ Co-marketing opportunities</li>
                <li>✓ App directory listing</li>
              </ul>
            </div>
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-purple-500/30 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded">POPULAR</span>
              </div>
              <h3 className="text-xl font-bold mb-4">Solution Integrators</h3>
              <p className="text-zinc-400 text-sm mb-6">For agencies and consultancies building custom AI workflows and deploying agents for their clients.</p>
              <ul className="space-y-2 text-sm text-zinc-300 mb-8">
                <li>✓ 20% recurring revenue share</li>
                <li>✓ Dedicated Partner Manager</li>
                <li>✓ Sandbox environments</li>
              </ul>
            </div>
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 text-left">
              <h3 className="text-xl font-bold mb-4">Cloud Providers</h3>
              <p className="text-zinc-400 text-sm mb-6">For infrastructure providers looking to offer NexusAI as a managed service within their VPCs.</p>
              <ul className="space-y-2 text-sm text-zinc-300 mb-8">
                <li>✓ Custom licensing models</li>
                <li>✓ Architecture support</li>
                <li>✓ Joint PR announcements</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <CallToAction 
        title="Become a Partner"
        description="Fill out our partner inquiry form and our team will be in touch within 24 hours."
        ctaText="Submit Inquiry"
        ctaHref="/contact-sales"
      />
    </div>
  )
}
