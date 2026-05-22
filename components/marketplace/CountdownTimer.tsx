"use client"
import { useEffect, useState } from "react"

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

function calc(end: Date): TimeLeft {
  const diff = end.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  const s = Math.floor(diff / 1000)
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    expired: false,
  }
}

interface Props {
  endDate: Date | string
  className?: string
  variant?: "default" | "compact" | "badge"
  onExpire?: () => void
}

export default function CountdownTimer({ endDate, className = "", variant = "default", onExpire }: Props) {
  const end = new Date(endDate)
  const [t, setT] = useState<TimeLeft>(calc(end))

  useEffect(() => {
    const id = setInterval(() => {
      const next = calc(end)
      setT(next)
      if (next.expired) {
        clearInterval(id)
        onExpire?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [endDate])

  if (t.expired) return null

  if (variant === "badge") {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold text-red-400 ${className}`}>
        🔥 {t.days > 0 ? `${t.days}d ` : ""}{String(t.hours).padStart(2,"0")}:{String(t.minutes).padStart(2,"0")}:{String(t.seconds).padStart(2,"0")} left
      </span>
    )
  }

  if (variant === "compact") {
    return (
      <span className={`font-mono text-sm font-bold text-amber-400 ${className}`}>
        {t.days > 0 ? `${t.days}d ` : ""}{String(t.hours).padStart(2,"0")}:{String(t.minutes).padStart(2,"0")}:{String(t.seconds).padStart(2,"0")}
      </span>
    )
  }

  const units = [
    { label: "Days", value: t.days },
    { label: "Hours", value: t.hours },
    { label: "Mins", value: t.minutes },
    { label: "Secs", value: t.seconds },
  ].filter(u => u.label !== "Days" || u.value > 0)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <span className="font-mono text-2xl font-black text-white leading-none">
              {String(u.value).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{u.label}</span>
          </div>
          {i < units.length - 1 && (
            <span className="text-zinc-600 font-bold text-xl pb-3">:</span>
          )}
        </div>
      ))}
    </div>
  )
}
