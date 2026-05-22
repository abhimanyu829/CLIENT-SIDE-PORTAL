import React from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — NexusAI",
  description: "How NexusAI collects, uses, and protects your data.",
}

export default function PrivacyPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black mb-6">Privacy Policy</h1>
        <p className="text-zinc-500 mb-12">Last Updated: May 21, 2026</p>

        <div className="prose prose-invert max-w-none text-zinc-300">
          <h2>1. Data Collection</h2>
          <p>
            We collect information you provide directly to us, such as when you create an account, subscribe to our newsletter, or fill out a form. We also collect usage data automatically when you interact with our APIs and dashboard.
          </p>

          <h2>2. How We Use Your Data</h2>
          <p>
            We use your data to:
          </p>
          <ul>
            <li>Provide, maintain, and improve the NexusAI platform.</li>
            <li>Process transactions and send related information (invoices, receipts).</li>
            <li>Send technical notices, security alerts, and support messages.</li>
          </ul>

          <h2>3. AI Processing and Data Isolation</h2>
          <p>
            <strong>Crucial:</strong> We do not use your proprietary business data, API payloads, or agent conversation history to train our underlying foundational models. Your data is isolated and encrypted in transit and at rest.
          </p>

          <h2>4. Data Sharing</h2>
          <p>
            We do not sell your personal data. We may share data with trusted third-party vendors (e.g., Stripe for payments, AWS/GCP for hosting) solely for the purpose of operating our service. These vendors are bound by strict data processing agreements.
          </p>

          <h2>5. Your Rights</h2>
          <p>
            Depending on your location, you may have the right to request access, correction, or deletion of your personal data. See our <a href="/gdpr" className="text-purple-400">GDPR Compliance</a> page for specific European data rights.
          </p>
        </div>
      </div>
    </div>
  )
}
