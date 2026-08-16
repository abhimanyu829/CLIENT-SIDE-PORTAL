"use client"

import { useState, useMemo, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import ProductCard, { type ProductCardProps } from "@/components/marketplace/ProductCard"

const CATEGORIES = [
  { label: "All Agents", value: "ALL" },
  { label: "💻 Coding", value: "coding" },
  { label: "🔬 Research", value: "research" },
  { label: "✍️ Writing", value: "writing" },
  { label: "📣 Marketing", value: "marketing" },
  { label: "📊 Analytics", value: "analytics" },
  { label: "💬 Support", value: "support" },
  { label: "💰 Finance", value: "finance" },
  { label: "🎓 Education", value: "education" },
  { label: "⚙️ Automation", value: "automation" },
  { label: "🏢 Enterprise", value: "enterprise" },
]

const S = `
.glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}
.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);transition:all .2s}
.filter-chip{border:1px solid #d4d4d8;background:#f4f4f5;border-radius:9999px;padding:.375rem 1rem;font-size:.8125rem;font-weight:600;transition:all .2s;cursor:pointer;color:#27272a!important}
.filter-chip:hover{border-color:#a1a1aa;background:#e4e4e7;color:#09090b!important}
.filter-chip-active{background:#7c3aed!important;border-color:#6d28d9!important;color:#ffffff!important;font-weight:700!important}
.section-label{font-size:.7rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
`

interface AgentCardData extends ProductCardProps {
  techStack?: string[]
  limits?: Record<string, any> | null
  createdAt?: string
}

export default function AIAgentsClient({ agents }: { agents: AgentCardData[] }) {
  const [activeCategory, setActiveCategory] = useState("ALL")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("popular")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handlePreview = useCallback(async (productId: string) => {
    try {
      const res = await fetch("/api/demos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      if (res.status === 401) {
        router.push(`/login?callbackUrl=/ai-agents?preview=${productId}`)
        return
      }
      const data = await res.json()
      if (!res.ok) { alert(data.error || "Preview unavailable"); return }
      router.push(`/demo/${data.sessionId}?token=${data.sessionToken}`)
    } catch { alert("Failed to start preview.") }
  }, [router])

  const handleAddToCart = useCallback(async (productId: string, tierId?: string) => {
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, tierId, quantity: 1 }),
      })
      if (res.status === 401) { router.push("/login?callbackUrl=/ai-agents"); return }
      if (!res.ok) { const d = await res.json(); alert(d.error || "Failed to add to cart"); return }
      router.push("/cart")
    } catch { alert("Failed to add to cart.") }
  }, [router])

  const filtered = useMemo(() => {
    let list = [...agents]

    // Category filter — match against tags, category, or name
    if (activeCategory !== "ALL") {
      list = list.filter(a =>
        (a.category || "").toLowerCase().includes(activeCategory) ||
        (a.tags || []).some(t => t.toLowerCase().includes(activeCategory)) ||
        a.name.toLowerCase().includes(activeCategory)
      )
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.tagline || "").toLowerCase().includes(q) ||
        (a.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (a.techStack || []).some(t => t.toLowerCase().includes(q))
      )
    }

    // Sort
    switch (sortBy) {
      case "rating": list.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break
      case "newest": list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()); break
      case "price_asc": list.sort((a, b) => (a.startingPrice || 0) - (b.startingPrice || 0)); break
      default: list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    }

    return list
  }, [agents, activeCategory, search, sortBy])

  return (
    <div className="py-12 px-4">
      <style>{S}</style>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="section-label mb-1">🤖 All Agents</p>
            <h2 className="text-2xl font-black">{filtered.length} Agent{filtered.length !== 1 ? "s" : ""} Available</h2>
          </div>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={e => startTransition(() => setSearch(e.target.value))}
              placeholder="Search agents..."
              className="bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-violet-500 transition-all w-48 shadow-2xs"
            />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-800 outline-none cursor-pointer shadow-2xs">
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Lowest Price</option>
            </select>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-10">
          {CATEGORIES.map(c => (
            <button key={c.value}
              onClick={() => startTransition(() => setActiveCategory(c.value))}
              className={`filter-chip ${activeCategory === c.value ? "filter-chip-active" : ""}`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(agent => (
              <div key={agent.id} className="relative">
                <ProductCard {...agent} variant="grid" previewEnabled={!!agent.demoUrl} onPreview={() => handlePreview(agent.id)} onAddToCart={() => handleAddToCart(agent.id, agent.tierId)} />
                {/* Agent-specific overlay info */}
                {(agent.techStack?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 px-1">
                    {(agent.techStack || []).slice(0, 2).map(t => (
                      <span key={t} className="bg-zinc-100 border border-zinc-200 text-[10px] font-bold px-2 py-0.5 rounded-full text-zinc-700">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-bold mb-2">No agents found</h3>
            <p className="text-zinc-600 mb-6">Try a different category or search query</p>
            <button onClick={() => { setActiveCategory("ALL"); setSearch("") }}
              className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 px-6 py-3 rounded-xl text-sm font-bold text-zinc-800 hover:text-zinc-900 transition-all shadow-2xs">
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
