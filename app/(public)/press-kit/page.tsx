import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { CallToAction } from "@/components/public/CallToAction"
import { Download, Image as ImageIcon, FileText } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Press Kit — NexusAI",
  description: "Download official NexusAI brand assets, logos, and product screenshots for media and press.",
}

export default function PressKitPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="Press & Media Kit"
        description="Everything you need to write about NexusAI. Logos, brand guidelines, executive bios, and product screenshots."
        pillText="Brand Assets"
        ctaText="Download Full Kit (ZIP)"
        ctaHref="#"
      />

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors cursor-pointer">
            <ImageIcon className="w-8 h-8 mx-auto mb-4 text-purple-400" />
            <h3 className="font-bold mb-2">Logos & Icons</h3>
            <p className="text-sm text-zinc-400 mb-4">SVG and high-res PNG formats of our primary and secondary logos.</p>
            <span className="text-purple-400 text-sm font-bold flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Download
            </span>
          </div>
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors cursor-pointer">
            <FileText className="w-8 h-8 mx-auto mb-4 text-blue-400" />
            <h3 className="font-bold mb-2">Brand Guidelines</h3>
            <p className="text-sm text-zinc-400 mb-4">Colors, typography, and rules for using the NexusAI brand.</p>
            <span className="text-blue-400 text-sm font-bold flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </span>
          </div>
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 text-center hover:bg-white/[0.04] transition-colors cursor-pointer">
            <ImageIcon className="w-8 h-8 mx-auto mb-4 text-emerald-400" />
            <h3 className="font-bold mb-2">Product Screens</h3>
            <p className="text-sm text-zinc-400 mb-4">High-resolution mockups of the dashboard and marketplace.</p>
            <span className="text-emerald-400 text-sm font-bold flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Download
            </span>
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          <h2>Company Overview</h2>
          <p>
            <strong>NexusAI</strong> (nexusai.com) is the operating system for the AI-native enterprise. Founded in 2024, the platform 
            provides the critical infrastructure layer required for businesses to build, deploy, and scale autonomous AI agents securely. 
            NexusAI's marketplace features over 500+ production-ready AI tools, serving millions of API requests daily for Fortune 500 
            companies and hyper-growth startups alike.
          </p>
          <p>
            For all press inquiries, please email: <a href="mailto:press@nexusai.com" className="text-purple-400">press@nexusai.com</a>
          </p>
        </div>
      </div>

      <CallToAction 
        title="Need an interview?"
        description="Our founders and executives are available for podcasts, panels, and interviews regarding the future of AI."
        ctaText="Contact PR Team"
        ctaHref="mailto:press@nexusai.com"
      />
    </div>
  )
}
