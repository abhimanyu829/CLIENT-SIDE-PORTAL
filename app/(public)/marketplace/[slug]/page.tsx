import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { formatCurrency } from "@/lib/utils"
import { ProductStatus } from "@prisma/client"

interface Props { params: Promise<{ slug: string }> }

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
  db.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})
  return product
}

async function getRelated(type: string, excludeId: string) {
  return db.product.findMany({
    where: { type: type as any, status: ProductStatus.PUBLISHED, id: { not: excludeId } },
    take: 3,
    select: { id: true, slug: true, name: true, thumbnailUrl: true, averageRating: true, tiers: { take: 1, orderBy: { price: "asc" }, select: { price: true, currency: true } } },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await db.product.findFirst({ where: { slug }, select: { name: true, description: true } })
  if (!product) return { title: "Not Found" }
  return { title: `${product.name} — NexusAI Marketplace`, description: product.description ?? undefined }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const related = await getRelated(product.type, product.id)
  const features: string[] = Array.isArray(product.features) ? product.features as string[] : []

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .text-gradient { background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .btn-gradient { background: linear-gradient(135deg,#6366f1,#8b5cf6); }
        .glow-purple { box-shadow: 0 0 40px rgba(139,92,246,0.15); }
        .tab-active { border-bottom: 2px solid #8b5cf6; color: white; }
      `}</style>

      {/* Breadcrumb */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-zinc-600">
          <Link href="/marketplace" className="hover:text-zinc-400 transition-colors">Marketplace</Link>
          <span>/</span>
          <span className="text-zinc-400">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
          {/* Left: Info */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="glass text-xs font-bold px-3 py-1.5 rounded-full text-purple-300">
                  {product.type === "AI_AGENT" ? "🤖 AI Agent" : product.type === "SERVICE" ? "⚡ SaaS" : product.type}
                </span>
                <span className="glass text-xs px-3 py-1.5 rounded-full text-emerald-400">● Live</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">{product.name}</h1>
              <p className="text-zinc-400 text-xl">{product.tagline}</p>
            </div>

            {/* Rating */}
            {product.averageRating > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s=>(
                    <span key={s} className={`text-xl ${product.averageRating >= s ? "text-amber-400" : "text-zinc-700"}`}>★</span>
                  ))}
                </div>
                <span className="font-bold text-lg">{product.averageRating.toFixed(1)}</span>
                <span className="text-zinc-500">({product._count.reviews} reviews)</span>
              </div>
            )}

            {/* Description */}
            <p className="text-zinc-400 text-lg leading-relaxed">{product.description}</p>

            {/* Features */}
            {features.length > 0 && (
              <div>
                <h2 className="font-bold text-lg mb-4 text-white">What&apos;s included</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 glass rounded-xl p-3">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="text-zinc-300 text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-8 border-t border-white/5 pt-6">
              <div>
                <p className="text-2xl font-bold text-purple-400">{product.viewCount.toLocaleString()}</p>
                <p className="text-xs text-zinc-600">Total views</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{product._count.reviews}</p>
                <p className="text-xs text-zinc-600">Reviews</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{product.tiers.length}</p>
                <p className="text-xs text-zinc-600">Pricing tiers</p>
              </div>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-4">
            {/* Thumbnail */}
            <div className="glass rounded-2xl overflow-hidden aspect-video glow-purple">
              {product.thumbnailUrl ? (
                <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center">
                  <span className="text-6xl">{product.type === "AI_AGENT" ? "🤖" : "⚡"}</span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex gap-2">
                <Link href={`/demo?product=${product.slug}`} className="flex-1">
                  <button className="w-full glass py-3 rounded-xl text-sm font-bold hover:border-purple-500/50 transition-all text-zinc-300">
                    ▶ Try Demo
                  </button>
                </Link>
                <button className="glass px-4 py-3 rounded-xl text-sm hover:border-white/20 transition-all text-zinc-400">
                  ♡
                </button>
                <button className="glass px-4 py-3 rounded-xl text-sm hover:border-white/20 transition-all text-zinc-400">
                  ↗
                </button>
              </div>

              {/* Tech Stack */}
              {product.techStack && Array.isArray(product.techStack) && (product.techStack as string[]).length > 0 && (
                <div>
                  <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Tech Stack</p>
                  <div className="flex flex-wrap gap-2">
                    {(product.techStack as string[]).map(t=>(
                      <span key={t} className="glass text-xs px-2.5 py-1 rounded-full text-zinc-400">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <section className="mb-16">
          <h2 className="text-3xl font-black mb-3">Choose a plan</h2>
          <p className="text-zinc-500 mb-8">All plans include a 14-day free trial. No credit card required.</p>
          <div className={`grid gap-6 ${product.tiers.length === 1 ? "max-w-sm" : product.tiers.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
            {product.tiers.map((tier) => {
              const tf: string[] = Array.isArray(tier.features) ? tier.features as string[] : []
              return (
                <div key={tier.id} className={`relative rounded-2xl p-7 transition-all hover:-translate-y-1 ${tier.isPopular ? "bg-gradient-to-b from-purple-900/50 to-indigo-900/30 border border-purple-500/50 shadow-2xl shadow-purple-500/20" : "glass"}`}>
                  {tier.isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-xs font-bold px-4 py-1 rounded-full">Most Popular</span>
                  )}
                  <p className="font-semibold text-sm text-zinc-500 uppercase tracking-wider mb-2">{tier.name}</p>
                  <p className="text-4xl font-black mb-1">
                    {formatCurrency(Number(tier.price)/100, tier.currency)}
                  </p>
                  <p className="text-zinc-500 text-sm mb-6">/{tier.interval === "MONTHLY" ? "month" : tier.interval === "YEARLY" ? "year" : "once"}</p>
                  <ul className="space-y-3 mb-7">
                    {tf.map((f,i)=>(
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className="text-emerald-400 mt-0.5">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/checkout?tierId=${tier.id}&product=${slug}`}>
                    <button className={`w-full py-3 rounded-xl font-bold transition-all hover:scale-105 ${tier.isPopular ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white" : "glass text-white hover:border-purple-500/50"}`}>
                      Get Started
                    </button>
                  </Link>
                </div>
              )
            })}
          </div>
        </section>

        {/* Reviews */}
        {product.reviews.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-black mb-8">Customer Reviews</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.reviews.map((review) => (
                <div key={review.id} className="glass rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold shrink-0">
                      {(review.user.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{review.user.name ?? "Anonymous"}</span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s=>(
                            <span key={s} className={`text-xs ${review.rating >= s ? "text-amber-400" : "text-zinc-700"}`}>★</span>
                          ))}
                        </div>
                      </div>
                      {review.title && <p className="font-medium text-sm mb-1">{review.title}</p>}
                      <p className="text-sm text-zinc-500">{review.body}</p>
                      <p className="text-xs text-zinc-700 mt-2">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section>
            <h2 className="text-3xl font-black mb-8">You might also like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {related.map(p=>(
                <Link key={p.id} href={`/marketplace/${p.slug}`}>
                  <div className="glass rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:border-purple-500/40 group">
                    <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                      {p.thumbnailUrl ? (
                        <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40" />
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-bold group-hover:text-purple-300 transition-colors">{p.name}</p>
                      {p.tiers[0] && (
                        <p className="text-sm text-zinc-500 mt-1">From ${Number(p.tiers[0].price)/100}/mo</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
