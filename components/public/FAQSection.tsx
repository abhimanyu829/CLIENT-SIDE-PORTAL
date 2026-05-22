"use client"
import React, { useState } from "react"
import { ChevronDown } from "lucide-react"

interface FAQ {
  question: string
  answer: string
}

interface FAQSectionProps {
  title?: string
  description?: string
  faqs: FAQ[]
}

export function FAQSection({ title = "Frequently Asked Questions", description, faqs }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="py-24 border-t border-white/5 bg-[#080808]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">{title}</h2>
          {description && <p className="text-zinc-400">{description}</p>}
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div 
              key={i} 
              className="border border-white/10 bg-white/[0.02] rounded-2xl overflow-hidden transition-all hover:border-white/20"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
              >
                <span className="font-medium pr-8">{faq.question}</span>
                <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform ${openIndex === i ? "rotate-180" : ""}`} />
              </button>
              {openIndex === i && (
                <div className="px-6 pb-5 text-zinc-400 text-sm leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
