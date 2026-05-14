"use client"

import { Button } from "@/components/ui/button"

export interface ProductFilterValues {
  category: string
  minPrice: number
  maxPrice: number
  sort: string
  features: string[]
}

interface ProductFiltersProps {
  filters: ProductFilterValues
  onChange: (filters: ProductFilterValues) => void
  categories: string[]
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "rating", label: "Top Rated" },
]

const FEATURE_OPTIONS = ["API Access", "White-label", "Custom Domain", "Priority Support", "SSO"]

export function ProductFilters({ filters, onChange, categories }: ProductFiltersProps) {
  const set = <K extends keyof ProductFilterValues>(key: K, value: ProductFilterValues[K]) =>
    onChange({ ...filters, [key]: value })

  const toggleFeature = (feat: string) => {
    const has = filters.features.includes(feat)
    set("features", has ? filters.features.filter((f) => f !== feat) : [...filters.features, feat])
  }

  const hasActiveFilters =
    filters.category !== "" ||
    filters.minPrice > 0 ||
    filters.maxPrice < 500 ||
    filters.features.length > 0

  const reset = () =>
    onChange({ category: "", minPrice: 0, maxPrice: 500, sort: "newest", features: [] })

  return (
    <aside className="space-y-6">
      {/* Sort */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Sort By
        </p>
        <div className="flex flex-col gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("sort", opt.value)}
              className={`text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                filters.sort === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Category
        </p>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => set("category", "")}
            className={`text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
              filters.category === ""
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => set("category", cat)}
              className={`text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                filters.category === cat
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Price Range
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={filters.maxPrice}
            value={filters.minPrice}
            onChange={(e) => set("minPrice", Number(e.target.value))}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background"
            placeholder="Min"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <input
            type="number"
            min={filters.minPrice}
            max={10000}
            value={filters.maxPrice}
            onChange={(e) => set("maxPrice", Number(e.target.value))}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-background"
            placeholder="Max"
          />
        </div>
      </div>

      {/* Features */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Features
        </p>
        <div className="flex flex-col gap-1.5">
          {FEATURE_OPTIONS.map((feat) => (
            <label key={feat} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.features.includes(feat)}
                onChange={() => toggleFeature(feat)}
                className="rounded accent-primary"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {feat}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={reset}>
          Clear Filters
        </Button>
      )}
    </aside>
  )
}
