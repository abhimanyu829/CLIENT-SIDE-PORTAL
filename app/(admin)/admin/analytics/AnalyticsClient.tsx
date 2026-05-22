"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  TrendingUp, Users, Target, FileText, Download,
  Layers, Play, Filter, Sparkles, AlertCircle, HelpCircle
} from "lucide-react"

interface CohortRow {
  cohort: string
  size: number
  m0: number
  m1: number
  m2: number
  m3: number
  m4: number
}

interface FunnelStep {
  name: string
  count: number
  percent: number
}

interface MrrSummary {
  activeCount: number
  cancelledCount: number
  totalRevenue: number
}

interface Props {
  cohorts: CohortRow[]
  funnel: FunnelStep[]
  mrrSummary: MrrSummary
}

export default function AnalyticsClient({ cohorts, funnel, mrrSummary }: Props) {
  const { toast } = useToast()

  // Projections Sliders
  const [growthRate, setGrowthRate] = useState(15) // monthly growth rate %
  const [churnRate, setChurnRate] = useState(4)   // monthly churn rate %

  // Segment Builder Rules
  const [rulesJoined, setRulesJoined] = useState("30")
  const [rulesLtv, setRulesLtv] = useState("100")
  const [rulesActive, setRulesActive] = useState("7")

  // Segment results
  const [segmentCount, setSegmentCount] = useState<number | null>(null)
  const [segmentUsers, setSegmentUsers] = useState<any[]>([])
  const [loadingSegment, setLoadingSegment] = useState(false)

  // Calculate LTV Projections
  // LTV = ARPU / Churn. Let's make an active project model based on MRR
  const baselineMRR = mrrSummary.activeCount * 49 // assume average tier is $49/mo
  const projectRevenue = (months: number) => {
    let projected = baselineMRR
    let cumulative = 0
    for (let m = 1; m <= months; m++) {
      projected = projected * (1 + growthRate / 100 - churnRate / 100)
      cumulative += projected
    }
    return cumulative
  }

  const runSegmentQuery = async () => {
    setLoadingSegment(true)
    try {
      const res = await fetch("/api/admin/analytics/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: {
            joinedDaysAgo: rulesJoined ? Number(rulesJoined) : undefined,
            minLtv: rulesLtv ? Number(rulesLtv) : undefined,
            activeDaysAgo: rulesActive ? Number(rulesActive) : undefined
          }
        })
      })
      if (!res.ok) throw new Error("Failed to process segment query")
      const data = await res.json()
      setSegmentCount(data.count)
      setSegmentUsers(data.users)
      toast({ title: "Segment Checked", description: `Found ${data.count} matching users.` })
    } catch (e: any) {
      toast({ title: "Query Error", description: e.message, variant: "destructive" })
    } finally {
      setLoadingSegment(false)
    }
  }

  const handlePdfExport = () => {
    toast({ title: "Preparing PDF Report", description: "Triggering printer dialog..." })
    window.print()
  }

  return (
    <div className="space-y-6 print:p-8 print:bg-white print:text-black">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Analytics & Conversion Funnels</h1>
          <p className="text-sm text-muted-foreground">Monitor checkout metrics, signup cohorts, and run target audience segment queries.</p>
        </div>
        <Button onClick={handlePdfExport} variant="outline" size="sm" className="bg-violet-600 hover:bg-violet-700 text-white font-bold">
          <FileText className="mr-2 h-4 w-4" /> Export PDF Report
        </Button>
      </div>

      {/* Cohort Retention Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
          <h2 className="text-base font-bold flex items-center gap-1.5"><Users className="h-5 w-5 text-indigo-500" /> Weekly Signup Cohort Retention</h2>
          <p className="text-xs text-muted-foreground">Checks active logins/sessions of users grouped by registration week.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-zinc-200 dark:border-zinc-800">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 border border-zinc-200 dark:border-zinc-800 font-semibold">Cohort Week</th>
                  <th className="p-2 border border-zinc-200 dark:border-zinc-800 font-semibold text-center">Size</th>
                  <th className="p-2 border border-zinc-200 dark:border-zinc-800 font-semibold text-center">Wk 0</th>
                  <th className="p-2 border border-zinc-200 dark:border-zinc-800 font-semibold text-center">Wk 1</th>
                  <th className="p-2 border border-zinc-200 dark:border-zinc-800 font-semibold text-center">Wk 2</th>
                  <th className="p-2 border border-zinc-200 dark:border-zinc-800 font-semibold text-center">Wk 3</th>
                  <th className="p-2 border border-zinc-200 dark:border-zinc-800 font-semibold text-center">Wk 4</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cohorts.map((row, i) => (
                  <tr key={i}>
                    <td className="p-2 border border-zinc-200 dark:border-zinc-800 font-medium">{row.cohort}</td>
                    <td className="p-2 border border-zinc-200 dark:border-zinc-800 text-center font-semibold text-zinc-700 dark:text-zinc-300">{row.size}</td>
                    <td className="p-2 border text-center bg-emerald-500 text-white font-bold">100%</td>
                    <td className="p-2 border text-center text-white font-bold" style={{ backgroundColor: `rgba(16, 185, 129, ${row.m1 / 100})` }}>{row.m1}%</td>
                    <td className="p-2 border text-center text-white font-bold" style={{ backgroundColor: `rgba(16, 185, 129, ${row.m2 / 100})` }}>{row.m2}%</td>
                    <td className="p-2 border text-center text-white font-bold" style={{ backgroundColor: `rgba(16, 185, 129, ${row.m3 / 100})` }}>{row.m3}%</td>
                    <td className="p-2 border text-center text-white font-bold" style={{ backgroundColor: `rgba(16, 185, 129, ${row.m4 / 100})` }}>{row.m4}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Checkout Funnel Tracking */}
        <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
          <h2 className="text-base font-bold flex items-center gap-1.5"><Target className="h-5 w-5 text-rose-500" /> Checkout Funnel Analytics</h2>
          <p className="text-xs text-muted-foreground">Tracks signup conversions through page visit, pricing selection, checkout, and receipt confirmation.</p>
          <div className="space-y-3.5">
            {funnel.map((step, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>{step.name}</span>
                  <span className="text-muted-foreground">{step.count} ({step.percent}%)</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${step.percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LTV & Revenue Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
          <h2 className="text-base font-bold flex items-center gap-1.5"><TrendingUp className="h-5 w-5 text-emerald-500" /> Revenue & LTV Forecast Engine</h2>
          <p className="text-xs text-muted-foreground">Adjust growth and churn values to calculate future cumulative revenue runs.</p>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Monthly New Signups Growth Rate</span>
                <span>{growthRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={growthRate}
                onChange={(e) => setGrowthRate(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Expected Monthly Plan Churn Rate</span>
                <span>{churnRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                value={churnRate}
                onChange={(e) => setChurnRate(Number(e.target.value))}
                className="w-full accent-rose-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-3">
            <div className="border rounded-lg p-3 bg-muted/20 text-center">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">3 Month Projection</span>
              <p className="text-lg font-bold text-violet-600 mt-1">${Math.round(projectRevenue(3)).toLocaleString()}</p>
            </div>
            <div className="border rounded-lg p-3 bg-muted/20 text-center">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">6 Month Projection</span>
              <p className="text-lg font-bold text-violet-600 mt-1">${Math.round(projectRevenue(6)).toLocaleString()}</p>
            </div>
            <div className="border rounded-lg p-3 bg-muted/20 text-center">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">12 Month Projection</span>
              <p className="text-lg font-bold text-violet-600 mt-1">${Math.round(projectRevenue(12)).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Segment Builder */}
        <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
          <h2 className="text-base font-bold flex items-center gap-1.5"><Layers className="h-5 w-5 text-violet-500" /> Dynamic User Segment Builder</h2>
          <p className="text-xs text-muted-foreground">Filter cohort sizes across signups age, minimum payment sizes (LTV), and active dates.</p>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Joined (Min Days)</label>
              <Input type="number" value={rulesJoined} onChange={(e) => setRulesJoined(e.target.value)} placeholder="e.g. 30" className="h-8 mt-1 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Min LTV ($)</label>
              <Input type="number" value={rulesLtv} onChange={(e) => setRulesLtv(e.target.value)} placeholder="e.g. 100" className="h-8 mt-1 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Active (Last N Days)</label>
              <Input type="number" value={rulesActive} onChange={(e) => setRulesActive(e.target.value)} placeholder="e.g. 7" className="h-8 mt-1 text-xs" />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={runSegmentQuery} disabled={loadingSegment} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              {loadingSegment ? "Checking Segment..." : "Run Query"}
            </Button>
          </div>

          {segmentCount !== null && (
            <div className="border rounded-lg p-3 bg-muted/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Matching Users Count:</span>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-bold">{segmentCount} users</Badge>
              </div>
              {segmentUsers.length > 0 && (
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground text-[10px] uppercase">Sample Matches:</p>
                  {segmentUsers.map((u) => (
                    <p key={u.id} className="font-mono text-[11px] truncate">· {u.name || "Anon"} ({u.email})</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
