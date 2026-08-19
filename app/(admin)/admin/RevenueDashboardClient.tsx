"use client"

import { useState } from "react"
import Link from "next/link"
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
  RefreshCw, Download, FileText, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, Package, Briefcase, Settings2, MessageSquare,
  Sparkles, Shapes, ReceiptText, ClipboardList, BarChart3,
  GitBranch, CreditCard, PlaySquare, Ticket, FolderKanban,
  ShieldCheck, Settings, Crown, ScanSearch, Globe2
} from "lucide-react"

const ADMIN_SECTIONS = [
  { href: "/admin",                     label: "Overview",          icon: LayoutDashboard, color: "text-violet-500 bg-violet-500/10" },
  { href: "/admin/users",               label: "User Management",    icon: Users,            color: "text-blue-500 bg-blue-500/10" },
  { href: "/admin/subadmins",           label: "Subadmin Mgmt",      icon: ShieldCheck,      color: "text-rose-500 bg-rose-500/10" },
  { href: "/admin/products",            label: "Products",           icon: Package,          color: "text-orange-500 bg-orange-500/10" },
  { href: "/admin/services",            label: "Services",           icon: Briefcase,        color: "text-teal-500 bg-teal-500/10" },
  { href: "/admin/services/centers",   label: "Service Centers",    icon: Settings2,        color: "text-cyan-500 bg-cyan-500/10" },
  { href: "/admin/services/emails",    label: "Service Emails",     icon: MessageSquare,    color: "text-indigo-500 bg-indigo-500/10" },
  { href: "/admin/services/saas",      label: "SaaS Center",        icon: Sparkles,         color: "text-pink-500 bg-pink-500/10" },
  { href: "/admin/services/ai-agents", label: "AI Agents",          icon: Sparkles,         color: "text-amber-500 bg-amber-500/10" },
  { href: "/admin/services/ai-models", label: "AI Models",          icon: Sparkles,         color: "text-lime-500 bg-lime-500/10" },
  { href: "/admin/services/automation",label: "Automation",         icon: Sparkles,         color: "text-emerald-500 bg-emerald-500/10" },
  { href: "/admin/services/categories",label: "Service Categories", icon: Shapes,           color: "text-fuchsia-500 bg-fuchsia-500/10" },
  { href: "/admin/services/orders",    label: "Service Orders",     icon: ReceiptText,      color: "text-sky-500 bg-sky-500/10" },
  { href: "/admin/services/requests",  label: "Service Requests",   icon: ClipboardList,    color: "text-violet-400 bg-violet-400/10" },
  { href: "/admin/services/analytics", label: "Service Analytics",  icon: BarChart3,        color: "text-blue-400 bg-blue-400/10" },
  { href: "/admin/subscriptions",      label: "Subscriptions",      icon: GitBranch,        color: "text-green-500 bg-green-500/10" },
  { href: "/admin/billing-center",     label: "Billing Center",     icon: Crown,            color: "text-yellow-500 bg-yellow-500/10" },
  { href: "/admin/orders",             label: "Orders & Payments",  icon: ShoppingCart,     color: "text-orange-400 bg-orange-400/10" },
  { href: "/admin/payments",           label: "Payment Inspection", icon: ScanSearch,       color: "text-red-500 bg-red-500/10" },
  { href: "/admin/revenue",            label: "Revenue Dashboard",  icon: TrendingUp,       color: "text-emerald-400 bg-emerald-400/10" },
  { href: "/admin/ecosystem",          label: "Ecosystem Control",  icon: Globe2,           color: "text-teal-400 bg-teal-400/10" },
  { href: "/admin/deployment-center", label: "Deployment Center",  icon: Settings2,        color: "text-indigo-400 bg-indigo-400/10" },
  { href: "/admin/previews",           label: "Previews",           icon: PlaySquare,       color: "text-cyan-400 bg-cyan-400/10" },
  { href: "/admin/analytics",          label: "Analytics",          icon: BarChart3,        color: "text-pink-400 bg-pink-400/10" },
  { href: "/admin/tickets",            label: "Tickets",            icon: Ticket,           color: "text-amber-400 bg-amber-400/10" },
  { href: "/admin/invoices",           label: "Invoices",           icon: FileText,         color: "text-lime-400 bg-lime-400/10" },
  { href: "/admin/audit",              label: "Audit Logs",         icon: ShieldCheck,      color: "text-rose-400 bg-rose-400/10" },
  { href: "/admin/settings",           label: "Settings",           icon: Settings,         color: "text-zinc-500 bg-zinc-500/10" },
]

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
  if (n >= 1_000_000) return `\u20b9${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `\u20b9${(n / 1_000).toFixed(1)}K`
  return `\u20b9${n.toFixed(2)}`
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
    <div className="space-y-8">
      {/* ── Quick Access Grid ──────────────────────────────────── */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-black text-foreground">Admin Sections</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Quick access to all admin panels</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
          {ADMIN_SECTIONS.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all p-4 text-center"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shrink-0 group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-foreground leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />
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
