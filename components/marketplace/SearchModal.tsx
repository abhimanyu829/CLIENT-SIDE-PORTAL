"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

interface SearchResult {
  id: string
  slug: string
  name: string
  tagline?: string | null
  type: string
  thumbnailUrl?: string | null
  startingPrice?: number | null
}

interface SearchResponse {
  products: SearchResult[]
  agents: SearchResult[]
}

const TYPE_ICONS: Record<string, string> = {
  AI_AGENT: "🤖", SAAS: "⚡", API: "🔗", AUTOMATION: "⚙️",
  WEBSITE: "🌐", DIGITAL: "💾", AI_TOOL: "🧠", ENTERPRISE: "🏢",
}

const QUICK_LINKS = [
  { label: "Browse Marketplace", href: "/marketplace", icon: "🛒" },
  { label: "AI Agents Store", href: "/ai-agents", icon: "🤖" },
  { label: "View Pricing", href: "/pricing", icon: "💰" },
  { label: "Try Live Demo", href: "/demo", icon: "▶️" },
]

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Load recent searches
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("nx_recent_searches") || "[]")
      setRecentSearches(stored.slice(0, 5))
    } catch {}
    inputRef.current?.focus()
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=6`)
        if (r.ok) setResults(await r.json())
      } catch {}
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const saveRecent = useCallback((q: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem("nx_recent_searches") || "[]") as string[]
      const updated = [q, ...existing.filter(s => s !== q)].slice(0, 5)
      localStorage.setItem("nx_recent_searches", JSON.stringify(updated))
    } catch {}
  }, [])

  const navigate = useCallback((href: string) => {
    if (query.trim()) saveRecent(query.trim())
    onClose()
    router.push(href)
  }, [query, router, onClose, saveRecent])

  const allResults = [
    ...(results?.products || []),
    ...(results?.agents || []),
  ]

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allResults.length - 1)) }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)) }
      if (e.key === "Enter" && selectedIdx >= 0 && allResults[selectedIdx]) {
        navigate(`/marketplace/${allResults[selectedIdx].slug}`)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [selectedIdx, allResults, navigate, onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl glass rounded-2xl shadow-2xl shadow-black/60 overflow-hidden border border-white/10 animate-in slide-in-from-top-4 duration-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <span className="text-zinc-500 text-lg">
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-purple-500/50 border-t-purple-500 rounded-full animate-spin" />
            ) : "🔍"}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(-1) }}
            placeholder="Search products, AI agents, tools..."
            className="flex-1 bg-transparent text-white placeholder-zinc-600 outline-none text-base"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-zinc-600 hover:text-white text-sm">✕</button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 glass text-[10px] text-zinc-600 px-2 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query && (
            <div className="p-4">
              {recentSearches.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 px-2">Recent Searches</p>
                  {recentSearches.map(s => (
                    <button key={s} onClick={() => setQuery(s)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-left">
                      <span>🕐</span> {s}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 px-2">Quick Navigate</p>
              {QUICK_LINKS.map(l => (
                <button key={l.href} onClick={() => navigate(l.href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-left">
                  <span>{l.icon}</span> {l.label}
                  <span className="ml-auto text-zinc-700">→</span>
                </button>
              ))}
            </div>
          )}

          {query && results && (results.products.length > 0 || results.agents.length > 0) && (
            <div className="p-3">
              {results.products.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 px-2">Products</p>
                  {results.products.map((r, idx) => (
                    <button key={r.id} onClick={() => navigate(`/marketplace/${r.slug}`)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${selectedIdx === idx ? "bg-purple-500/20 border border-purple-500/30" : "hover:bg-white/5"}`}>
                      <div className="w-9 h-9 rounded-lg bg-zinc-900 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg">
                        {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt={r.name} className="w-full h-full object-cover" /> : (TYPE_ICONS[r.type] || "⚡")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white line-clamp-1">{r.name}</p>
                        <p className="text-xs text-zinc-600 line-clamp-1">{r.tagline}</p>
                      </div>
                      {r.startingPrice && (
                        <span className="text-xs text-emerald-400 font-medium flex-shrink-0">${r.startingPrice}/mo</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {results.agents.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 px-2">AI Agents</p>
                  {results.agents.map((r, idx) => (
                    <button key={r.id} onClick={() => navigate(`/marketplace/${r.slug}`)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${selectedIdx === results.products.length + idx ? "bg-purple-500/20 border border-purple-500/30" : "hover:bg-white/5"}`}>
                      <div className="w-9 h-9 rounded-lg bg-zinc-900 flex-shrink-0 flex items-center justify-center text-lg">
                        {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt={r.name} className="w-full h-full object-cover rounded-lg" /> : "🤖"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white line-clamp-1">{r.name}</p>
                        <p className="text-xs text-zinc-600 line-clamp-1">{r.tagline}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {query && results && results.products.length === 0 && results.agents.length === 0 && !loading && (
            <div className="p-8 text-center">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-zinc-500 text-sm">No results for <span className="text-zinc-300">"{query}"</span></p>
              <button onClick={() => navigate(`/marketplace?q=${encodeURIComponent(query)}`)}
                className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                Browse all products →
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-4 text-[10px] text-zinc-700">
            <span><kbd className="glass px-1.5 py-0.5 rounded text-[9px]">↑↓</kbd> Navigate</span>
            <span><kbd className="glass px-1.5 py-0.5 rounded text-[9px]">↵</kbd> Select</span>
            <span><kbd className="glass px-1.5 py-0.5 rounded text-[9px]">ESC</kbd> Close</span>
          </div>
          <button onClick={() => navigate("/marketplace")} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
            View all products →
          </button>
        </div>
      </div>
    </div>
  )
}
