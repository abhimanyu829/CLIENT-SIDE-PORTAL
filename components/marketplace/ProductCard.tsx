import Link from "next/link"

const S = `
.pc-glass{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:1.25rem;overflow:hidden;transition:all .3s ease}
.pc-glass:hover{border-color:rgba(255,255,255,.12);transform:translateY(-4px);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.pc-badge{font-size:.625rem;font-weight:900;padding:.25rem .625rem;border-radius:9999px;letter-spacing:.05em;text-transform:uppercase}
.pc-tag{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:.5rem;padding:.2rem .6rem;font-size:.7rem;color:rgba(255,255,255,.5)}
.pc-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.875rem;padding:.625rem 1.25rem;font-size:.8125rem;font-weight:700;color:#fff;width:100%;transition:all .2s;text-align:center;display:block}
.pc-btn:hover{opacity:.9;transform:scale(1.02)}
.pc-ghost-btn{border:1px solid rgba(255,255,255,.1);border-radius:.875rem;padding:.625rem 1.25rem;font-size:.8125rem;font-weight:600;color:rgba(255,255,255,.6);width:100%;transition:all .2s;text-align:center;display:block}
.pc-ghost-btn:hover{border-color:rgba(255,255,255,.2);color:#fff}
`

const CATEGORY_COLORS: Record<string, string> = {
  SAAS_PRODUCT: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  AI_AGENT:     "bg-purple-500/15 text-purple-400 border-purple-500/25",
  TEMPLATE:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  API:          "bg-amber-500/15 text-amber-400 border-amber-500/25",
  WORKFLOW:     "bg-red-500/15 text-red-400 border-red-500/25",
}
const CATEGORY_LABELS: Record<string, string> = {
  SAAS_PRODUCT: "SaaS",
  AI_AGENT:     "AI Agent",
  TEMPLATE:     "Template",
  API:          "API",
  WORKFLOW:     "Workflow",
}

interface ProductCardProps {
  id: string
  name: string
  slug: string
  tagline?: string
  description?: string
  type?: string
  category?: string
  tags?: string[]
  rating?: number
  reviewCount?: number
  viewCount?: number
  featured?: boolean
  href?: string
}

export function ProductCard({
  name, slug, tagline, description, type, category, tags = [], rating, reviewCount, viewCount, featured, href
}: ProductCardProps) {
  const catKey = type ?? category ?? "SAAS_PRODUCT"
  const catStyle = CATEGORY_COLORS[catKey] ?? CATEGORY_COLORS.SAAS_PRODUCT
  const catLabel = CATEGORY_LABELS[catKey] ?? catKey
  const detailHref = href ?? `/marketplace/${slug}`

  return (
    <div className="pc-glass">
      {/* Card Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Icon */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600/30 to-blue-600/20 border border-white/8 flex items-center justify-center text-xl shrink-0">
            {catKey === "AI_AGENT" ? "✦" : catKey === "TEMPLATE" ? "◻" : catKey === "API" ? "◈" : "⬡"}
          </div>
          <div className="flex items-center gap-2">
            <span className={`pc-badge border ${catStyle}`}>{catLabel}</span>
            {featured && <span className="pc-badge bg-amber-500/15 text-amber-400 border border-amber-500/25">Featured</span>}
          </div>
        </div>

        <h3 className="font-black text-base text-white mb-1 truncate">{name}</h3>
        {tagline && <p className="text-xs text-zinc-500 mb-2 line-clamp-1">{tagline}</p>}
        {description && <p className="text-sm text-zinc-600 line-clamp-2 leading-relaxed">{description}</p>}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map(t => (
              <span key={t} className="pc-tag">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          {rating !== undefined && (
            <span className="flex items-center gap-1">
              <span className="text-amber-400">★</span>
              <span className="font-bold text-zinc-400">{rating.toFixed(1)}</span>
              {reviewCount && <span>({reviewCount})</span>}
            </span>
          )}
          {viewCount && (
            <span>{viewCount.toLocaleString()} views</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 pt-2">
        <Link href={detailHref}>
          <button className="pc-btn">View Details →</button>
        </Link>
      </div>
    </div>
  )
}

export default ProductCard
