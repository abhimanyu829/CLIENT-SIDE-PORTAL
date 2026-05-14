import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { ProductStatus, ProductType } from "@prisma/client"

interface Props { params: { slug: string } }

async function getAgent(slug: string) {
  return db.product.findFirst({
    where: { slug, status: ProductStatus.PUBLISHED, type: ProductType.AI_AGENT },
    include: {
      tiers: { orderBy: { price: "asc" } },
      reviews: {
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      _count: { select: { reviews: true } },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agent = await db.product.findFirst({ where: { slug: params.slug }, select: { name: true, description: true } })
  if (!agent) return { title: "Agent Not Found" }
  return { title: `${agent.name} — AI Agent`, description: agent.description ?? undefined }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <svg key={s} className={`w-4 h-4 ${s <= Math.round(rating) ? "text-amber-400" : "text-muted"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

export default async function AIAgentDetailPage({ params }: Props) {
  const agent = await getAgent(params.slug)
  if (!agent) notFound()

  // Fire-and-forget view increment
  db.product.update({ where: { id: agent.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

  const features: string[] = typeof agent.features === "string"
    ? JSON.parse(agent.features)
    : Array.isArray(agent.features) ? agent.features as string[] : []

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-8 flex items-center gap-2">
        <Link href="/ai-agents" className="hover:text-foreground">AI Agents</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{agent.name}</span>
      </nav>

      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        <div className="space-y-5">
          <div>
            <span className="inline-block bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold px-3 py-1 rounded-full mb-3">
              🤖 AI Agent
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight">{agent.name}</h1>
            <p className="text-muted-foreground mt-2">{agent.tagline}</p>
            {agent.averageRating > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <StarRating rating={agent.averageRating} />
                <span className="text-sm font-bold">{agent.averageRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({agent._count.reviews} reviews)</span>
              </div>
            )}
          </div>
          <p className="text-lg text-muted-foreground">{agent.description}</p>

          {features.length > 0 && (
            <ul className="space-y-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          )}

          <Link href={`/demo?product=${agent.slug}`}>
            <Button size="lg" className="mt-2 gap-2">▶ Try a Live Demo</Button>
          </Link>
        </div>

        {/* Thumbnail */}
        <div className="rounded-2xl overflow-hidden border bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 flex items-center justify-center aspect-video">
          {agent.thumbnailUrl ? (
            <img src={agent.thumbnailUrl} alt={agent.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-7xl select-none">🤖</span>
          )}
        </div>
      </div>

      {/* Pricing */}
      {agent.tiers.length > 0 && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Pricing</h2>
          <div className={`grid gap-6 ${agent.tiers.length === 1 ? "max-w-sm" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {agent.tiers.map((tier) => {
              const tierFeatures: string[] = typeof tier.features === "string" ? JSON.parse(tier.features) : Array.isArray(tier.features) ? tier.features as string[] : []
              return (
                <div key={tier.id} className={`border-2 rounded-2xl p-6 flex flex-col gap-4 ${tier.isPopular ? "border-primary" : "border-border"} hover:shadow-lg transition-shadow`}>
                  {tier.isPopular && (
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full w-fit">Most Popular</span>
                  )}
                  <div>
                    <p className="font-semibold text-sm text-muted-foreground">{tier.name}</p>
                    <p className="text-3xl font-bold">
                      {formatCurrency(Number(tier.price) / 100, tier.currency)}
                      <span className="text-sm font-normal text-muted-foreground">/{tier.interval === "MONTHLY" ? "mo" : "yr"}</span>
                    </p>
                  </div>
                  <ul className="space-y-1.5 flex-1 text-sm">
                    {tierFeatures.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/checkout?tierId=${tier.id}&product=${agent.slug}`}>
                    <Button className="w-full" variant={tier.isPopular ? "default" : "outline"}>Get Started</Button>
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Reviews */}
      {agent.reviews.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>
          <div className="space-y-4">
            {agent.reviews.map((review) => (
              <div key={review.id} className="border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold shrink-0">
                    {(review.user.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{review.user.name ?? "Anonymous"}</span>
                      <StarRating rating={review.rating} />
                    </div>
                    {review.title && <p className="font-medium text-sm mb-1">{review.title}</p>}
                    <p className="text-sm text-muted-foreground">{review.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
