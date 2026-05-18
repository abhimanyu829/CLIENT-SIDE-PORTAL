/**
 * Admin Revenue Dashboard
 * Displays real-time KPIs: MRR, ARR, LTV, Churn Rate, AOV, daily revenue chart, top users.
 * Data fetched from /api/admin/revenue — server component with client chart island.
 */
import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RevenueChartClient } from "./_components/RevenueChartClient"
import { TopUsersTable } from "./_components/TopUsersTable"

export const metadata: Metadata = {
  title: "Revenue Dashboard | Admin",
  description: "Real-time SaaS revenue metrics — MRR, ARR, LTV, churn, AOV",
}

async function getRevenueData() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const res = await fetch(`${baseUrl}/api/admin/revenue`, {
    cache: "no-store",
    headers: { "x-internal-call": "1" },
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.data
}

function KPICard({
  label,
  value,
  sub,
  trend,
  color = "indigo",
}: {
  label: string
  value: string
  sub?: string
  trend?: string
  color?: string
}) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-400",
    emerald: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400",
    amber: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400",
    rose: "from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-400",
    violet: "from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400",
    sky: "from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400",
  }
  const cls = colors[color] ?? colors.indigo

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${cls} p-6 backdrop-blur-sm`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-sm text-white/50">{sub}</p>}
      {trend && (
        <span
          className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            trend.startsWith("+") ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
          }`}
        >
          {trend}
        </span>
      )}
    </div>
  )
}

export default async function RevenueDashboardPage() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN")) {
    redirect("/")
  }

  const data = await getRevenueData()

  const fmt = (n: number, currency = true) =>
    currency
      ? `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`
      : `${n.toFixed(2)}%`

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-white/[0.02] px-8 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Revenue Dashboard</h1>
        <p className="mt-1 text-sm text-white/40">
          Real-time SaaS metrics · Updated on page load
        </p>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-8 py-8">
        {!data ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-400">
            Failed to load revenue data. Check API connectivity.
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KPICard
                label="MRR"
                value={fmt(data.mrr)}
                sub="Monthly Recurring Revenue"
                color="indigo"
              />
              <KPICard
                label="ARR"
                value={fmt(data.arr)}
                sub="Annual Run Rate"
                color="violet"
              />
              <KPICard
                label="LTV"
                value={fmt(data.ltv)}
                sub="Lifetime Value (avg)"
                color="emerald"
              />
              <KPICard
                label="Active Subs"
                value={data.activeSubscriptions.toLocaleString()}
                sub="Currently active"
                color="sky"
              />
              <KPICard
                label="Churn Rate"
                value={`${data.churnRate}%`}
                sub="Last 30 days"
                color={data.churnRate > 5 ? "rose" : "emerald"}
              />
              <KPICard
                label="AOV"
                value={fmt(data.aov)}
                sub="Average Order Value"
                color="amber"
              />
              <KPICard
                label="Refund Rate"
                value={`${data.refundRate}%`}
                sub="Of all payments"
                color={data.refundRate > 2 ? "rose" : "emerald"}
              />
              <KPICard
                label="Total Revenue"
                value={fmt(data.totalRevenue)}
                sub="All time (successful)"
                color="indigo"
              />
            </div>

            {/* Daily Revenue Chart */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <h2 className="mb-4 text-lg font-semibold text-white/80">
                Daily Revenue — Last 30 Days
              </h2>
              <RevenueChartClient data={data.dailySales} />
            </div>

            {/* Alerts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.cancelledLast30 > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-semibold text-rose-400">
                      {data.cancelledLast30} cancellation{data.cancelledLast30 > 1 ? "s" : ""} in last 30 days
                    </p>
                    <p className="mt-0.5 text-sm text-white/40">
                      Review churn reasons in the user management panel.
                    </p>
                  </div>
                </div>
              )}
              {data.churnRate > 5 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <span className="text-2xl">📉</span>
                  <div>
                    <p className="font-semibold text-amber-400">
                      High churn rate: {data.churnRate}%
                    </p>
                    <p className="mt-0.5 text-sm text-white/40">
                      Industry benchmark is &lt; 5%. Consider enabling dunning campaigns.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Top Paying Users */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <h2 className="mb-4 text-lg font-semibold text-white/80">Top Paying Users</h2>
              <TopUsersTable users={data.topPayingUsers} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
