"use client"

import { Button } from "@/components/ui/button"

interface AdminKPIs {
  mrr: number
  arr: number
  newSignups: number
  churnRate: number
  totalUsers: number
  totalRevenue: number
  recentActivity: { action: string; actor: string; time: string }[]
}

export default function AdminOverviewClient({ kpis }: { kpis: AdminKPIs }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

  const cards = [
    { label: "Monthly Recurring Revenue (MRR)", value: fmt(kpis.mrr), trend: "+12%", pos: true },
    { label: "Annual Run Rate (ARR)", value: fmt(kpis.arr), trend: "+12%", pos: true },
    { label: "New Signups (30d)", value: kpis.newSignups.toLocaleString(), trend: "+5.4%", pos: true },
    { label: "Total Users", value: kpis.totalUsers.toLocaleString(), trend: "", pos: true },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">Key performance indicators and system health.</p>
        </div>
        <div className="flex gap-2">
          <select className="border rounded-md px-3 py-1.5 text-sm bg-background">
            <option>Last 30 Days</option>
            <option>Last Quarter</option>
            <option>Year to Date</option>
          </select>
          <Button variant="outline">Export Report</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((kpi, i) => (
          <div key={i} className="p-6 border rounded-xl bg-background shadow-sm space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className="text-3xl font-bold">{kpi.value}</p>
            {kpi.trend && (
              <p className={`text-xs font-semibold ${kpi.pos ? "text-green-600" : "text-red-600"}`}>
                {kpi.trend} vs last period
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart (SVG Area Chart) */}
        <div className="lg:col-span-2 border rounded-xl bg-background shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold">Revenue Growth</h2>
          <div className="h-[300px] w-full flex items-end relative border-b border-l pb-0 pl-0 pt-4">
            <div className="absolute left-2 top-0 bottom-6 flex flex-col justify-between text-xs text-muted-foreground">
              <span>$150k</span>
              <span>$100k</span>
              <span>$50k</span>
              <span>$0</span>
            </div>
            <div className="w-full h-full relative ml-12 mb-6">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="25" x2="100" y2="25" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
                <polygon points="0,100 0,60 16,55 33,40 50,45 66,25 83,20 100,10 100,100" fill="url(#areaGradient)" />
                <polyline points="0,60 16,55 33,40 50,45 66,25 83,20 100,10" fill="none" stroke="var(--primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                {[[0,60],[16,55],[33,40],[50,45],[66,25],[83,20],[100,10]].map(([cx,cy],i) => (
                  <circle key={i} cx={cx} cy={cy} r="3" fill="var(--primary)" />
                ))}
              </svg>
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground ml-12">
            {["Nov","Dec","Jan","Feb","Mar","Apr","May"].map(m => <span key={m}>{m}</span>)}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="border rounded-xl bg-background shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold">Recent Activity</h2>
          <div className="space-y-3">
            {kpis.recentActivity.length > 0 ? kpis.recentActivity.map((log, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {log.actor.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.actor} · {log.time}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
