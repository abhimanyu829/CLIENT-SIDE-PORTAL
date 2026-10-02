"use client"
import { useEffect, useRef, useState } from "react"
import { useDashboardStore } from "@/hooks/useDashboardStore"

export default function ActivityFeed() {
  const { activities, setActivities } = useDashboardStore()
  const isFetching = useRef(false)
  const [loading, setLoading] = useState(true)

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
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 30_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  // Audit entries arrive as codes ("TICKET_CREATED"): show them as plain words.
  const readable = (title: string) =>
    /^[A-Z0-9_]+$/.test(title) ? title.charAt(0) + title.slice(1).toLowerCase().replace(/_/g, " ") : title

  const relTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    if (diff < 60_000) return "just now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return `${Math.floor(diff / 86_400_000)}d ago`
  }

  return (
    <section aria-labelledby="recent-activity-title" className="h-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 id="recent-activity-title" className="font-sans font-semibold text-sm text-foreground tracking-normal">Recent activity</h2>
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-medium text-muted-foreground">Live</span>
        </div>
      </div>
      <ul className="divide-y divide-border max-h-[340px] overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
        {loading && activities.length === 0 ? (
          [0, 1, 2, 3].map((i) => (
            <li key={i} className="px-5 py-3.5 flex gap-3" aria-hidden="true">
              <span className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="flex-1 space-y-2 pt-0.5">
                <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
                <span className="block h-2.5 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </li>
          ))
        ) : activities.length === 0 ? (
          <li className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Payments, tickets and account updates will show up here.</p>
          </li>
        ) : (
          activities.map((a: any) => (
            <li key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/60 transition-colors">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{readable(String(a.title ?? ""))}</p>
                {a.desc && <p className="text-xs text-muted-foreground truncate">{a.desc}</p>}
              </div>
              <time dateTime={a.time} className="text-[11px] text-muted-foreground shrink-0 pt-0.5 tabular-nums">{relTime(a.time)}</time>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
