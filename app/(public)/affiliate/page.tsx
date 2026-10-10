import React from "react"
import { PageHero } from "@/components/public/PageHero"
import { FeatureGrid } from "@/components/public/FeatureGrid"
import { CallToAction } from "@/components/public/CallToAction"
import { FAQSection } from "@/components/public/FAQSection"
import { AlertCircle, FileText, Link as LinkIcon, ShieldCheck, Users, Mail } from "lucide-react"
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Affiliate Program Status — Abhibhideveloper",
  description:
    "The Abhibhideveloper affiliate and referral programme is not open yet. Read the honest current status and register interest without any implied commission or approval.",
}

export default function AffiliatePage() {
  return (
    <div className="bg-[#080808] text-white min-h-screen">
      <PageHero
        title={<>Affiliate programme <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-400">not yet open</span></>}
        description="We are not currently accepting affiliate participants, issuing referral links, or publishing commission terms. This page states that plainly instead of advertising earnings that do not exist."
        pillText="Programme status"
        ctaText="Read full details"
        ctaHref="/affiliates"
      />

      <div className="max-w-4xl mx-auto px-6 mb-16">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-300" />
          <h2 className="mt-3 text-xl font-bold">No active affiliate programme at this time</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Referral code records exist internally in the platform, but there is no public link generator, no
            published attribution rules, and no participant payout system. Nothing on this website should be read
            as offering commission, revenue, or any other financial benefit for referrals.
          </p>
          <Link href="/affiliates" className="mt-5 inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200">
            Full programme status and interest form →
          </Link>
        </div>
      </div>

      <FeatureGrid
        title="What would be required before opening"
        features={[
          { icon: FileText, title: "Published terms", description: "Eligibility, application, approval, attribution window, qualifying transactions, and dispute handling — written down before launch." },
          { icon: LinkIcon, title: "Working tracking", description: "Referral links with defined attribution rules that both parties can verify." },
          { icon: ShieldCheck, title: "Compliant promotion", description: "Required disclosure, prohibited methods, and rules that keep promotion honest." },
          { icon: Users, title: "Payout operations", description: "Threshold, schedule, refund and chargeback treatment, and tax information handling." },
          { icon: AlertCircle, title: "No earnings claims", description: "No advertised percentages or example payouts until the system actually exists." },
          { icon: Mail, title: "Interest list", description: "A monitored channel to record interest — without implying approval or entitlement." },
        ]}
      />

      <FAQSection
        title="Affiliate questions"
        faqs={[
          { question: "Can I become an affiliate today?", answer: "No. The programme is not open, so there is nothing to join yet. Interest registered through the form is not an application or an approval." },
          { question: "What commission rate do you pay?", answer: "No rate is published because no programme exists to pay one. We do not advertise percentages for a system that has not been built and approved." },
          { question: "Will you notify me when it opens?", answer: "If you register interest and provide a working email address, that contact can be used to share factual updates if and when a programme opens." },
        ]}
      />

      <CallToAction
        title="Register interest accurately"
        description="Interest submissions are recorded for follow-up only and do not create affiliate accounts, commission rights, or guarantees of acceptance."
        ctaText="Register interest"
        ctaHref="/affiliates"
      />
    </div>
  )
}