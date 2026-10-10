import type { Metadata } from "next"
import Link from "next/link"
import { EnquiryForm } from "@/components/public/EnquiryForm"

export const metadata: Metadata = {
  title: "Press & Media Information | Abhibhideveloper",
  description:
    "Official, factual company information about Abhibhideveloper for journalists and media: what the company is, what it offers, brand usage guidance, and how to submit a media enquiry.",
  alternates: { canonical: "/press" },
}

export default function PressPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Press & Media</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Press and media information
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            This page provides accurate, citable information about Abhibhideveloper. It does not claim press
            coverage, awards, funding, or recognition that the company does not have.
          </p>
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Company description</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Abhibhideveloper is an early-stage technology venture focused on software products, AI-powered
              solutions, custom software development, websites, web applications, and automation services. It
              operates a platform where customers can discover digital products, request custom development,
              and manage purchased software and subscriptions through a customer dashboard.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Mission</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              To make useful digital technology easier to discover, adopt, and manage by bringing software
              products, AI-driven solutions, custom development, and lifecycle support together in one
              accessible platform.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Factual background</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Abhibhideveloper is founder-led and builds toward AI-assisted operations. The exact legal entity
              and registration details are published only once finalised — we do not invent a registered name,
              registration number, or address for press use. Where a formal statement is required, request it
              in writing through the media enquiry form.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Products and services</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
              <li>AI agents, chatbots, and intelligent assistants</li>
              <li>Workflow automation and integrations</li>
              <li>SaaS products and software tools</li>
              <li>Websites and web applications</li>
              <li>Dashboards, CRM workflows, APIs, and integrations</li>
              <li>Custom software development</li>
              <li>Deployment, maintenance, and support where included in a plan or agreement</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              These are the platform&apos;s focus categories. Availability at any time is what is actually
              published in the marketplace or agreed in writing.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-semibold tracking-tight">Brand resources and usage</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
            <p>
              The brand name is <strong className="text-foreground">Abhibhideveloper</strong>. Logo asset
              downloads are not currently published; if you need the wordmark or logo for a factual article,
              request it through the media enquiry form and specify the intended use. Brand assets are
              provided as general brand resources — they are not a statement of partnership, endorsement, or
              an official announcement.
            </p>
            <p>
              When referencing the company, use the brand name accurately, do not alter or recolour the logo
              without permission, do not imply sponsorship or endorsement, and do not present draft material
              as an official company statement.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-14 bg-card/40">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Media enquiry</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Journalists and media can submit a factual enquiry below. We do not publish a personal phone
            number or private email address; enquiries are reviewed through this monitored channel.
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <EnquiryForm categories={["press-media"]} defaultCategory="press-media" compact />
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-10">
        <div className="mx-auto max-w-4xl text-sm leading-7 text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">Official links</h2>
          <ul className="mt-3 space-y-2">
            <li><Link href="/about" className="text-primary hover:underline underline-offset-4">About Abhibhideveloper</Link></li>
            <li><Link href="/marketplace" className="text-primary hover:underline underline-offset-4">Product marketplace</Link></li>
            <li><Link href="/services" className="text-primary hover:underline underline-offset-4">Services</Link></li>
            <li><Link href="/contact" className="text-primary hover:underline underline-offset-4">General contact</Link></li>
          </ul>
          <p className="mt-4 text-xs">
            No press releases, media mentions, awards, or funding announcements are listed because none exist
            to report at this time.
          </p>
        </div>
      </section>
    </div>
  )
}