"use client"
import { useEffect, useRef } from "react"
import LiveMetricCard from "@/components/dashboard/LiveMetricCard"
import ActivityFeed from "@/components/dashboard/ActivityFeed"
import { useDashboardStore } from "@/hooks/useDashboardStore"

export default function DashboardOverview() {
  const { setStats } = useDashboardStore()
  const isFetching = useRef(false)

  const fetchStats = async () => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      const res = await fetch("/api/dashboard/stats")
      if (res.ok) {
        const { data } = await res.json()
        if (data) setStats(data)
      }
    } catch {
    } finally {
      isFetching.current = false
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  return (
    <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-zinc-500 mt-1">Real-time metrics and activity across your account.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LiveMetricCard 
          index={0} 
          label="Active Subscriptions" 
          sub="Across all services" 
          icon="⬡" 
          color="text-blue-400" 
          border="border-blue-500/20" 
          glow="rgba(59,130,246,0.05)" 
          statKey="activeSubs" 
        />
        <LiveMetricCard 
          index={1} 
          label="AI Usage" 
          sub="Tokens this month" 
          icon="✦" 
          color="text-purple-400" 
          border="border-purple-500/20" 
          glow="rgba(168,85,247,0.05)" 
          statKey="aiTokensUsed" 
        />
        <LiveMetricCard 
          index={2} 
          label="Open Tickets" 
          sub="Requires attention" 
          icon="🎫" 
          color="text-amber-400" 
          border="border-amber-500/20" 
          glow="rgba(245,158,11,0.05)" 
          statKey="openTickets" 
        />
        <LiveMetricCard 
          index={3} 
          label="Monthly Spend" 
          sub="Current billing cycle" 
          icon="💳" 
          color="text-emerald-400" 
          border="border-emerald-500/20" 
          glow="rgba(16,185,129,0.05)" 
          statKey="monthlySpend" 
          formatter={(v) => `$${v.toFixed(2)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 dash-glass rounded-2xl p-6 border-white/5 min-h-[300px] flex items-center justify-center">
          <div className="text-center">
            <span className="text-4xl">📈</span>
            <h3 className="text-sm font-medium mt-3">Usage Analytics</h3>
            <p className="text-xs text-zinc-500 mt-1">Detailed charts are being generated.</p>
          </div>
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
