"use client"

import { useState, useRef, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Calendar, Mail, ShieldCheck, Sparkles, Clock, CheckCircle2, ArrowRight, Headset, Loader2 } from "lucide-react"
import { PageHero } from "@/components/public/PageHero"
import { FAQSection } from "@/components/public/FAQSection"

const TRUST_METRICS = [
  { icon: ShieldCheck, title: "SOC2 & GDPR Compliant", desc: "Enterprise security standards" },
  { icon: Clock, title: "< 1 Hour Response", desc: "Dedicated sales engineers" },
  { icon: CheckCircle2, title: "99.99% SLA Uptime", desc: "Guaranteed high availability" },
]

export default function ContactSalesClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstNameRef = useRef<HTMLInputElement>(null)
  const lastNameRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const companySizeRef = useRef<HTMLSelectElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const firstName = firstNameRef.current?.value.trim() ?? ""
    const lastName = lastNameRef.current?.value.trim() ?? ""
    const message = messageRef.current?.value.trim() ?? ""
    const companySize = companySizeRef.current?.value ?? ""

    const fullName = [firstName, lastName].filter(Boolean).join(" ")

    if (!firstName || !lastName || !message) {
      setError("Please fill in all required fields.")
      setLoading(false)
      return
    }

    const payload = {
      fullName,
      companyName: companySize,
      serviceCategory: "Enterprise Sales Inquiry",
      projectTitle: `Sales Inquiry from ${fullName}`,
      ideaDescription: message,
      additionalNotes: `Company Size: ${companySize}`,
      attachments: [],
    }

    try {
      const res = await fetch("/api/custom-service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.status === 401) {
        router.push("/login?callbackUrl=/contact-sales")
        return
      }

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to submit. Please try again.")
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/dashboard/service-requests/${data.data.id}`)
      }, 2000)
    } catch {
      setError("Network error. Please check your connection and try again.")
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#080808] text-white min-h-screen relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-10 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <PageHero
        title="Talk to our Sales Team"
        description="Discover how NexusAI can transform your AI infrastructure with enterprise security, dedicated support, and custom AI agent workflows."
        pillText="Enterprise Sales & Architecture"
        align="center"
      />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">

        {/* Trust Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {TRUST_METRICS.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={idx} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 hover:border-purple-500/40 transition-all">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">{item.title}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Contact Form */}
          <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Schedule Consultation</span>
                <h2 className="text-2xl font-black text-white mt-1">Send an Inquiry</h2>
              </div>
              <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>

            {success ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-black text-white">Request Submitted!</h3>
                <p className="text-zinc-400 text-sm">Your inquiry has been sent to our team. Redirecting you to track your request…</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">First Name *</label>
                    <input
                      ref={firstNameRef}
                      type="text"
                      placeholder="Jane"
                      required
                      className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm font-semibold shadow-sm"
                      style={{ backgroundColor: '#ffffff', color: '#171717' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">Last Name *</label>
                    <input
                      ref={lastNameRef}
                      type="text"
                      placeholder="Doe"
                      required
                      className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm font-semibold shadow-sm"
                      style={{ backgroundColor: '#ffffff', color: '#171717' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">Company Size *</label>
                  <select
                    ref={companySizeRef}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm font-semibold cursor-pointer shadow-sm"
                    style={{ backgroundColor: '#ffffff', color: '#171717' }}
                  >
                    <option className="bg-white text-zinc-900">1-50 employees</option>
                    <option className="bg-white text-zinc-900">51-200 employees</option>
                    <option className="bg-white text-zinc-900">201-1000 employees</option>
                    <option className="bg-white text-zinc-900">1000+ employees</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">How can we help? *</label>
                  <textarea
                    ref={messageRef}
                    rows={4}
                    required
                    placeholder="Tell us about your project requirements, estimated token volume, or deployment timeline..."
                    className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm font-semibold resize-none shadow-sm"
                    style={{ backgroundColor: '#ffffff', color: '#171717' }}
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-xl shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</>
                  ) : (
                    <>Submit Request <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>

                <p className="text-xs text-zinc-500 text-center">
                  You must be signed in to submit. You&apos;ll be redirected to login if needed.
                </p>
              </form>
            )}
          </div>

          {/* Contact Info */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Direct Connect</span>
              <h2 className="text-3xl font-black text-white mt-1 mb-4">Other ways to connect</h2>
              <p className="text-zinc-400 text-base leading-relaxed mb-8">
                Prefer to speak right away? You can reach our sales engineering team through any of the channels below.
              </p>

              <div className="space-y-5">
                <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-purple-500/40 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shrink-0">
                      <Calendar className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Book a Live Demo</h3>
                      <p className="text-xs text-zinc-400 mb-2">Schedule a 30-minute technical deep dive with an architect.</p>
                      <a href="#" className="text-purple-400 font-bold text-sm hover:underline inline-flex items-center gap-1">
                        View Calendar <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-blue-500/40 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                      <Mail className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Email Us Directly</h3>
                      <p className="text-xs text-zinc-400 mb-2">For general sales inquiries, contracts, and RFPs.</p>
                      <a href="mailto:sales@nexusai.com" className="text-blue-400 font-bold text-sm hover:underline">
                        sales@nexusai.com
                      </a>
                    </div>
                  </div>
                </div>

                <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-emerald-500/40 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                      <MessageSquare className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Instant Live Chat</h3>
                      <p className="text-xs text-zinc-400 mb-2">Chat directly with an online product specialist.</p>
                      <button className="text-emerald-400 font-bold text-sm hover:underline cursor-pointer">
                        Start Chat →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 to-blue-950/40 p-6 flex items-center gap-4">
              <Headset className="w-8 h-8 text-purple-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white">Need Technical Support?</p>
                <p className="text-xs text-zinc-400">Existing customers can open tickets directly from the user dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FAQSection
        title="Sales FAQs"
        faqs={[
          { question: "How fast can we get started?", answer: "Most teams set up their account and begin deploying within minutes after onboarding." },
          { question: "Do you offer custom enterprise plans?", answer: "Yes, we tailor plans based on your usage, security requirements, and team size." },
          { question: "What support is included?", answer: "All enterprise plans include 24/7 email support with dedicated account managers and technical architects." },
          { question: "Can we request custom AI agent development?", answer: "Absolutely. Our engineering team builds and delivers custom AI software solutions tailored to your workflow." },
        ]}
      />
    </div>
  )
}
