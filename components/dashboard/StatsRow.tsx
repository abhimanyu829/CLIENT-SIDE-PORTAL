"use client"

interface Stat {
  label: string
  value: string | number
  icon?: string
  sub?: string
  trend?: number
}

interface StatsRowProps {
  stats: Stat[]
  loading?: boolean
}

const trendClass = (v?: number) =>
  v === undefined ? "" : v > 0 ? "text-emerald-600" : v < 0 ? "text-rose-500" : "text-muted-foreground"

export function StatsRow({ stats, loading }: StatsRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-4 bg-card animate-pulse">
            <div className="h-3 w-20 bg-muted rounded mb-3" />
            <div className="h-7 w-24 bg-muted rounded mb-2" />
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`grid gap-4 grid-cols-2 sm:grid-cols-${Math.min(stats.length, 4)}`}>
      {stats.map((stat, i) => (
        <div
          key={i}
          className="border rounded-xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            {stat.icon && <span className="text-xl opacity-50 select-none">{stat.icon}</span>}
          </div>
          <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {stat.sub && <p className="text-xs text-muted-foreground">{stat.sub}</p>}
            {stat.trend !== undefined && (
              <p className={`text-xs font-medium ${trendClass(stat.trend)}`}>
                {stat.trend > 0 ? "▲" : stat.trend < 0 ? "▼" : "—"} {Math.abs(stat.trend)}%
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
