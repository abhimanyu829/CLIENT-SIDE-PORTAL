import React from "react"

interface Stat {
  value: string
  label: string
}

interface StatsRowProps {
  stats: Stat[]
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <section className="py-16 border-y border-white/5 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/5">
          {stats.map((s, i) => (
            <div key={i} className={`text-center ${i === 0 ? "border-l-0" : ""}`}>
              <div className="text-4xl md:text-5xl font-black text-white mb-2">{s.value}</div>
              <div className="text-sm font-medium text-zinc-500 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
