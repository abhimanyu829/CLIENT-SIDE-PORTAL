"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const STAGES = ["Lead", "Contacted", "Proposal", "Won"]

const demoLeads = [
  { id: "1", name: "Acme Corp", value: 5000, stage: "Lead" },
  { id: "2", name: "Global Tech", value: 12000, stage: "Contacted" },
  { id: "3", name: "Stark Ind", value: 50000, stage: "Proposal" },
  { id: "4", name: "Wayne Ent", value: 25000, stage: "Won" },
]

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

export default function CRMTemplate() {
  const [leads, setLeads] = useState(demoLeads)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const handleDrop = (stage: string) => {
    if (draggedId) {
      setLeads(prev => prev.map(l => l.id === draggedId ? { ...l, stage } : l))
      setDraggedId(null)
    }
  }

  const totalPipeline = leads.filter(l => l.stage !== "Won").reduce((s, l) => s + l.value, 0)
  const wonCount = leads.filter(l => l.stage === "Won").length
  const winRate = leads.length > 0 ? Math.round((wonCount / leads.length) * 100) : 0

  return (
    <div className="flex h-full w-full bg-muted/20">
      {/* Sidebar Nav */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-4 border-b font-bold">Sales CRM AI</div>
        <nav className="p-4 space-y-2 flex-1">
          {["Dashboard", "Pipeline", "Contacts", "Reports", "Settings"].map(item => (
            <div key={item} className={`px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${item === "Pipeline" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}>
              {item}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main CRM Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header & KPIs */}
        <div className="p-6 border-b bg-background space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Pipeline Overview</h1>
            <Button size="sm">+ New Lead</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 border rounded-xl bg-card shadow-sm">
              <p className="text-sm text-muted-foreground">Total Pipeline</p>
              <p className="text-2xl font-bold">{fmt(totalPipeline)}</p>
            </div>
            <div className="p-4 border rounded-xl bg-card shadow-sm">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold text-green-600">{winRate}%</p>
            </div>
            <div className="p-4 border rounded-xl bg-card shadow-sm">
              <p className="text-sm text-muted-foreground">Active Deals</p>
              <p className="text-2xl font-bold">{leads.filter(l => l.stage !== "Won").length}</p>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 p-6 overflow-x-auto">
          <div className="flex gap-6 h-full min-w-max">
            {STAGES.map(stage => (
              <div
                key={stage}
                className="w-80 flex flex-col bg-muted/50 rounded-xl border p-4 h-full"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(stage)}
              >
                <div className="font-semibold mb-4 flex justify-between items-center text-sm">
                  <span>{stage}</span>
                  <span className="bg-background px-2 py-0.5 rounded-full border text-xs">
                    {leads.filter(l => l.stage === stage).length}
                  </span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {leads.filter(l => l.stage === stage).map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggedId(lead.id)}
                      className="bg-background p-4 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                    >
                      <div className="font-medium text-sm">{lead.name}</div>
                      <div className="text-muted-foreground text-sm mt-1">{fmt(lead.value)}</div>
                      <div className="mt-3 flex gap-2">
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded dark:bg-blue-900/30 dark:text-blue-400">
                          AI Scored: High
                        </span>
                      </div>
                    </div>
                  ))}
                  {leads.filter(l => l.stage === stage).length === 0 && (
                    <div className="h-20 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                      Drop leads here
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
