"use client"
import { useEffect, useRef } from "react"
import { useDashboardStore } from "@/hooks/useDashboardStore"

export default function ActivityFeed() {
  const { activities, setActivities } = useDashboardStore()
  const isFetching = useRef(false)

  const fetchActivities = async () => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      const res = await fetch("/api/dashboard/activity")
      if (res.ok) {
        const { data } = await res.json()
        setActivities(data || [])
      }
    } catch {
    } finally {
      isFetching.current = false
    }
  }

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 30_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  const relTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    if (diff < 60_000) return "just now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return `${Math.floor(diff / 86_400_000)}d ago`
  }

  return (
    <div className="bg-[#0e0e0e] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <p className="font-bold text-sm">Recent Activity</p>
        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[10px] text-zinc-500">Live</span>
        </div>
      </div>
      <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {activities.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-600">No recent activity</div>
        ) : (
          activities.map((a: any) => (
            <div key={a.id} className="px-4 py-3 flex gap-3 hover:bg-white/5 transition-all">
              <span className="text-base shrink-0">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{a.title}</p>
                <p className="text-[11px] text-zinc-500 truncate">{a.desc}</p>
              </div>
              <span className="text-[10px] text-zinc-600 shrink-0">{relTime(a.time)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
