"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number // percentage change
  prefix?: string
  suffix?: string
  loading?: boolean
  className?: string
  icon?: React.ReactNode
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  prefix = "",
  suffix = "",
  loading = false,
  className,
  icon,
}: KpiCardProps) {
  const trendPositive = trend !== undefined && trend > 0
  const trendNegative = trend !== undefined && trend < 0
  const trendNeutral = trend !== undefined && trend === 0

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md",
        className
      )}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate uppercase tracking-wide">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {loading ? (
              <span className="inline-block h-7 w-24 rounded bg-muted animate-pulse" />
            ) : (
              <>
                {prefix}
                {typeof value === "number" ? value.toLocaleString() : value}
                {suffix}
              </>
            )}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
            {icon}
          </div>
        )}
      </div>
      {trend !== undefined && !loading && (
        <div
          className={cn(
            "mt-3 flex items-center gap-1 text-xs font-medium",
            trendPositive && "text-emerald-600 dark:text-emerald-400",
            trendNegative && "text-red-600 dark:text-red-400",
            trendNeutral && "text-muted-foreground"
          )}
        >
          {trendPositive && <TrendingUp className="h-3.5 w-3.5" />}
          {trendNegative && <TrendingDown className="h-3.5 w-3.5" />}
          {trendNeutral && <Minus className="h-3.5 w-3.5" />}
          <span>
            {trendPositive ? "+" : ""}
            {trend.toFixed(1)}% vs last period
          </span>
        </div>
      )}
    </div>
  )
}
