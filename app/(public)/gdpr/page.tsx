import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FAQSection } from "@/components/public/FAQSection"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "GDPR Compliance — NexusAI",
  description: "NexusAI's commitment to European data privacy, GDPR compliance, and data subject rights.",
}

export default function GDPRPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="GDPR Compliance"
        description="We are fully committed to compliance with the General Data Protection Regulation (GDPR) for our European customers and their users."
        pillText="Data Privacy"
        align="left"
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-invert max-w-none text-zinc-300 mb-16">
          <h2>Our Commitment to Privacy</h2>
          <p>
            NexusAI was built with data privacy as a foundational principle. We act as both a Data Controller (for our direct customers' billing/account info) and a Data Processor (for the data processed by deployed AI agents). We are fully compliant with GDPR requirements in both capacities.
          </p>

          <h2>Data Processing Agreement (DPA)</h2>
          <p>
            We offer a standard Data Processing Agreement that incorporates the latest Standard Contractual Clauses (SCCs) for international data transfers. Enterprise customers can sign this DPA directly through their dashboard settings.
          </p>

          <h2>Your Data Rights</h2>
          <p>Under the GDPR, individuals have specific rights regarding their personal data. We provide tools directly in the NexusAI dashboard to fulfill these rights:</p>
          <ul>
            <li><strong>Right to Erasure (Right to be Forgotten):</strong> You can delete your account and all associated workspace data with a single click. Hard deletion is processed within 30 days.</li>
            <li><strong>Right to Portability:</strong> Export your invoices, agent configurations, and audit logs in machine-readable JSON/CSV formats at any time.</li>
            <li><strong>Right to Access:</strong> View all data we hold about your account via the Account Settings panel.</li>
          </ul>

          <h2>Subprocessors</h2>
          <p>
            We use a limited number of vetted subprocessors to provide our service (e.g., AWS, Stripe). A full, up-to-to-date list of subprocessors is available upon request and provided in our DPA.
          </p>
        </div>
      </div>

      <FAQSection 
        title="GDPR FAQs"
        faqs={[
          { question: "Where is my data hosted?", answer: "By default, data is hosted in the US (us-east-1). Enterprise customers can select EU-only data residency (e.g., eu-central-1) during onboarding." },
          { question: "How do I submit a Data Subject Access Request (DSAR)?", answer: "You can submit a DSAR by emailing privacy@nexusai.com. We respond to all requests within 30 days." },
          { question: "Do you have a Data Protection Officer (DPO)?", answer: "Yes. Our appointed DPO can be reached directly at dpo@nexusai.com." }
        ]}
      />
    </div>
  )
}
