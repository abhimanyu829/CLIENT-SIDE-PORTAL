import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { StatsRow } from "@/components/public/StatsRow"
import { FAQSection } from "@/components/public/FAQSection"
import { CallToAction } from "@/components/public/CallToAction"
import { ShieldCheck, Server, UserCheck, Headset, Lock, Activity } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Enterprise Solutions & Architecture — NexusAI",
  description: "Secure, scalable, and compliant AI solutions for large organizations. Get dedicated support, custom SLAs, and advanced security.",
  openGraph: {
    title: "Enterprise Solutions & Architecture — NexusAI",
    description: "Secure, scalable, and compliant AI solutions for large organizations.",
  }
}

export default function EnterprisePage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title={<>Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">Enterprise Scale</span></>}
        description="Deploy NexusAI across your organization with advanced security, compliance, dedicated infrastructure, and 24/7 priority support."
        pillText="NexusAI Enterprise"
        ctaText="Contact Sales"
        ctaHref="/contact-sales"
        secondaryCtaText="Download Whitepaper"
        secondaryCtaHref="/security"
      />

      <StatsRow stats={[
        { value: "Fortune 500", label: "Trusted By" },
        { value: "SOC2 Type II", label: "Compliance" },
        { value: "100%", label: "Data Isolation" },
        { value: "24/7/365", label: "Priority Support" }
      ]} />

      <FeatureGrid 
        title="Enterprise-Grade Capabilities"
        description="We meet the strictest IT, security, and procurement requirements out of the box."
        features={[
          { icon: ShieldCheck, title: "Advanced Security & Compliance", description: "SOC2 Type II, ISO 27001, HIPAA, and GDPR compliant. Regular third-party penetration testing." },
          { icon: Server, title: "Dedicated Deployments", description: "Optionally deploy NexusAI in your own VPC (AWS, GCP, Azure) or on dedicated single-tenant hardware." },
          { icon: UserCheck, title: "SSO & SAML", description: "Integrate seamlessly with Okta, Azure AD, and Google Workspace for centralized access and lifecycle management." },
          { icon: Lock, title: "Data Governance & Audit", description: "Comprehensive immutable audit logs for every action, model query, and data export across your organization." },
          { icon: Activity, title: "Custom SLAs", description: "Financially backed 99.99% uptime guarantees with tailored support response times." },
          { icon: Headset, title: "Dedicated Success Manager", description: "Get a dedicated Technical Account Manager (TAM) to help architect workflows and train your team." }
        ]}
      />

      <FAQSection 
        title="Enterprise FAQs"
        faqs={[
          { question: "Do you train your AI on enterprise data?", answer: "No. Enterprise customer data is strictly isolated and never used to train our foundational models. Your IP remains yours." },
          { question: "Can we self-host NexusAI?", answer: "Yes, we offer on-premise and private cloud deployment options for Enterprise tiers with specific regulatory requirements." },
          { question: "How does enterprise billing work?", answer: "Enterprise contracts are billed annually with custom volume discounts, consolidated invoicing, and PO support." }
        ]}
      />

      <CallToAction 
        title="Ready to transform your organization?"
        description="Speak with our solutions team to discuss your custom architecture and security requirements."
        ctaText="Contact Sales"
        ctaHref="/contact-sales"
      />
    </div>
  )
}
