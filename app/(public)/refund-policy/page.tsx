import React from "react"
import { Metadata } from "next"
import { CallToAction } from "@/components/public/CallToAction"

export const metadata: Metadata = {
  title: "Refund Policy — NexusAI",
  description: "Information regarding subscription refunds, API billing disputes, and cancellations.",
}

export default function RefundPolicyPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black mb-6">Refund Policy</h1>
        <p className="text-zinc-500 mb-12">Last Updated: May 21, 2026</p>

        <div className="prose prose-invert max-w-none text-zinc-300 mb-24">
          <h2>1. Platform Subscriptions</h2>
          <p>
            We stand behind the quality of the NexusAI platform. We offer a <strong>14-day money-back guarantee</strong> for all new platform subscriptions (Pro tier). If you are not satisfied with the service within the first 14 days of your initial purchase, contact support for a full refund.
          </p>

          <h2>2. API Usage & Pay-As-You-Go Billing</h2>
          <p>
            API usage and token consumption (e.g., LLM inference costs) are billed in arrears based on actual usage. Because these involve hard computational costs paid to underlying providers, <strong>API usage charges are strictly non-refundable</strong>.
          </p>
          <p>
            To prevent unexpected charges, we strongly recommend utilizing the Spend Limits feature in your dashboard settings.
          </p>

          <h2>3. Marketplace Purchases (Third-Party Agents)</h2>
          <p>
            When you purchase a subscription to a third-party AI agent or SaaS tool from the NexusAI Marketplace, you are subject to that specific creator's refund policy. By default, NexusAI enforces a 7-day refund window for marketplace purchases to protect buyers from defective software.
          </p>

          <h2>4. Cancellations</h2>
          <p>
            You may cancel your subscription at any time through the Billing section of your dashboard. Cancellation takes effect at the end of your current paid billing cycle. You will not receive a prorated refund for the remainder of the billing cycle, but you will retain access to the platform until the cycle ends.
          </p>

          <h2>5. How to Request a Refund</h2>
          <p>
            To request a refund under the 14-day guarantee, please open a support ticket in your dashboard or email billing@nexusai.com with your account email and reason for cancellation.
          </p>
        </div>
      </div>

      <CallToAction 
        title="Need help with billing?"
        description="Our support team is ready to assist you with any billing inquiries."
        ctaText="Contact Billing Support"
        ctaHref="mailto:billing@nexusai.com"
      />
    </div>
  )
}
