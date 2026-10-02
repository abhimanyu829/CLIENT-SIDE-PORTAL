"use client"
import { useEffect, useRef } from "react"
import Link from "next/link"
import LiveMetricCard from "@/components/dashboard/LiveMetricCard"
import ActivityFeed from "@/components/dashboard/ActivityFeed"
import { useDashboardStore } from "@/hooks/useDashboardStore"

const QUICK_ACTIONS = [
  { label: "Ask AI Chat", hint: "Get instant answers", href: "/dashboard/chat", icon: "✦" },
  { label: "Open a ticket", hint: "Talk to support", href: "/dashboard/tickets", icon: "◎" },
  { label: "Browse marketplace", hint: "Find new tools", href: "/marketplace", icon: "◈" },
  { label: "Manage plans", hint: "Subscriptions & billing", href: "/dashboard/subscriptions", icon: "⬡" },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function DashboardOverview() {
  const { stats, setStats } = useDashboardStore()
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

  const summary = [
    { label: "Projects", value: stats?.projectsCount, href: "/dashboard/projects" },
    { label: "Tickets resolved this month", value: stats?.resolvedTickets, href: "/dashboard/tickets" },
    { label: "Invoices", value: stats?.totalInvoices, href: "/dashboard/invoices" },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground" suppressHydrationWarning>{greeting()} 👋</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Your services, usage and support at a glance. Updates automatically.</p>
        </div>
        {/* On large screens the top bar already shows "Join Our Team". */}
        <a
          href="http://abhibhideveloper.tech/join-our-team"
          className="lg:hidden inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">🤝</span> Join Our Team
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <LiveMetricCard
          index={0}
          label="Active subscriptions"
          sub="Across all services"
          icon="⬡"
          color="text-primary"
          tint="bg-primary/10"
          href="/dashboard/subscriptions"
          statKey="activeSubs"
        />
        <LiveMetricCard
          index={1}
          label="AI usage"
          sub="tokens this month"
          icon="✦"
          color="text-violet-600"
          tint="bg-violet-500/10"
          href="/dashboard/chat"
          statKey="aiTokensUsed"
          limitKey="aiTokensLimit"
        />
        <LiveMetricCard
          index={2}
          label="Open tickets"
          sub="Waiting on you or support"
          icon="◎"
          color="text-red-600"
          tint="bg-red-500/10"
          href="/dashboard/tickets"
          statKey="openTickets"
        />
        <LiveMetricCard
          index={3}
          label="Spend this month"
          sub="Paid invoices, current cycle"
          icon="₹"
          color="text-emerald-600"
          tint="bg-emerald-500/10"
          href="/dashboard/invoices"
          statKey="monthlySpend"
          formatter={(v) => `\u20b9${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section aria-labelledby="glance-title" className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 id="glance-title" className="font-sans text-sm font-semibold tracking-normal text-foreground">Your account</h2>

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {summary.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {typeof item.value === "number" ? item.value.toLocaleString() : <span className="inline-block h-7 w-10 animate-pulse rounded bg-muted align-middle" aria-label="Loading" />}
                </dd>
              </Link>
            ))}
          </dl>

          <h3 className="mt-6 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</h3>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-all hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{action.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{action.label}</span>
                  <span className="block text-xs text-muted-foreground">{action.hint}</span>
                </span>
                <span aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary">→</span>
              </Link>
            ))}
          </div>
        </section>
        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
