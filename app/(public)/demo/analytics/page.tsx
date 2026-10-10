import type { Metadata } from "next"
import Link from "next/link"
import { AnalyticsDemo } from "@/components/demo/AnalyticsDemo"

export const metadata: Metadata = {
  title: "Analytics Demonstration | Abhibhideveloper",
  description:
    "Explore an interactive analytics demonstration: metric switching, date-range filtering, trends and a data table on a clearly labelled synthetic dataset.",
  alternates: { canonical: "/demo/analytics" },
}

export default function AnalyticsDemoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-4">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Demo · Analytics</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">Analytics dashboard demonstration</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground max-w-3xl">
            Analytics turns raw activity into readable measures — how much traffic arrived, how many accounts
            were created, how many purchases completed, and what those purchases were worth. This
            demonstration shows metric switching, a date-range filter, a trend chart, and the underlying table,
            using a synthetic dataset that is labelled as such everywhere it appears.
          </p>
          <ul className="mt-5 grid gap-2 text-sm leading-6 text-muted-foreground sm:grid-cols-2 max-w-3xl">
            <li><strong className="text-foreground">Who it is for:</strong> teams that need to see trends without building a reporting stack.</li>
            <li><strong className="text-foreground">What you can try:</strong> switch metrics, change the range from 3 to 9 months, and read exact values.</li>
            <li><strong className="text-foreground">Unit and period:</strong> each metric states its unit; every point is one calendar month.</li>
            <li><strong className="text-foreground">Not included:</strong> exports, drill-down, predictive or AI insights — those are not built here.</li>
          </ul>
        </div>
      </section>

      <section className="px-4 pb-10">
        <div className="mx-auto max-w-5xl">
          <AnalyticsDemo />
        </div>
      </section>

      <section className="border-t border-border px-4 py-10">
        <div className="mx-auto max-w-5xl grid gap-4 md:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">How to read this</h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              The Y-axis auto-scales to the visible minimum and maximum, which makes month-to-month changes easy
              to see but means you should read exact values from the table, not from pixel height.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">A real analytics product</h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              Would connect to your actual data sources, respect per-account authorization, state each metric&apos;s
              definition and refresh period, and offer exports only where they genuinely produce a file.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Related</h2>
            <ul className="mt-2 space-y-1.5">
              <li><Link href="/demo/crm" className="text-primary hover:underline underline-offset-4">CRM demonstration</Link></li>
              <li><Link href="/blog/guides/what-a-saas-subscription-should-include" className="text-primary hover:underline underline-offset-4">What a SaaS subscription should include</Link></li>
              <li><Link href="/contact" className="text-primary hover:underline underline-offset-4">Request a custom dashboard</Link></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}