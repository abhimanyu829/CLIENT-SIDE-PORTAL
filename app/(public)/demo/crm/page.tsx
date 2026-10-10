import type { Metadata } from "next"
import Link from "next/link"
import { CrmDemo } from "@/components/demo/CrmDemo"

export const metadata: Metadata = {
  title: "CRM Demonstration | Abhibhideveloper",
  description:
    "Try an interactive CRM-style demonstration: synthetic lead records, pipeline stages, search and filtering, stage movement and pipeline totals. Sample data only — no production records.",
  alternates: { canonical: "/demo/crm" },
}

export default function CrmDemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-4">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Demo · CRM</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">CRM and sales pipeline demonstration</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground max-w-3xl">
            A CRM keeps leads and customer conversations organised so nothing is lost between first contact and
            a closed deal. This demonstration shows the core sales workflow — a lead list, pipeline stages,
            search, filtering, stage movement, and pipeline totals — using synthetic records that live only in
            your browser.
          </p>
          <ul className="mt-5 grid gap-2 text-sm leading-6 text-muted-foreground sm:grid-cols-2 max-w-3xl">
            <li><strong className="text-foreground">Who it is for:</strong> sales and operations teams tracking enquiries and deals.</li>
            <li><strong className="text-foreground">Problem it addresses:</strong> scattered lead information and unclear pipeline status.</li>
            <li><strong className="text-foreground">What you can try here:</strong> search, stage filtering, advancing stages, and reading pipeline totals.</li>
            <li><strong className="text-foreground">What is not included:</strong> persistence, email automation, AI scoring, or real customer records.</li>
          </ul>
        </div>
      </section>

      <section className="px-4 pb-10">
        <div className="mx-auto max-w-5xl">
          <CrmDemo />
        </div>
      </section>

      <section className="border-t border-border px-4 py-10">
        <div className="mx-auto max-w-5xl grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">How a real CRM would work</h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              Records persist in an authenticated database, every read and write is authorized per account,
              and changes are attributed to the signed-in user. This demonstration deliberately does none of
              that — reloading the page restores the sample set.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Need it customised?</h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              Pipelines, stages, fields, integrations and reporting are usually tailored to a team&apos;s actual
              process.{" "}
              <Link href="/contact" className="text-primary hover:underline underline-offset-4">Send an enquiry</Link> describing your sales workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Related</h2>
            <ul className="mt-2 space-y-1.5">
              <li><Link href="/demo/analytics" className="text-primary hover:underline underline-offset-4">Analytics demonstration</Link></li>
              <li><Link href="/demo/ai-agent" className="text-primary hover:underline underline-offset-4">AI assistant demonstration</Link></li>
              <li><Link href="/marketplace" className="text-primary hover:underline underline-offset-4">Browse marketplace products</Link></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}