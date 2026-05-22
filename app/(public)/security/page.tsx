import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { CallToAction } from "@/components/public/CallToAction"
import { Shield, Lock, Key, Server, Eye, FileCheck } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Security — NexusAI",
  description: "Enterprise-grade security, encryption, and compliance architecture at NexusAI.",
}

export default function SecurityPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="Enterprise-Grade Security"
        description="Security isn't an afterthought; it's the foundation of the NexusAI platform. We protect your data, your models, and your customers."
        pillText="Trust Center"
        ctaText="Download SOC2 Report"
        ctaHref="#"
      />

      <FeatureGrid 
        title="Security Architecture"
        features={[
          { icon: Lock, title: "End-to-End Encryption", description: "All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption." },
          { icon: Key, title: "Secret Management", description: "API keys and OAuth tokens are stored in hardware security modules (HSMs) and never logged in plain text." },
          { icon: Shield, title: "Penetration Testing", description: "We conduct biannual white-box penetration tests via independent, CREST-certified security firms." },
          { icon: Server, title: "Network Isolation", description: "Customer workloads run in logically isolated VPCs. Enterprise tiers support dedicated single-tenant clusters." },
          { icon: Eye, title: "Audit Logging", description: "Immutable audit logs track every API call, login attempt, and configuration change for compliance auditing." },
          { icon: FileCheck, title: "Compliance", description: "NexusAI is SOC2 Type II, ISO 27001, and HIPAA compliant. We maintain strict internal access controls." }
        ]}
      />

      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 md:p-12">
          <h2 className="text-2xl font-bold mb-6">Responsible AI & Model Safety</h2>
          <div className="prose prose-invert text-zinc-300">
            <p>
              Deploying AI at scale introduces unique security challenges. NexusAI implements a multi-layered defense system for AI operations:
            </p>
            <ul>
              <li><strong>Prompt Injection Defense:</strong> Built-in sanitization layers detect and block prompt injection attacks before they reach the LLM.</li>
              <li><strong>PII Redaction:</strong> Optional middleware automatically masks Personally Identifiable Information (PII) before it is sent to third-party model providers (like OpenAI).</li>
              <li><strong>Zero Data Training:</strong> We enforce strict agreements with our model partners that customer data transmitted via NexusAI APIs is <strong>never</strong> used to train their foundational models.</li>
            </ul>
          </div>
        </div>
      </div>

      <CallToAction 
        title="Security Questionnaire?"
        description="Our team is happy to complete your vendor security assessment."
        ctaText="Contact Security Team"
        ctaHref="mailto:security@nexusai.com"
      />
    </div>
  )
}
