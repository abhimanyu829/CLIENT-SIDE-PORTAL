"use client"

/**
 * components/public/CompareTable.tsx
 * Interactive comparison for REAL published products. Receives server-fetched
 * product data as props; no client-side fetching, no fabricated attributes.
 */
import { useMemo, useState } from "react"
import Link from "next/link"

export interface CompareProduct {
  id: string
  slug: string
  name: string
  tagline: string | null
  type: string
  category: string | null
  tags: string[]
  startingPrice: number | null
  currency: string | null
  billingInterval: string | null
  demoUrl: string | null
  reviewCount: number
  averageRating: number
}

const ROWS: Array<{ label: string; render: (p: CompareProduct) => string }> = [
  { label: "Type", render: (p) => p.type.replace(/_/g, " ").toLowerCase() },
  { label: "Category", render: (p) => p.category ?? "—" },
  { label: "Starting price", render: (p) => (p.startingPrice === null ? "See product page" : `${p.currency ?? ""} ${p.startingPrice.toLocaleString()}`.trim()) },
  { label: "Billing", render: (p) => (p.billingInterval ? p.billingInterval.replace(/_/g, " ").toLowerCase() : "One-time / see product page") },
  { label: "Tags", render: (p) => (p.tags.length ? p.tags.join(", ") : "—") },
  { label: "Public demo", render: (p) => (p.demoUrl ? "Available" : "Not published") },
]

export function CompareTable({ products }: { products: CompareProduct[] }) {
  const [selected, setSelected] = useState<string[]>(() => products.slice(0, 3).map((p) => p.id))
  const chosen = useMemo(() => products.filter((p) => selected.includes(p.id)), [products, selected])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id]))
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No published products are available for comparison right now. Browse the{" "}
        <Link href="/marketplace" className="text-primary hover:underline underline-offset-4">marketplace</Link> or{" "}
        <Link href="/contact" className="text-primary hover:underline underline-offset-4">request a custom solution</Link>.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select up to 3 products</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {products.map((p) => {
            const on = selected.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200" : "border-border text-muted-foreground hover:bg-accent/10"}`}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      </div>

      {chosen.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Select at least one product to compare published attributes.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Attribute</th>
                {chosen.map((p) => (
                  <th key={p.id} className="px-4 py-3">
                    <Link href={`/products/${p.slug}`} className="font-semibold text-foreground hover:text-primary">{p.name}</Link>
                    {p.tagline ? <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">{p.tagline}</p> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2.5 text-xs font-medium text-muted-foreground">{row.label}</td>
                  {chosen.map((p) => (
                    <td key={p.id} className="px-4 py-2.5 text-muted-foreground">{row.render(p)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-4 py-3 text-xs font-medium text-muted-foreground">Next step</td>
                {chosen.map((p) => (
                  <td key={p.id} className="px-4 py-3">
                    <Link href={`/products/${p.slug}`} className="text-xs font-semibold text-indigo-300 hover:text-indigo-200">View product →</Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}