"use client"

/**
 * components/demo/AnalyticsDemo.tsx
 * Interactive analytics demonstration using a SYNTHETIC monthly dataset held
 * in this component. Filters genuinely change the displayed dataset. No real
 * customer, revenue, or usage data is shown, and nothing is exported.
 */
import { useMemo, useState } from "react"

interface MonthPoint {
  month: string
  visits: number
  signups: number
  conversions: number
  revenue: number
}

const DATASET: MonthPoint[] = [
  { month: "2026-01", visits: 8200, signups: 410, conversions: 96, revenue: 182000 },
  { month: "2026-02", visits: 9100, signups: 468, conversions: 104, revenue: 214000 },
  { month: "2026-03", visits: 10400, signups: 512, conversions: 118, revenue: 246000 },
  { month: "2026-04", visits: 9900, signups: 486, conversions: 109, revenue: 231000 },
  { month: "2026-05", visits: 11800, signups: 570, conversions: 132, revenue: 289000 },
  { month: "2026-06", visits: 12600, signups: 611, conversions: 141, revenue: 318000 },
  { month: "2026-07", visits: 12100, signups: 588, conversions: 134, revenue: 302000 },
  { month: "2026-08", visits: 13400, signups: 642, conversions: 149, revenue: 341000 },
  { month: "2026-09", visits: 14200, signups: 690, conversions: 158, revenue: 372000 },
]

type MetricKey = "visits" | "signups" | "conversions" | "revenue"
const METRICS: Array<{ key: MetricKey; label: string; unit: string; explain: string }> = [
  { key: "visits", label: "Visits", unit: "sessions", explain: "Sessions recorded in the period — the top of the funnel." },
  { key: "signups", label: "Signups", unit: "accounts", explain: "Accounts created in the period." },
  { key: "conversions", label: "Conversions", unit: "orders", explain: "Completed purchases in the period." },
  { key: "revenue", label: "Revenue", unit: "INR", explain: "Recorded order value in the period, in INR." },
]

const fmt = (key: MetricKey, n: number) =>
  key === "revenue"
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
    : n.toLocaleString()

export function AnalyticsDemo() {
  const [metric, setMetric] = useState<MetricKey>("conversions")
  const [range, setRange] = useState<"3" | "6" | "9">("9")

  const points = useMemo(() => DATASET.slice(-Number(range)), [range])
  const values = points.map((p) => p[metric])
  const max = Math.max(...values)
  const min = Math.min(...values)
  const latest = points[points.length - 1]
  const previous = points[points.length - 2]
  const delta = previous ? ((latest[metric] - previous[metric]) / previous[metric]) * 100 : 0
  const total = values.reduce((s, v) => s + v, 0)
  const active = METRICS.find((m) => m.key === metric)!

  // Sparkline path (SVG, no chart dependency).
  const width = 640
  const height = 180
  const pad = 24
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0
  const span = max - min || 1
  const path = points
    .map((p, i) => {
      const x = pad + i * stepX
      const y = height - pad - ((p[metric] - min) / span) * (height - pad * 2)
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
        Demonstration dataset — synthetic values generated for this page. They are not Abhibhideveloper&apos;s
        actual traffic, revenue, or usage figures, and they are not read from the production database.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Choose metric" className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${metric === m.key ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200" : "border-border text-muted-foreground hover:bg-accent/10"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label className="ml-auto text-xs text-muted-foreground">
          Range:{" "}
          <select value={range} onChange={(e) => setRange(e.target.value as "3" | "6" | "9")}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs" aria-label="Date range">
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="9">Last 9 months</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Latest — {latest.month}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(metric, latest[metric])}</p>
          <p className={`text-xs ${delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs previous month
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total in range</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(metric, total)}</p>
          <p className="text-xs text-muted-foreground">{points.length} months shown</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">What this metric means</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{active.explain} Unit: {active.unit}.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{active.label} trend (synthetic)</h3>
        <svg
          role="img"
          aria-label={`Line chart of synthetic ${active.label.toLowerCase()} over the last ${points.length} months`}
          viewBox={`0 0 ${width} ${height}`}
          className="mt-3 w-full"
          preserveAspectRatio="none"
        >
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" strokeOpacity="0.15" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="currentColor" strokeOpacity="0.15" />
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400" />
          {points.map((p, i) => {
            const x = pad + i * stepX
            const y = height - pad - ((p[metric] - min) / span) * (height - pad * 2)
            return <circle key={p.month} cx={x} cy={y} r="3.5" className="fill-indigo-300" />
          })}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          {points.map((p) => <span key={p.month}>{p.month.slice(5)}</span>)}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Y-axis scales to the visible range (min–max) for readability; exact values are listed in the table below.
          Export and drill-down are not offered in this demonstration.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Synthetic monthly analytics data used by this demonstration</caption>
          <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">Month</th>
              {METRICS.map((m) => <th key={m.key} scope="col" className="px-4 py-3">{m.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {points.map((p) => (
              <tr key={p.month} className={metric === "revenue" ? "" : ""}>
                <td className="px-4 py-2.5 font-mono text-xs">{p.month}</td>
                {METRICS.map((m) => (
                  <td key={m.key} className={`px-4 py-2.5 tabular-nums ${m.key === metric ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {fmt(m.key, p[m.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}