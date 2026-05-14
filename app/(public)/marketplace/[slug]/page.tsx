import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { ProductStatus } from "@prisma/client"

// ── Data fetching ─────────────────────────────────────────────────────────────

interface Props {
  params: { slug: string }
}

async function getProduct(slug: string) {
  const product = await db.product.findFirst({
    where: { slug, status: ProductStatus.PUBLISHED },
    include: {
      tiers: { orderBy: { price: "asc" } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      _count: { select: { reviews: true } },
    },
  })

  if (!product) return null

  // Increment view count (fire-and-forget)
  db.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

  return product
}

async function getRelated(type: string, excludeId: string) {
  return db.product.findMany({
    where: { type: type as any, status: ProductStatus.PUBLISHED, id: { not: excludeId } },
    take: 3,
    select: {
      id: true,
      slug: true,
      name: true,
      thumbnailUrl: true,
      averageRating: true,
      tiers: { take: 1, orderBy: { price: "asc" }, select: { price: true, currency: true } },
    },
  })
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await db.product.findFirst({ where: { slug: params.slug }, select: { name: true, description: true } })
  if (!product) return { title: "Product Not Found" }
  return {
    title: `${product.name} — Marketplace`,
    description: product.description ?? undefined,
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`w-4 h-4 ${star <= Math.round(rating) ? "text-amber-400" : "text-muted"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

function TierCard({ tier, slug }: { tier: any; slug: string }) {
  const features: string[] = Array.isArray(tier.features)
    ? tier.features
    : typeof tier.features === "string"
    ? JSON.parse(tier.features)
    : []

  return (
    <div className={`relative border-2 rounded-2xl p-6 flex flex-col gap-4 transition-shadow hover:shadow-lg ${tier.isPopular ? "border-primary shadow-primary/10" : "border-border"}`}>
      {tier.isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
          Most Popular
        </span>
      )}
      <div>
        <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{tier.name}</p>
        <p className="text-3xl font-bold mt-1">
          {formatCurrency(Number(tier.price) / 100, tier.currency)}
          <span className="text-base font-normal text-muted-foreground">
            /{tier.interval === "MONTHLY" ? "mo" : tier.interval === "YEARLY" ? "yr" : "once"}
          </span>
        </p>
      </div>
      <ul className="space-y-2 flex-1">
        {features.map((f: string, i: number) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <Link href={`/checkout?tierId=${tier.id}&product=${slug}`}>
        <Button className="w-full" variant={tier.isPopular ? "default" : "outline"}>
          Get Started
        </Button>
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProductDetailPage({ params }: Props) {
  const product = await getProduct(params.slug)
  if (!product) notFound()

  // Use type as a category proxy since schema has no category field
  const related = await getRelated(product.type, product.id)

  const features: string[] = Array.isArray(product.features)
    ? product.features as string[]
    : typeof product.features === "string"
    ? JSON.parse(product.features as string)
    : []

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-8 flex items-center gap-2">
        <Link href="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{product.name}</span>
      </nav>

      {/* Hero section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 mb-16">
        {/* Left: Info */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <span className="inline-block bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-3">
              {product.type}
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight">{product.name}</h1>
            <p className="text-muted-foreground mt-2">{product.tagline}</p>

            {/* Rating row */}
            {product.averageRating > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <StarRating rating={product.averageRating} />
                <span className="text-sm font-semibold">{product.averageRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({product._count.reviews} reviews)</span>
              </div>
            )}
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed">{product.description}</p>

          {/* Feature list */}
          {features.length > 0 && (
            <div>
              <h2 className="font-bold text-lg mb-3">What&apos;s included</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-6 border-t pt-6">
            <div>
              <p className="text-2xl font-bold">{product.viewCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{product._count.reviews}</p>
              <p className="text-xs text-muted-foreground">Reviews</p>
            </div>
          </div>
        </div>

        {/* Right: Thumbnail */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl overflow-hidden border bg-muted aspect-video flex items-center justify-center">
            {product.thumbnailUrl ? (
              <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-muted-foreground text-sm">No preview image</span>
            )}
          </div>
        </div>
      </div>

      {/* Pricing tiers */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">Choose a plan</h2>
        <p className="text-muted-foreground mb-8">Select the tier that fits your needs. Upgrade or downgrade anytime.</p>
        <div className={`grid gap-6 ${product.tiers.length === 1 ? "max-w-sm" : product.tiers.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {product.tiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} slug={product.slug} />
          ))}
        </div>
      </section>

      {/* Reviews */}
      {product.reviews.length > 0 && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>
          <div className="space-y-4">
            {product.reviews.map((review) => (
              <div key={review.id} className="border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                    {review.user.avatarUrl ? (
                      <img src={review.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (review.user.name ?? "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{review.user.name ?? "Anonymous"}</span>
                      <StarRating rating={review.rating} />
                    </div>
                    {review.title && <p className="font-medium text-sm mb-1">{review.title}</p>}
                    <p className="text-sm text-muted-foreground">{review.body}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related products */}
      {related.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-6">You might also like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {related.map((p) => (
              <Link key={p.id} href={`/marketplace/${p.slug}`} className="border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all group">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-3">
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                </div>
                <p className="font-semibold group-hover:text-primary transition-colors">{p.name}</p>
                {p.tiers[0] && (
                  <p className="text-sm text-muted-foreground mt-1">
                    From {formatCurrency(Number(p.tiers[0].price) / 100, p.tiers[0].currency)}/mo
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
