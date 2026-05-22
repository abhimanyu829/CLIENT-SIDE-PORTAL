import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { StatsRow } from "@/components/public/StatsRow"
import { FAQSection } from "@/components/public/FAQSection"
import { CallToAction } from "@/components/public/CallToAction"
import { Cloud, Layers, Smartphone, LayoutDashboard, ShieldCheck, Zap } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "SaaS Tools & Infrastructure — NexusAI",
  description: "Explore our suite of cloud-native SaaS tools. Built for collaboration, CRM, analytics, and enterprise productivity powered by AI.",
  openGraph: {
    title: "SaaS Tools & Infrastructure — NexusAI",
    description: "Explore our suite of cloud-native SaaS tools.",
  }
}

export default function SaaSToolsPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="Next-Generation SaaS Ecosystem"
        description="Streamline your operations with our suite of deeply integrated, AI-powered cloud applications. From CRM to advanced analytics, everything works together."
        pillText="Cloud Software"
        ctaText="View Products"
        ctaHref="/marketplace?category=saas"
        secondaryCtaText="Contact Sales"
        secondaryCtaHref="/contact-sales"
      />

      <StatsRow stats={[
        { value: "50+", label: "Integrated SaaS Tools" },
        { value: "12M", label: "Active Users" },
        { value: "99.999%", label: "Uptime SLA" },
        { value: "SOC2", label: "Certified Secure" }
      ]} />

      <FeatureGrid 
        title="Everything Your Business Needs"
        description="Replace fragmented legacy systems with a cohesive, modern software stack."
        features={[
          { icon: Cloud, title: "Cloud-Native Infrastructure", description: "Built from the ground up for the cloud, ensuring high availability, automatic scaling, and instant updates." },
          { icon: Layers, title: "Productivity Suites", description: "Collaborative documents, spreadsheets, and project management tools that sync in real-time." },
          { icon: LayoutDashboard, title: "Unified CRM", description: "Manage your sales pipeline, customer support tickets, and marketing campaigns in one unified interface." },
          { icon: Zap, title: "AI-Powered Workflows", description: "Our SaaS tools natively integrate with NexusAI agents to automate data entry and routine tasks." },
          { icon: Smartphone, title: "Mobile Ready", description: "Manage your business on the go with our fully responsive web interfaces and native mobile apps." },
          { icon: ShieldCheck, title: "Enterprise Grade Security", description: "End-to-end encryption, regular penetration testing, and compliance with GDPR and HIPAA." }
        ]}
      />

      <FAQSection 
        title="SaaS Ecosystem FAQs"
        faqs={[
          { question: "Can I use just one tool, or do I need the whole suite?", answer: "You can purchase tools a-la-carte through the marketplace, but they are designed to integrate seamlessly if you adopt the entire suite." },
          { question: "How does pricing work?", answer: "SaaS tools are billed on a per-user, per-month basis. Enterprise customers can negotiate flat-rate site licenses." },
          { question: "Is my data locked in?", answer: "No. We believe in data ownership. You can export all your data in standard formats (CSV, JSON) at any time with one click." }
        ]}
      />

      <CallToAction 
        title="Modernize Your Tech Stack"
        description="Join the fastest growing companies building on the NexusAI SaaS ecosystem."
        ctaText="Browse SaaS Tools"
        ctaHref="/marketplace?category=saas"
      />
    </div>
  )
}
