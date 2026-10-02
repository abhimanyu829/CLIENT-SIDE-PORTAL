"use client"
import { useDashboardStore, type DashStats } from "@/hooks/useDashboardStore"

interface StatCardProps {
  label: string
  sub: string
  icon: string
  /** Icon colour, e.g. "text-primary". */
  color: string
  /** Soft background behind the icon, e.g. "bg-primary/10". */
  tint: string
  /** Optional link: the whole card opens the related page. */
  href?: string
  index: number
  statKey: "activeSubs" | "aiTokensUsed" | "openTickets" | "monthlySpend"
  /** When set, a usage bar shows the value against this limit from the stats. */
  limitKey?: keyof DashStats
  formatter?: (val: number) => string
}

export default function LiveMetricCard({ label, sub, icon, color, tint, href, index, statKey, limitKey, formatter }: StatCardProps) {
  const { stats } = useDashboardStore()
  const loaded = stats !== null && typeof stats[statKey] === "number"
  const value = loaded ? stats[statKey] : 0
  const limit = loaded && limitKey ? Number(stats[limitKey]) : 0
  const percent = limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : null

  const displayValue = formatter ? formatter(value) : value.toLocaleString()

  const body = (
    <>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug">{label}</p>
        <span aria-hidden="true" className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-sm sm:text-base ${tint} ${color}`}>
          {icon}
        </span>
      </div>

      {loaded ? (
        <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-foreground truncate" title={displayValue}>{displayValue}</p>
      ) : (
        <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-muted" aria-label="Loading" />
      )}

      {percent !== null ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${percent}% of limit`}>
            <div className={`h-full rounded-full transition-all duration-700 ${percent >= 90 ? "bg-red-500" : "bg-primary"}`} style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {percent}% of {limit.toLocaleString()} · {sub}
          </p>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      )}
    </>
  )

  const className =
    "block min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md animate-in fade-in slide-in-from-bottom-2 fill-mode-both"

  return href ? (
    <a href={href} className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} style={{ animationDelay: `${index * 60}ms` }}>
      {body}
    </a>
  ) : (
    <div className={className} style={{ animationDelay: `${index * 60}ms` }}>
      {body}
    </div>
  )
}
