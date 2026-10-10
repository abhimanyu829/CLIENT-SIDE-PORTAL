import type { Metadata } from "next"
import Link from "next/link"
import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"
import { CompareTable, type CompareProduct } from "@/components/public/CompareTable"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Compare Products & Plans | Abhibhideveloper",
  description:
    "Compare published Abhibhideveloper products using their real attributes — type, category, starting price, billing interval, tags and demo availability — before you buy or request a demonstration.",
  alternates: { canonical: "/compare" },
}

export default async function ComparePage() {
  const products = await db.product
    .findMany({
      where: { status: ProductStatus.AVAILABLE },
      include: { tiers: { orderBy: { price: "asc" }, take: 1 } },
      orderBy: [{ isFeatured: "desc" }, { viewCount: "desc" }],
      take: 12,
    })
    .catch(() => [])

  const items: CompareProduct[] = products.map((p) => {
    const tier = p.tiers[0]
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      type: String(p.type),
      category: p.category,
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
      startingPrice: tier ? Number(tier.price) : null,
      currency: tier?.currency ? String(tier.currency) : null,
      billingInterval: tier?.interval ? String(tier.interval) : null,
      demoUrl: p.demoUrl,
      reviewCount: p.reviewCount,
      averageRating: p.averageRating,
    }
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-4 pt-16 pb-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">Compare</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Compare published products and their real attributes
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground max-w-3xl">
            This page reflects the live catalog. Everything shown — type, category, starting price, billing
            interval, tags, and whether a public demonstration exists — is read from the published product
            records. We do not display invented prices, review scores, adoption numbers, or competitor
            comparisons.
          </p>
        </div>
      </section>

      <section className="px-4 pb-10">
        <div className="mx-auto max-w-5xl">
          <CompareTable products={items} />
        </div>
      </section>

      <section className="border-t border-border px-4 py-12">
        <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">How to choose</h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              Start from your requirement, not the feature list. Decide whether you need a ready product, a
              configured solution, or custom development, then confirm the inclusions and limitations on the
              product page.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">What to verify</h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              Check the billing interval (recurring versus one-time), usage limits, hosting and maintenance
              inclusions, and whether a demonstration is published for the product you are considering.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Not sure?</h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              Describe your requirement and we will tell you whether an existing product fits or whether a
              custom solution is the honest answer.{" "}
              <Link href="/contact" className="text-primary hover:underline underline-offset-4">Send an enquiry</Link>.
            </p>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-5xl text-xs text-muted-foreground">
          Prices and availability can change as the catalog is updated. Always confirm the current price and
          plan inclusions on the product page before purchasing.
        </p>
      </section>
    </div>
  )
}