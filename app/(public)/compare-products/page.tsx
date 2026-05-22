import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"
import Link from "next/link"
import { Metadata } from "next"
import { CallToAction } from "@/components/public/CallToAction"

interface Props { searchParams: Promise<{ products?: string }> }

export const metadata: Metadata = {
  title: "Compare Products — NexusAI",
  description: "Side-by-side comparison of AI products, SaaS tools, and developer solutions on NexusAI.",
}

export default async function ComparePage({ searchParams }: Props) {
  const { products: productSlugs } = await searchParams
  const slugs = productSlugs ? productSlugs.split(",").slice(0, 3) : []

  const products = slugs.length > 0 ? await db.product.findMany({
    where: { slug: { in: slugs }, status: ProductStatus.PUBLISHED },
    include: { tiers: { orderBy: { price: "asc" } }, _count: { select: { reviews: true, subscriptions: true } } },
  }) : []

  // Reorder to match slug order
  const ordered = slugs.map(s => products.find(p => p.slug === s)).filter(Boolean) as typeof products

  const featureKeys = new Set<string>()
  ordered.forEach(p => {
    if (Array.isArray(p.features)) {
      (p.features as string[]).forEach(f => featureKeys.add(f.slice(0, 40)))
    }
  })

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}
        .text-gradient{background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);transition:all .2s}
        td,th{padding:.875rem 1rem;border-bottom:1px solid rgba(255,255,255,.05)}
        th{font-size:.75rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.1em;white-space:nowrap}
        tr:last-child td{border-bottom:none}
      `}</style>

      {/* Header */}
      <section className="py-16 px-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-black mb-4">Compare <span className="text-gradient">Products</span></h1>
          <p className="text-zinc-500 mb-8">Side-by-side comparison to help you choose the right tool</p>
          <p className="text-sm text-zinc-600">
            Add products to compare by visiting their page or using the URL: <code className="glass px-2 py-1 rounded text-xs text-zinc-400">/compare?products=slug1,slug2,slug3</code>
          </p>
        </div>
      </section>

      {ordered.length === 0 ? (
        <div className="max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="text-5xl mb-4">⚖️</div>
          <h2 className="text-2xl font-black mb-4">No products selected</h2>
          <p className="text-zinc-500 mb-8">Add products to compare by visiting their product pages</p>
          <Link href="/marketplace">
            <button className="btn-primary px-8 py-4 rounded-xl text-white font-bold">Browse Marketplace →</button>
          </Link>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            {/* Product headers */}
            <thead>
              <tr>
                <th className="w-48 text-left">Feature</th>
                {ordered.map(p => (
                  <th key={p.id} className="text-center">
                    <div className="flex flex-col items-center gap-3 pb-2">
                      {p.thumbnailUrl && (
                        <img src={p.thumbnailUrl} alt={p.name} className="w-16 h-12 object-cover rounded-xl" />
                      )}
                      <Link href={`/marketplace/${p.slug}`} className="text-white font-black text-base hover:text-purple-300 transition-colors">
                        {p.name}
                      </Link>
                      <p className="text-zinc-600 text-xs font-normal">{p.tagline?.slice(0, 60)}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Price row */}
              <tr className="bg-white/[0.015]">
                <td className="text-zinc-500 text-sm font-semibold">Starting Price</td>
                {ordered.map(p => {
                  const tier = p.tiers[0]
                  return (
                    <td key={p.id} className="text-center">
                      {tier ? (
                        <span className="font-black text-emerald-400">
                          ${Number(tier.price).toFixed(0)}
                          <span className="text-zinc-600 font-normal text-xs">/{tier.interval === "MONTHLY" ? "mo" : tier.interval === "YEARLY" ? "yr" : "once"}</span>
                        </span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                  )
                })}
              </tr>

              {/* Rating */}
              <tr>
                <td className="text-zinc-500 text-sm font-semibold">Rating</td>
                {ordered.map(p => (
                  <td key={p.id} className="text-center">
                    {p.averageRating > 0 ? (
                      <span className="text-amber-400 font-bold">★ {p.averageRating.toFixed(1)}</span>
                    ) : <span className="text-zinc-700">No ratings</span>}
                  </td>
                ))}
              </tr>

              {/* Reviews */}
              <tr className="bg-white/[0.015]">
                <td className="text-zinc-500 text-sm font-semibold">Reviews</td>
                {ordered.map(p => (
                  <td key={p.id} className="text-center text-zinc-400">{p._count.reviews}</td>
                ))}
              </tr>

              {/* Active users */}
              <tr>
                <td className="text-zinc-500 text-sm font-semibold">Active Users</td>
                {ordered.map(p => (
                  <td key={p.id} className="text-center text-zinc-400">{p._count.subscriptions.toLocaleString()}</td>
                ))}
              </tr>

              {/* Type */}
              <tr className="bg-white/[0.015]">
                <td className="text-zinc-500 text-sm font-semibold">Type</td>
                {ordered.map(p => (
                  <td key={p.id} className="text-center">
                    <span className="glass text-xs px-2.5 py-1 rounded-full text-zinc-400">{p.type.replace("_", " ")}</span>
                  </td>
                ))}
              </tr>

              {/* Trial */}
              <tr>
                <td className="text-zinc-500 text-sm font-semibold">Free Trial</td>
                {ordered.map(p => {
                  const trial = p.tiers[0]?.trialDays || 0
                  return (
                    <td key={p.id} className="text-center">
                      {trial > 0 ? <span className="text-emerald-400 font-semibold">✓ {trial} days</span> : <span className="text-zinc-700">✗</span>}
                    </td>
                  )
                })}
              </tr>

              {/* Features section header */}
              <tr>
                <td colSpan={ordered.length + 1} className="text-xs font-black text-zinc-600 uppercase tracking-widest pt-8 pb-2">Included Features</td>
              </tr>

              {/* Feature rows */}
              {Array.from(featureKeys).slice(0, 12).map((f, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white/[0.015]" : ""}>
                  <td className="text-zinc-500 text-sm">{f}</td>
                  {ordered.map(p => {
                    const has = Array.isArray(p.features) && (p.features as string[]).some(pf => pf.slice(0, 40) === f)
                    return (
                      <td key={p.id} className="text-center">
                        {has ? <span className="text-emerald-400 text-lg">✓</span> : <span className="text-zinc-800 text-lg">—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* CTA row */}
              <tr>
                <td className="pt-6 pb-4"></td>
                {ordered.map(p => (
                  <td key={p.id} className="text-center pt-6 pb-4">
                    <Link href={`/marketplace/${p.slug}`}>
                      <button className="btn-primary px-6 py-3 rounded-xl text-white font-bold text-sm w-full max-w-[180px]">
                        Get {p.name.split(" ")[0]} →
                      </button>
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          <div className="mt-8 text-center">
            <Link href="/marketplace">
              <button className="glass px-6 py-3 rounded-xl text-sm text-zinc-400 hover:text-white transition-all">
                ← Back to Marketplace
              </button>
            </Link>
          </div>
        </div>
      )}

      <CallToAction 
        title="Need a custom comparison?"
        description="Our sales engineering team can provide a detailed TCO and feature comparison tailored to your exact use-case."
        ctaText="Talk to Sales"
        ctaHref="/contact-sales"
      />
    </div>
  )
}
