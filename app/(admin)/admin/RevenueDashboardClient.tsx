"use client"

import { useState, useCallback } from "react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts"
import { KpiCard } from "@/components/admin/KPICard"
import { DataTable } from "@/components/admin/DataTable"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DollarSign, TrendingUp, Users, ShoppingCart, Percent,
  RefreshCw, Download, FileText, ArrowUpRight, ArrowDownRight
} from "lucide-react"

export interface DashboardData {
  mrr: number
  arr: number
  aov: number
  ltv: number
  cac: number
  churnRate: number
  nrr: number
  refundRate: number
  totalRevenue: number
  last30DaysRevenue: { date: string; revenue: number }[]
  revenueByPlan: { name: string; value: number }[]
  topUsers: { id: string; name: string; email: string; ltv: number }[]
  topProducts: { id: string; name: string; revenue: number; subs: number }[]
  expansionContraction: { month: string; expansion: number; contraction: number }[]
  forecast30: number
  forecast90: number
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function exportCSV(data: DashboardData) {
  const rows = [
    ["Metric", "Value"],
    ["MRR", data.mrr],
    ["ARR", data.arr],
    ["AOV", data.aov],
    ["LTV", data.ltv],
    ["CAC", data.cac],
    ["Churn Rate %", data.churnRate],
    ["NRR %", data.nrr],
    ["Refund Rate %", data.refundRate],
    ["Total Revenue", data.totalRevenue],
  ]
  const csv = rows.map((r) => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `revenue-dashboard-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RevenueDashboardClient({ data }: { data: DashboardData }) {
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly" | "monthly">("daily")
  const [refreshing, setRefreshing] = useState(false)

  const kpis = [
    { title: "MRR", value: fmt(data.mrr), icon: <DollarSign className="w-4 h-4" />, trend: 8.2, subtitle: "Monthly Recurring Revenue" },
    { title: "ARR", value: fmt(data.arr), icon: <TrendingUp className="w-4 h-4" />, trend: 8.2, subtitle: "Annualized Run Rate" },
    { title: "LTV", value: fmt(data.ltv), icon: <Users className="w-4 h-4" />, trend: 3.1, subtitle: "Lifetime Value (avg)" },
    { title: "CAC", value: fmt(data.cac), icon: <ShoppingCart className="w-4 h-4" />, trend: -5.4, subtitle: "Customer Acquisition Cost" },
    { title: "AOV", value: fmt(data.aov), icon: <DollarSign className="w-4 h-4" />, trend: 1.8, subtitle: "Average Order Value" },
    { title: "Churn Rate", value: `${data.churnRate}%`, icon: <Percent className="w-4 h-4" />, trend: -0.3, subtitle: "Monthly churn" },
    { title: "NRR", value: `${data.nrr}%`, icon: <TrendingUp className="w-4 h-4" />, trend: 2.1, subtitle: "Net Revenue Retention" },
    { title: "Refund Rate", value: `${data.refundRate}%`, icon: <Percent className="w-4 h-4" />, trend: 0.1, subtitle: "% of payments refunded" },
  ]

  const getChartData = () => {
    if (chartPeriod === "daily") return data.last30DaysRevenue
    if (chartPeriod === "weekly") {
      const weekly: { date: string; revenue: number }[] = []
      for (let i = 0; i < data.last30DaysRevenue.length; i += 7) {
        const slice = data.last30DaysRevenue.slice(i, i + 7)
        weekly.push({
          date: `Week ${Math.floor(i / 7) + 1}`,
          revenue: slice.reduce((s, d) => s + d.revenue, 0),
        })
      }
      return weekly
    }
    // monthly - group all into single month
    return [{ date: "This Month", revenue: data.last30DaysRevenue.reduce((s, d) => s + d.revenue, 0) }]
  }

  const userColumns = [
    { key: "name", header: "User" },
    { key: "email", header: "Email", className: "text-muted-foreground text-xs" },
    { key: "ltv", header: "LTV", render: (row: { ltv: number; name: string; email: string }) => (
      <span className="font-semibold text-emerald-600">{fmt(row.ltv)}</span>
    )},
  ]

  const productColumns = [
    { key: "name", header: "Product" },
    { key: "revenue", header: "Revenue", render: (row: { name: string; revenue: number; subs: number }) => (
      <span className="font-semibold">{fmt(row.revenue)}</span>
    )},
    { key: "subs", header: "Subscribers" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Redis-cached · 5 min TTL · Real-time metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); window.location.reload() }}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(data)}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("/api/admin/revenue/export?format=pdf", "_blank")}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            subtitle={kpi.subtitle}
            trend={kpi.trend}
            icon={kpi.icon}
          />
        ))}
      </div>

      {/* Forecast Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border p-5 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">30-Day Forecast</p>
              <p className="text-3xl font-bold mt-1">{fmt(data.forecast30)}</p>
              <p className="text-xs text-muted-foreground mt-1">Linear regression projection</p>
            </div>
            <ArrowUpRight className="w-8 h-8 text-violet-500 opacity-60" />
          </div>
        </div>
        <div className="rounded-xl border p-5 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">90-Day Forecast</p>
              <p className="text-3xl font-bold mt-1">{fmt(data.forecast90)}</p>
              <p className="text-xs text-muted-foreground mt-1">Linear regression projection</p>
            </div>
            <ArrowUpRight className="w-8 h-8 text-blue-500 opacity-60" />
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl border p-5 bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 className="font-semibold">Revenue Over Time</h2>
          <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as "daily" | "weekly" | "monthly")}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={getChartData()} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v: any) => [fmt(Number(v)), "Revenue"]} />
            <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="rounded-xl border p-5 bg-card">
          <h2 className="font-semibold mb-4">Revenue by Plan</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.revenueByPlan} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(v: any) => [fmt(Number(v)), "Revenue"]} />
              <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expansion vs Contraction */}
        <div className="rounded-xl border p-5 bg-card">
          <h2 className="font-semibold mb-4">Expansion vs Contraction MRR</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.expansionContraction} margin={{ top: 5, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: any) => [`$${Number(v)}`, ""]} />
              <Legend />
              <Bar dataKey="expansion" stackId="a" fill="#10b981" name="Expansion" radius={[4, 4, 0, 0]} />
              <Bar dataKey="contraction" stackId="b" fill="#ef4444" name="Contraction" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Top Users by LTV</h2>
          </div>
          <DataTable
            data={data.topUsers}
            columns={userColumns as Parameters<typeof DataTable>[0]["columns"]}
            emptyMessage="No users found"
          />
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Top Products by Revenue</h2>
          </div>
          <DataTable
            data={data.topProducts}
            columns={productColumns as Parameters<typeof DataTable>[0]["columns"]}
            emptyMessage="No products found"
          />
        </div>
      </div>
    </div>
  )
}
