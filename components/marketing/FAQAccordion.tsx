"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const faqs = [
  {
    q: "What is OpenClaude?",
    a: "OpenClaude is an AI-powered SaaS marketplace that lets you deploy production-ready AI agents, CRM tools, and automation workflows in minutes — no infrastructure required.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. You can explore the marketplace and run live demos completely free. A card is only required when you subscribe to a paid tier.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Absolutely. You can cancel at any time from your billing dashboard. Your access continues until the end of the current billing period.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit/debit cards via Stripe, and UPI / net banking via Razorpay for Indian customers.",
  },
  {
    q: "How does the AI agent marketplace work?",
    a: "Browse pre-built agents, launch an interactive demo, choose a pricing tier, and deploy with one click. Each agent includes an API endpoint, configurable parameters, and usage analytics.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We never train models on your data and comply with GDPR.",
  },
  {
    q: "Do you offer custom enterprise plans?",
    a: "Yes. Contact us at sales@openclaude.com for volume pricing, dedicated infrastructure, and SLA guarantees.",
  },
]

export default function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Everything you need to know about OpenClaude.
          </p>
        </div>

        <div className="divide-y divide-border rounded-xl border overflow-hidden">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-card">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
                aria-expanded={open === i}
              >
                <span className="font-medium text-base">{faq.q}</span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                    open === i && "rotate-180"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  open === i ? "max-h-96" : "max-h-0"
                )}
              >
                <p className="px-6 pb-5 text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
