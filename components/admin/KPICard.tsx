"use client"

interface KPICardProps {
  title: string
  value: string | number
  sub?: string
  icon?: string
  trend?: { value: number; label: string }
  color?: "default" | "green" | "blue" | "purple" | "red" | "orange"
  loading?: boolean
}

const colorMap: Record<string, string> = {
  default: "from-zinc-500/10 to-zinc-400/5 border-zinc-200 dark:border-zinc-700",
  green: "from-emerald-500/10 to-emerald-400/5 border-emerald-200 dark:border-emerald-700",
  blue: "from-blue-500/10 to-blue-400/5 border-blue-200 dark:border-blue-700",
  purple: "from-violet-500/10 to-violet-400/5 border-violet-200 dark:border-violet-700",
  red: "from-rose-500/10 to-rose-400/5 border-rose-200 dark:border-rose-700",
  orange: "from-orange-500/10 to-orange-400/5 border-orange-200 dark:border-orange-700",
}

const trendColor = (v: number) =>
  v > 0 ? "text-emerald-600" : v < 0 ? "text-rose-500" : "text-muted-foreground"

export function KPICard({ title, value, sub, icon, trend, color = "default", loading }: KPICardProps) {
  if (loading) {
    return (
      <div className="relative border rounded-2xl p-5 bg-gradient-to-br from-muted/40 to-muted/10 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-8 w-32 bg-muted rounded mb-2" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div
      className={`relative border rounded-2xl p-5 bg-gradient-to-br shadow-sm hover:shadow-md transition-shadow ${colorMap[color]}`}
    >
      {icon && (
        <span className="absolute top-4 right-4 text-2xl opacity-60 select-none">{icon}</span>
      )}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {trend && (
        <p className={`text-xs font-medium mt-2 ${trendColor(trend.value)}`}>
          {trend.value > 0 ? "▲" : trend.value < 0 ? "▼" : "—"} {Math.abs(trend.value)}%{" "}
          <span className="text-muted-foreground font-normal">{trend.label}</span>
        </p>
      )}
    </div>
  )
}
