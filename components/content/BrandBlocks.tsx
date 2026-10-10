/**
 * components/content/BrandBlocks.tsx
 * Additive brand/legal content renderer. Server components only — no data
 * fetching, no client state, no backend impact.
 */
import type { BlockSection } from "@/lib/content/brand-blocks"
import { HOME_BRAND } from "@/lib/content/brand-blocks"
import { HomeBrandShowcase } from "./HomeBrandShowcase"

export { HomeBrandShowcase }

export function BrandSectionList({
  sections,
  eyebrow,
  className,
}: {
  sections: BlockSection[]
  eyebrow?: string
  className?: string
}) {
  if (sections === HOME_BRAND) {
    return <HomeBrandShowcase />
  }

  return (
    <section className={`py-16 px-4 bg-background border-t border-border ${className ?? ""}`}>
      <div className="mx-auto max-w-4xl space-y-10">
        {eyebrow ? <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">{eyebrow}</p> : null}
        {sections.map((s, i) => (
          <article key={s.heading ?? i} className="space-y-3">
            {s.heading ? <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground text-balance">{s.heading}</h2> : null}
            {s.lead ? <p className="text-lg text-muted-foreground leading-relaxed">{s.lead}</p> : null}
            {s.body?.map((p, j) => (
              <p key={j} className="text-[15px] leading-7 text-muted-foreground">{p}</p>
            ))}
            {s.list ? (
              <ul className="space-y-2 pt-1">
                {s.list.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] leading-7 text-muted-foreground">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {s.steps ? (
              <ol className="grid gap-3 pt-2 sm:grid-cols-2">
                {s.steps.map((step) => (
                  <li key={step.title} className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

/** Renders an article's sections (used by the guides pages). */
export function GuideBody({ sections }: { sections: BlockSection[] }) {
  return <BrandSectionList sections={sections} className="border-t-0 py-6" />
}