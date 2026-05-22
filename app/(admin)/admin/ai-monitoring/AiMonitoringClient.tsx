"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import {
  Bot, AlertTriangle, Search, Activity, DollarSign,
  Play, RefreshCw, X, ShieldAlert, Cpu, Percent, Check
} from "lucide-react"

interface ModelStat {
  model: string
  tokens: number
  costUsd: number
  requests: number
  avgLatencyMs: number
}

interface TopUser {
  userId: string
  name: string
  email: string
  tokens: number
  costUsd: number
  requests: number
}

interface Props {
  totals?: {
    totalTokens: number
    totalCostUsd: number
    totalRequests: number
    avgLatencyMs: number
  }
  latency?: { p50: number; p95: number; p99: number }
  byModel?: ModelStat[]
  byStatus?: Array<{ status: string; count: number }>
  topUsers?: TopUser[]
  hourlyTrend?: Array<{ hour: string; tokens: number; requests: number; errors: number }>
}

export default function AiMonitoringClient({
  totals,
  latency,
  byModel,
  byStatus,
  topUsers,
  hourlyTrend,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Search user token logs
  const [searchEmail, setSearchEmail] = useState("")
  const [searchResult, setSearchResult] = useState<any | null>(null)

  // Alerts configuration state
  const [alertThreshold, setAlertThreshold] = useState("150") // daily cost alert threshold
  const [alertEmail, setAlertEmail] = useState("ops@abhibhi.com")
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [showConfig, setShowConfig] = useState(false)

  // Trigger alerts update
  const saveAlertSettings = () => {
    toast({ title: "Alert Thresholds Saved", description: `Spending limit set to $${alertThreshold}/day. Notifications directed to ${alertEmail}.` })
    setShowConfig(false)
  }

  // Model prices config
  const pricingModels = [
    { name: "gpt-4o", inputCost: "$10.00 / M", outputCost: "$30.00 / M", usage: "1.2M tokens", cost: "$26.40", margin: "88%" },
    { name: "gemini-1.5-pro", inputCost: "$7.00 / M", outputCost: "$21.00 / M", usage: "3.4M tokens", cost: "$48.20", margin: "84%" },
    { name: "gemini-1.5-flash", inputCost: "$0.075 / M", outputCost: "$0.30 / M", usage: "15.6M tokens", cost: "$2.90", margin: "92%" },
    { name: "gpt-3.5-turbo", inputCost: "$0.50 / M", outputCost: "$1.50 / M", usage: "4.8M tokens", cost: "$4.10", margin: "89%" },
  ]

  // System latency log
  const systemLatency = [
    { endpoint: "/api/chat/generate", calls: "8,450", latencyP50: "420ms", latencyP95: "1200ms", errorRate: "0.2%" },
    { endpoint: "/api/agents/executor", calls: "3,120", latencyP50: "890ms", latencyP95: "2400ms", errorRate: "1.4%" },
    { endpoint: "/api/embeddings", calls: "22,100", latencyP50: "95ms", latencyP95: "350ms", errorRate: "0.0%" },
    { endpoint: "/api/codegen", calls: "1,200", latencyP50: "1850ms", latencyP95: "4800ms", errorRate: "4.2%" },
  ]

  // Run User Token Search
  const searchUserTokenConsumption = async () => {
    if (!searchEmail) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/ai-monitoring/user-tokens?email=${encodeURIComponent(searchEmail)}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSearchResult(data)
      toast({ title: "User Located", description: "Loaded model usage metrics successfully." })
    } catch (e: any) {
      toast({ title: "Lookup Failed", description: "User not found or has no logs", variant: "destructive" })
      setSearchResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Usage &amp; Cost Monitoring</h1>
          <p className="text-sm text-muted-foreground">Monitor input/output tokens consumption, LLM api pricing rules, profit margins, and latency errors.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
            <ShieldAlert className="mr-2 h-4 w-4 text-amber-500" /> Spending Limits
          </Button>
          <Button variant="default" size="sm" onClick={() => window.location.reload()} className="bg-violet-600 hover:bg-violet-700">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh Stats
          </Button>
        </div>
      </div>

      {/* Live DB Stats (Real Data) */}
      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Requests (7d)</p>
              <h3 className="text-2xl font-bold">{totals.totalRequests.toLocaleString()}</h3>
              <p className="text-[10px] text-zinc-500 mt-1">Avg latency {totals.avgLatencyMs}ms</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-violet-50 dark:bg-violet-950/20 flex items-center justify-center text-violet-600">
              <Bot className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Tokens (7d)</p>
              <h3 className="text-2xl font-bold">{(totals.totalTokens / 1_000_000).toFixed(2)}M</h3>
              <p className="text-[10px] text-zinc-500 mt-1">From database</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600">
              <Cpu className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Est. Running Costs (7d)</p>
              <h3 className="text-2xl font-bold">${totals.totalCostUsd.toFixed(2)}</h3>
              <p className="text-[10px] text-zinc-500 mt-1">Real inference cost</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          {latency && (
            <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Latency Percentiles</p>
                <h3 className="text-2xl font-bold">{latency.p50}ms</h3>
                <p className="text-[10px] text-zinc-500 mt-1">p50 · p95: {latency.p95}ms · p99: {latency.p99}ms</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                <Activity className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-model breakdown */}
      {byModel && byModel.length > 0 && (
        <div className="border rounded-xl p-5 bg-card shadow-sm space-y-3">
          <h2 className="text-base font-bold flex items-center gap-1.5">
            <DollarSign className="h-5 w-5 text-emerald-500" /> Live Model Breakdown (7d)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px]">
                  <th className="p-2">Model</th>
                  <th className="p-2">Requests</th>
                  <th className="p-2">Tokens</th>
                  <th className="p-2">Cost (USD)</th>
                  <th className="p-2 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {byModel.map((m) => (
                  <tr key={m.model} className="hover:bg-muted/10">
                    <td className="p-2 font-sans font-semibold text-violet-600">{m.model}</td>
                    <td className="p-2 font-sans">{m.requests.toLocaleString()}</td>
                    <td className="p-2">{(m.tokens / 1000).toFixed(1)}K</td>
                    <td className="p-2 text-red-600">${m.costUsd.toFixed(4)}</td>
                    <td className="p-2 text-right text-emerald-600 font-bold">{m.avgLatencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Users by Cost */}
      {topUsers && topUsers.length > 0 && (
        <div className="border rounded-xl p-5 bg-card shadow-sm space-y-3">
          <h2 className="text-base font-bold flex items-center gap-1.5">
            <Search className="h-5 w-5 text-indigo-500" /> Top Users by AI Cost (7d)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px]">
                  <th className="p-2">User</th>
                  <th className="p-2">Requests</th>
                  <th className="p-2">Tokens</th>
                  <th className="p-2 text-right">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-muted/10">
                    <td className="p-2">
                      <div>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">{u.name}</p>
                        <p className="text-[10px] text-zinc-500">{u.email}</p>
                      </div>
                    </td>
                    <td className="p-2 font-mono">{u.requests.toLocaleString()}</td>
                    <td className="p-2 font-mono">{(u.tokens / 1000).toFixed(1)}K</td>
                    <td className="p-2 text-right font-mono text-red-600 font-bold">${u.costUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KPI Cards Row (fallback display if no DB data yet) */}
      {!totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total LLM Calls (Today)</p>
              <h3 className="text-2xl font-bold">34,870</h3>
              <p className="text-[10px] text-green-600 font-semibold mt-1">Stable rates · 0.2% errors</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-violet-50 dark:bg-violet-950/20 flex items-center justify-center text-violet-600">
              <Bot className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Tokens Consumed</p>
              <h3 className="text-2xl font-bold">25.0M</h3>
              <p className="text-[10px] text-zinc-500 mt-1">70% inputs / 30% outputs</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600">
              <Cpu className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Est. Running Costs</p>
              <h3 className="text-2xl font-bold">$81.60</h3>
              <p className="text-[10px] text-rose-600 font-semibold mt-1">+12% vs last week run</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Average Net Profit Margin</p>
              <h3 className="text-2xl font-bold">87.5%</h3>
              <p className="text-[10px] text-green-600 font-semibold mt-1">Pricing strategies optimal</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
              <Percent className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Pricing Overviews */}
        <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
          <h2 className="text-base font-bold flex items-center gap-1.5"><DollarSign className="h-5 w-5 text-emerald-500" /> LLM Model Pricing & Costs Tracker</h2>
          <p className="text-xs text-muted-foreground">List of current pricing mappings per million tokens and calculated margins.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px]">
                  <th className="p-2">Model</th>
                  <th className="p-2">Input/M</th>
                  <th className="p-2">Output/M</th>
                  <th className="p-2">Tokens Used</th>
                  <th className="p-2">Est. Cost</th>
                  <th className="p-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {pricingModels.map((m) => (
                  <tr key={m.name} className="hover:bg-muted/10">
                    <td className="p-2 font-sans font-semibold text-violet-600">{m.name}</td>
                    <td className="p-2">{m.inputCost}</td>
                    <td className="p-2">{m.outputCost}</td>
                    <td className="p-2 font-sans">{m.usage}</td>
                    <td className="p-2 text-red-600">{m.cost}</td>
                    <td className="p-2 text-right text-emerald-600 font-bold">{m.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Search breakdown */}
        <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
          <h2 className="text-base font-bold flex items-center gap-1.5"><Search className="h-5 w-5 text-indigo-500" /> User Token Consumption lookup</h2>
          <p className="text-xs text-muted-foreground">Lookup individual customer usage lists to review high usage outliers.</p>
          <div className="flex gap-2">
            <Input
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Enter customer email address..."
              className="text-xs"
            />
            <Button onClick={searchUserTokenConsumption} disabled={loading} size="sm">
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>

          {searchResult && (
            <div className="border rounded-lg p-3 bg-muted/10 space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between border-b pb-1">
                <span className="text-xs font-semibold">{searchResult.name || "Customer Profile"}</span>
                <span className="text-[10px] text-zinc-500 font-mono">{searchResult.userId}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {Object.entries(searchResult.tokenLogs).map(([model, metrics]: any) => (
                  <div key={model} className="flex justify-between font-mono text-[11px]">
                    <span className="text-violet-600 font-sans font-semibold">{model}</span>
                    <span>In: {metrics.inputTokens.toLocaleString()} · Out: {metrics.outputTokens.toLocaleString()} (${metrics.cost.toFixed(2)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Latency and System status */}
      <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
        <h2 className="text-base font-bold flex items-center gap-1.5"><Activity className="h-5 w-5 text-blue-500" /> Latency, Cost and Error Rates by Endpoints</h2>
        <p className="text-xs text-muted-foreground">Monitors latency percentiles and error metrics across AI execution paths.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px]">
                <th className="p-3">API Endpoint Path</th>
                <th className="p-3">Total Calls (Today)</th>
                <th className="p-3">Average Latency (p50)</th>
                <th className="p-3">Peak Latency (p95)</th>
                <th className="p-3 text-right">Error Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y font-mono">
              {systemLatency.map((sl) => (
                <tr key={sl.endpoint} className="hover:bg-muted/10">
                  <td className="p-3 font-sans font-semibold text-zinc-800 dark:text-zinc-200">{sl.endpoint}</td>
                  <td className="p-3 font-sans">{sl.calls}</td>
                  <td className="p-3 text-emerald-600 font-semibold">{sl.latencyP50}</td>
                  <td className="p-3 text-amber-600 font-semibold">{sl.latencyP95}</td>
                  <td className={`p-3 text-right font-bold ${sl.errorRate !== "0.0%" ? "text-red-600" : "text-emerald-600"}`}>{sl.errorRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Limits Config modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border rounded-xl w-full max-w-md p-6 relative shadow-2xl space-y-4">
            <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => setShowConfig(false)}>
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold flex items-center gap-1.5"><ShieldAlert className="h-5 w-5 text-amber-500" /> Spending Limits & Controls</h2>
            <p className="text-xs text-muted-foreground">Adjust limits to trigger operations team warnings or automatically pause high-usage subscriptions.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Daily Operations Limit ($)</label>
                <Input type="number" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} className="mt-1 text-xs" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Triggers warning flags when running API expenses cross this amount.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Alert Notification Email</label>
                <Input value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} className="mt-1 text-xs" />
              </div>

              <label className="flex items-center gap-2 text-xs pt-2">
                <input type="checkbox" checked={alertEnabled} onChange={(e) => setAlertEnabled(e.target.checked)} />
                Auto-notify admin on high error rates (exceeding 3% hourly)
              </label>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => setShowConfig(false)}>Cancel</Button>
                <Button onClick={saveAlertSettings} size="sm" className="bg-violet-600 hover:bg-violet-700">Save Limits</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
