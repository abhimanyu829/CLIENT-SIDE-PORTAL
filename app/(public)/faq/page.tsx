import type { Metadata } from "next"
import { FAQS } from "@/lib/content/brand-blocks"

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Abhibhideveloper",
  description:
    "Answers about Abhibhideveloper: services, custom software, AI automation, hosting and maintenance inclusions, payments and activation, refunds, and how to request a custom solution.",
}

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">FAQ</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Frequently asked questions about Abhibhideveloper
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Direct answers about what we provide, how purchases and delivery work, and what is
            included or excluded. Specific features and pricing are governed by the applicable
            product listing, plan, or written agreement.
          </p>

          <dl className="mt-10 space-y-4">
            {FAQS.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border bg-card p-5">
                <dt className="text-base font-semibold text-foreground">{item.q}</dt>
                <dd className="mt-2 text-[15px] leading-7 text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 text-sm text-muted-foreground">
            These answers describe general platform practice. They are not a claim that every
            service is currently available for every project — availability and suitability depend
            on your requirements, technical feasibility, and the agreed scope.
          </p>
        </div>
      </section>
    </div>
  )
}