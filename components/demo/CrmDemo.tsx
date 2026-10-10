"use client"

/**
 * components/demo/CrmDemo.tsx
 * Interactive CRM-style demonstration using SYNTHETIC in-browser data only.
 * No production records, no database writes, no server calls. Everything
 * resets on page reload; the Reset button restores the original sample set.
 */
import { useMemo, useState } from "react"
import { Search, RotateCcw } from "lucide-react"

type Stage = "New" | "Contacted" | "Qualified" | "Proposal" | "Won"

interface DemoLead {
  id: string
  company: string
  contact: string
  email: string
  value: number
  stage: Stage
  owner: string
  lastActivity: string
}

const STAGES: Stage[] = ["New", "Contacted", "Qualified", "Proposal", "Won"]

const SAMPLE_LEADS: DemoLead[] = [
  { id: "ld-001", company: "Northwind Traders", contact: "A. Sharma", email: "a.sharma@example.com", value: 240000, stage: "Qualified", owner: "sales-1", lastActivity: "Demo call completed" },
  { id: "ld-002", company: "Blue Harbor Logistics", contact: "M. Iyer", email: "m.iyer@example.com", value: 120000, stage: "Contacted", owner: "sales-2", lastActivity: "Follow-up email sent" },
  { id: "ld-003", company: "Orbit Analytics", contact: "R. Mehta", email: "r.mehta@example.com", value: 360000, stage: "Proposal", owner: "sales-1", lastActivity: "Proposal shared" },
  { id: "ld-004", company: "Cedarline Retail", contact: "S. Kaur", email: "s.kaur@example.com", value: 90000, stage: "New", owner: "unassigned", lastActivity: "Website enquiry received" },
  { id: "ld-005", company: "Vertex Health", contact: "P. Rao", email: "p.rao@example.com", value: 540000, stage: "Won", owner: "sales-1", lastActivity: "Contract signed" },
  { id: "ld-006", company: "Lumen Studios", contact: "K. Bose", email: "k.bose@example.com", value: 150000, stage: "Contacted", owner: "sales-3", lastActivity: "Intro call scheduled" },
  { id: "ld-007", company: "Harborline Foods", contact: "D. Nair", email: "d.nair@example.com", value: 75000, stage: "New", owner: "unassigned", lastActivity: "Pricing page visit" },
  { id: "ld-008", company: "Bluepeak Finance", contact: "T. Menon", email: "t.menon@example.com", value: 300000, stage: "Qualified", owner: "sales-2", lastActivity: "Requirements captured" },
  { id: "ld-009", company: "Quarry Works", contact: "V. Joshi", email: "v.joshi@example.com", value: 60000, stage: "Contacted", owner: "sales-2", lastActivity: "Reminder sent" },
  { id: "ld-010", company: "Fintrail Systems", contact: "N. Gupta", email: "n.gupta@example.com", value: 420000, stage: "Proposal", owner: "sales-1", lastActivity: "Revised quote requested" },
]

const currency = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

export function CrmDemo() {
  const [leads, setLeads] = useState<DemoLead[]>(SAMPLE_LEADS)
  const [query, setQuery] = useState("")
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All")
  const [selectedId, setSelectedId] = useState<string | null>(SAMPLE_LEADS[0]?.id ?? null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter((l) => {
      if (stageFilter !== "All" && l.stage !== stageFilter) return false
      if (!q) return true
      return [l.company, l.contact, l.email, l.owner].some((v) => v.toLowerCase().includes(q))
    })
  }, [leads, query, stageFilter])

  const pipeline = useMemo(
    () => STAGES.map((stage) => ({
      stage,
      count: leads.filter((l) => l.stage === stage).length,
      value: leads.filter((l) => l.stage === stage).reduce((sum, l) => sum + l.value, 0),
    })),
    [leads],
  )

  const selected = leads.find((l) => l.id === selectedId) ?? null
  const openValue = leads.filter((l) => l.stage !== "Won").reduce((s, l) => s + l.value, 0)
  const wonValue = leads.filter((l) => l.stage === "Won").reduce((s, l) => s + l.value, 0)

  function moveStage(id: string, direction: 1 | -1) {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const idx = STAGES.indexOf(l.stage)
        const next = STAGES[Math.min(STAGES.length - 1, Math.max(0, idx + direction))]
        return { ...l, stage: next, lastActivity: `Stage moved to ${next} (demo)` }
      }),
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
        Demonstration data — synthetic pipeline records held only in this browser session. Nothing here is a
        real customer and nothing is written to the Abhibhideveloper database. Reload or press Reset to
        restore the sample set.
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {pipeline.map((p) => (
          <button
            key={p.stage}
            type="button"
            onClick={() => setStageFilter(stageFilter === p.stage ? "All" : p.stage)}
            aria-pressed={stageFilter === p.stage}
            className={`rounded-2xl border p-4 text-left transition-colors ${stageFilter === p.stage ? "border-indigo-500/50 bg-indigo-500/10" : "border-border bg-card hover:bg-accent/5"}`}
          >
            <p className="text-xs text-muted-foreground">{p.stage}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{p.count}</p>
            <p className="text-[11px] text-muted-foreground">{currency(p.value)}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* List */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
            <label className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search company, contact, owner"
                aria-label="Search leads"
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as Stage | "All")}
              aria-label="Filter by stage"
              className="rounded-xl border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="All">All stages</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              type="button"
              onClick={() => { setLeads(SAMPLE_LEADS); setQuery(""); setStageFilter("All"); setSelectedId(SAMPLE_LEADS[0].id) }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs hover:bg-accent/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset demo
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No sample leads match this filter. Clear the search or choose “All stages”.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent/5 ${selectedId === l.id ? "bg-indigo-500/10" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{l.company}</p>
                        <p className="text-xs text-muted-foreground">{l.contact} · {l.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm tabular-nums text-foreground">{currency(l.value)}</p>
                        <p className="text-[11px] text-muted-foreground">{l.stage} · {l.owner}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pipeline totals</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Open pipeline</dt><dd className="tabular-nums">{currency(openValue)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Closed won</dt><dd className="tabular-nums">{currency(wonValue)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Leads shown</dt><dd className="tabular-nums">{filtered.length} of {leads.length}</dd></div>
            </dl>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              Totals are calculated from the sample dataset in this page. They are not business performance data.
            </p>
          </div>

          {selected ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-base font-semibold">{selected.company}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{selected.contact} · {selected.email}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="text-foreground">Deal value:</span> {currency(selected.value)} ·{" "}
                <span className="text-foreground">Stage:</span> {selected.stage}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="text-foreground">Last activity:</span> {selected.lastActivity}
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => moveStage(selected.id, -1)} className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-accent/10">
                  ← Move back
                </button>
                <button type="button" onClick={() => moveStage(selected.id, 1)} className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
                  Advance stage →
                </button>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Stage changes exist only in this browser session. A production CRM would persist changes to an
                authenticated database with server-side authorization.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
