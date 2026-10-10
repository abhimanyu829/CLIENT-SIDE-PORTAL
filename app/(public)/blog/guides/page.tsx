import type { Metadata } from "next"
import Link from "next/link"
import { GUIDES } from "@/lib/content/brand-blocks"

export const metadata: Metadata = {
  title: "Guides — Websites, AI & Software Operations | Abhibhideveloper",
  description:
    "Practical guides on planning websites, understanding web applications, AI agents and automation, SaaS subscriptions, deployment, maintenance and payment verification.",
}

export default function GuidesIndexPage() {
  const categories = Array.from(new Set(GUIDES.map((g) => g.category)))
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Guides</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Practical technology guides from Abhibhideveloper
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-3xl">
            Original explanations built around real customer questions — planning, evaluating,
            and operating websites, web applications, AI automation, and software subscriptions.
          </p>

          {categories.map((cat) => (
            <div key={cat} className="mt-12">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{cat}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {GUIDES.filter((g) => g.category === cat).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/blog/guides/${g.slug}`}
                    className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
                  >
                    <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{g.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{g.excerpt}</p>
                    <p className="mt-3 text-xs font-medium text-primary">Read guide →</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}