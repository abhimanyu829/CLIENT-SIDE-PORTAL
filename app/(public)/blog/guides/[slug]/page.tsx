import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { GuideBody } from "@/components/content/BrandBlocks"
import { GUIDES } from "@/lib/content/brand-blocks"

interface GuideProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: GuideProps): Promise<Metadata> {
  const { slug } = await params
  const guide = GUIDES.find((g) => g.slug === slug)
  if (!guide) return { title: "Guide not found | Abhibhideveloper" }
  return {
    title: `${guide.title} | Abhibhideveloper Guides`,
    description: guide.excerpt,
  }
}

export default async function GuidePage({ params }: GuideProps) {
  const { slug } = await params
  const guide = GUIDES.find((g) => g.slug === slug)
  if (!guide) notFound()

  const others = GUIDES.filter((g) => g.slug !== slug).slice(0, 3)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <article className="px-4 pt-16">
        <header className="mx-auto max-w-3xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">{guide.category}</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">{guide.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{guide.excerpt}</p>
        </header>
      </article>
      <div className="mx-auto max-w-3xl">
        <GuideBody sections={guide.sections} />
      </div>
      <section className="border-t border-border bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">More guides</h2>
          <ul className="mt-4 space-y-2">
            {others.map((g) => (
              <li key={g.slug}>
                <Link href={`/blog/guides/${g.slug}`} className="text-sm font-medium text-primary hover:underline underline-offset-4">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            <Link href="/blog/guides" className="text-primary hover:underline underline-offset-4">← All guides</Link>
          </p>
        </div>
      </section>
    </div>
  )
}