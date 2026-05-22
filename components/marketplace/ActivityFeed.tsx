"use client"
import { useEffect, useRef, useState } from "react"

interface ActivityItem {
  id: string
  type: "purchase" | "deploy" | "review" | "signup" | "upgrade" | "launch"
  message: string
  time: string
  country?: string
}

const ICONS: Record<string, string> = {
  purchase: "🛒", deploy: "🚀", review: "⭐", signup: "👋", upgrade: "⬆️", launch: "🎉",
}

interface Props {
  initialItems?: ActivityItem[]
  variant?: "ticker" | "feed"
}

// Static activity items used as seed when DB has no data
const SEED_ITEMS: ActivityItem[] = [
  { id: "1", type: "purchase", message: "Someone purchased AI Analytics Pro", time: "2m ago", country: "🇺🇸" },
  { id: "2", type: "deploy", message: "Code Assistant deployed to production", time: "5m ago", country: "🇬🇧" },
  { id: "3", type: "review", message: "Sales CRM AI got a 5★ review", time: "8m ago", country: "🇩🇪" },
  { id: "4", type: "signup", message: "New developer joined the platform", time: "11m ago", country: "🇮🇳" },
  { id: "5", type: "launch", message: "Marketing Automation Agent launched", time: "14m ago", country: "🇧🇷" },
  { id: "6", type: "upgrade", message: "User upgraded to Enterprise plan", time: "18m ago", country: "🇨🇦" },
  { id: "7", type: "purchase", message: "Automation Bundle was purchased", time: "22m ago", country: "🇫🇷" },
  { id: "8", type: "deploy", message: "Research Agent deployed by a startup", time: "25m ago", country: "🇸🇬" },
]

export default function ActivityFeed({ initialItems, variant = "ticker" }: Props) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems?.length ? initialItems : SEED_ITEMS)
  const [visible, setVisible] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Rotate visible item for ticker
  useEffect(() => {
    if (variant !== "ticker") return
    const id = setInterval(() => {
      setVisible(v => (v + 1) % items.length)
    }, 4000)
    return () => clearInterval(id)
  }, [items.length, variant])

  // SSE connection for live updates
  useEffect(() => {
    let es: EventSource
    try {
      es = new EventSource("/api/live/activity")
      es.onmessage = (e) => {
        try {
          const item = JSON.parse(e.data) as ActivityItem
          setItems(prev => [item, ...prev].slice(0, 20))
        } catch {}
      }
    } catch {}
    return () => es?.close()
  }, [])

  if (variant === "ticker") {
    const item = items[visible]
    if (!item) return null
    return (
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <div key={visible} className="flex items-center gap-2 text-sm text-zinc-400 animate-in slide-in-from-bottom-2 duration-300">
          <span>{ICONS[item.type]}</span>
          <span>{item.message}</span>
          {item.country && <span>{item.country}</span>}
          <span className="text-zinc-700 text-xs">{item.time}</span>
        </div>
      </div>
    )
  }

  // Feed variant
  return (
    <div ref={containerRef} className="space-y-2">
      {items.slice(0, 8).map((item, idx) => (
        <div key={item.id + idx} className="flex items-center gap-3 glass rounded-xl px-4 py-2.5 animate-in slide-in-from-left duration-300"
          style={{ animationDelay: `${idx * 50}ms` }}>
          <span className="text-lg flex-shrink-0">{ICONS[item.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-300 line-clamp-1">{item.message}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.country && <span className="text-base">{item.country}</span>}
            <span className="text-xs text-zinc-700">{item.time}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
