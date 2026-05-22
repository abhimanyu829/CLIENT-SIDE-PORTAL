"use client"
import { useEffect, useState } from "react"
import { useDashboardStore } from "@/hooks/useDashboardStore"

interface StatCardProps {
  label: string
  sub: string
  icon: string
  color: string
  border: string
  glow: string
  index: number
  statKey: 'activeSubs' | 'aiTokensUsed' | 'openTickets' | 'monthlySpend'
  formatter?: (val: number) => string
}

export default function LiveMetricCard({ label, sub, icon, color, border, glow, index, statKey, formatter }: StatCardProps) {
  const { stats } = useDashboardStore()
  const [value, setValue] = useState<number>(0)
  
  useEffect(() => {
    if (stats && typeof stats[statKey] === 'number') {
      setValue(stats[statKey])
    }
  }, [stats, statKey])

  const displayValue = formatter ? formatter(value) : value.toLocaleString()

  return (
    <div 
      className={`bg-white/[0.03] backdrop-blur-xl rounded-2xl p-5 border ${border} transition-all duration-300 hover:-translate-y-1 hover:border-white/10`} 
      style={{ animationDelay: `${index * 0.06}s`, boxShadow: `0 0 30px ${glow}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-zinc-400 font-medium">{label}</span>
        <span className={`text-lg ${color}`}>{icon}</span>
      </div>
      <p className="text-3xl font-black mb-1">{displayValue}</p>
      <p className="text-xs text-zinc-600">{sub}</p>
    </div>
  )
}
