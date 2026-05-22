import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FAQSection } from "@/components/public/FAQSection"
import { MessageSquare, Calendar, Mail, Phone } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Sales — NexusAI",
  description: "Get in touch with the NexusAI sales team for enterprise pricing, custom deployments, and volume discounts.",
}

export default function ContactSalesPage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero 
        title="Talk to our Sales Team"
        description="We'll help you find the right AI deployment architecture and pricing for your organization."
        pillText="Enterprise Sales"
      />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* Contact Form */}
          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 md:p-12">
            <h2 className="text-2xl font-bold mb-8">Send an Inquiry</h2>
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">First Name</label>
                  <input type="text" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Last Name</label>
                  <input type="text" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Work Email</label>
                <input type="email" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Company Size</label>
                <select className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 appearance-none">
                  <option>1-50 employees</option>
                  <option>51-200 employees</option>
                  <option>201-1000 employees</option>
                  <option>1000+ employees</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">How can we help?</label>
                <textarea rows={4} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"></textarea>
              </div>
              <button type="button" className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 transition-colors">
                Submit Request
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col justify-center">
            <h2 className="text-3xl font-bold mb-6">Other ways to connect</h2>
            <p className="text-zinc-400 mb-12 text-lg leading-relaxed">
              Prefer to speak right away? You can reach our sales engineering team through any of the channels below.
            </p>
            
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shrink-0">
                  <Calendar className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Book a Demo</h3>
                  <p className="text-zinc-400 mb-2">Schedule a 30-minute technical deep dive.</p>
                  <a href="#" className="text-purple-400 font-medium hover:underline">View Calendar →</a>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                  <Mail className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Email Us</h3>
                  <p className="text-zinc-400 mb-2">For general sales inquiries and RFPs.</p>
                  <a href="mailto:sales@nexusai.com" className="text-blue-400 font-medium hover:underline">sales@nexusai.com</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <MessageSquare className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Live Chat</h3>
                  <p className="text-zinc-400 mb-2">Chat directly with a product specialist.</p>
                  <button className="text-emerald-400 font-medium hover:underline">Start Chat →</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FAQSection 
        title="Sales FAQs"
        faqs={[
          { question: "Do you offer proof of concepts (POCs)?", answer: "Yes, for qualified enterprise prospects we offer a 14-day assisted POC with a dedicated solution architect." },
          { question: "Can we purchase through AWS/GCP Marketplace?", answer: "Yes, NexusAI can be purchased and billed directly through your existing AWS, GCP, or Azure commits." }
        ]}
      />
    </div>
  )
}
