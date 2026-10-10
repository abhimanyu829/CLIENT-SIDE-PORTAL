import type { Metadata } from "next"
import Link from "next/link"
import { EnquiryForm } from "@/components/public/EnquiryForm"
import { BrandSectionList } from "@/components/content/BrandBlocks"

export const metadata: Metadata = {
  title: "Affiliate & Referral Program Status | Abhibhideveloper",
  description:
    "Current status of the Abhibhideveloper affiliate and referral programme: what exists in the platform today, what is not yet open, and how to register interest accurately.",
  alternates: { canonical: "/affiliates" },
}

const SECTIONS = [
  {
    heading: "Current programme status",
    body: [
      "Abhibhideveloper has not opened a public affiliate or referral programme yet. We are not accepting affiliate participants, not issuing referral links for public use, and not publishing commission rates or payout schedules, because the tracking, attribution, payout, and legal frameworks for a responsible programme are still being evaluated.",
      "This page therefore does not advertise earnings, does not provide a sign-up that grants commission rights, and does not present example payouts. Any enquiry submitted here is a statement of interest only — it is not an application, not an approval, and not a contractual entitlement.",
    ],
  },
  {
    heading: "What exists in the platform today",
    list: [
      "Referral code records exist in the platform's database structure, with default commission and conversion fields.",
      "These records are internal. There is no self-service affiliate dashboard, no public link generator, no published attribution rules, and no automated payout system exposed to participants.",
      "Because those participant-facing systems are not live, we do not state commission percentages or payment terms on this page.",
    ],
  },
  {
    heading: "If and when the programme opens",
    body: [
      "A programme would be opened only with published, verifiable terms covering: eligibility, application and approval, referral-link generation, attribution window, qualifying transactions, commission calculation, refund and chargeback treatment, payout threshold and schedule, prohibited promotional methods, required disclosure, tax information, suspension and termination, and dispute handling.",
      "Until those terms are published here, nothing on this website should be read as offering commission, revenue, or any other financial benefit for referrals.",
    ],
  },
  {
    heading: "Prohibited promotion (would apply if opened)",
    list: [
      "Misrepresenting Abhibhideveloper products, capabilities, or results.",
      "Spam, unsolicited bulk messaging, or incentivised placement that violates a platform's rules.",
      "Bidding on Abhibhideveloper brand terms, or presenting as an official company representative without written authorisation.",
      "Any promotion that would require disclosing confidential customer or billing information.",
    ],
  },
]

export default function AffiliatesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Affiliates</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Affiliate and referral programme — not yet open
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            We would rather say this plainly than imply a programme exists. There is no active affiliate
            programme, no referral links, and no commission terms on offer today. You can register interest
            below, and the factual information on this page explains what would change if the programme
            opens.
          </p>
        </div>
      </section>

      <BrandSectionList sections={SECTIONS} eyebrow="Programme details" />

      <section className="border-t border-border px-4 py-14 bg-card/40">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Register interest</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Submitting this form records your interest and contact details. It does not create an affiliate
            account, does not guarantee acceptance, and does not entitle you to any commission.
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <EnquiryForm
              categories={["affiliate-partnership"]}
              defaultCategory="affiliate-partnership"
              showOrganization={false}
              compact
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-10">
        <div className="mx-auto max-w-4xl text-sm leading-7 text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">Related</h2>
          <ul className="mt-3 space-y-2">
            <li><Link href="/partners" className="text-primary hover:underline underline-offset-4">Partners</Link> — partnership and collaboration enquiries.</li>
            <li><Link href="/terms" className="text-primary hover:underline underline-offset-4">Terms & Conditions</Link> — the terms that would govern any future programme.</li>
            <li><Link href="/contact" className="text-primary hover:underline underline-offset-4">Contact</Link> — for any other commercial question.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}