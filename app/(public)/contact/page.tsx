import type { Metadata } from "next"
import Link from "next/link"
import { EnquiryForm } from "@/components/public/EnquiryForm"

export const metadata: Metadata = {
  title: "Contact Abhibhideveloper | Sales, Support & Partnerships",
  description:
    "Contact Abhibhideveloper for product and pricing questions, custom software and AI automation, enterprise requirements, technical support, billing issues, partnerships, press or privacy requests.",
  alternates: { canonical: "/contact" },
}

const ROUTES = [
  ["Product & pricing", "Questions about a listed product, plan inclusions, or how a price is determined."],
  ["Custom software & AI automation", "Describe a project: goals, required features, existing systems, expected outcome."],
  ["Enterprise requirements", "Larger or multi-system engagements that need scoping before a quotation."],
  ["Technical support", "Problems with a purchased product or service, with the order reference where available."],
  ["Billing & subscription", "Invoice or payment records, renewal questions, cancellation requests."],
  ["Affiliate, partnership & press", "Interest in the affiliate program, partnership discussions, or media enquiries."],
  ["Privacy & legal", "Access, correction or deletion requests and other privacy matters."],
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Contact</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Talk to Abhibhideveloper
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Tell us what you want to build, which problem you want to solve, or which task you want to
            automate. Send sales and project enquiries through the form below; account-specific problems
            are best raised from your dashboard support tickets so we can see the relevant records.
          </p>
        </div>
      </section>

      <section className="px-4 pb-8">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Send an enquiry</h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              Fields marked * are required. Submissions are stored server-side and reviewed periodically;
              this form does not open a live chat and does not guarantee a response time.
            </p>
            <EnquiryForm
              categories={[
                "product-pricing",
                "custom-software-ai",
                "enterprise",
                "technical-support",
                "billing-subscription",
                "affiliate-partnership",
                "privacy-legal",
                "press-media",
              ]}
            />
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">What we accept</h2>
              <ul className="mt-3 space-y-3">
                {ROUTES.map(([title, desc]) => (
                  <li key={title}>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{desc}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 text-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Faster routes</h2>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li><Link href="/faq" className="text-primary hover:underline underline-offset-4">Frequently asked questions</Link> — most product and billing questions are answered here.</li>
                <li><Link href="/dashboard/tickets" className="text-primary hover:underline underline-offset-4">Support tickets</Link> — for existing purchases, so we can review your records.</li>
                <li><Link href="/how-it-works" className="text-primary hover:underline underline-offset-4">How delivery works</Link> — scope, testing, deployment and maintenance.</li>
                <li><Link href="/docs/api" className="text-primary hover:underline underline-offset-4">API documentation</Link> — for developer and integration questions.</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Please do not send passwords, OTPs, card numbers, or private keys through any contact channel.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-border px-4 py-10">
        <div className="mx-auto max-w-3xl text-sm leading-7 text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">Business details</h2>
          <p className="mt-2">
            Brand: Abhibhideveloper. The exact legal entity, registered address, and dedicated grievance
            contact are published as required once finalised; they are not invented on this page. For
            matters that legally require a named grievance contact, state that clearly in your enquiry and
            we will route it appropriately under our{" "}
            <Link href="/privacy" className="text-primary hover:underline underline-offset-4">Privacy Policy</Link> and{" "}
            <Link href="/terms" className="text-primary hover:underline underline-offset-4">Terms</Link>.
          </p>
        </div>
      </section>
    </div>
  )
}