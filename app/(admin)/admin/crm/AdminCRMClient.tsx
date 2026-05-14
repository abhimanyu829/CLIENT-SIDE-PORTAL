"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Lead {
  id: string
  name: string | null
  email: string
  company: string | null
  stage: string
  source: string
  score: number
  createdAt: Date
  updatedAt: Date
}

interface EmailSeq {
  id: string
  leadId: string
  name: string
  steps: unknown
  createdAt: Date
}

export default function AdminCRMClient({
  leads,
  sequences
}: {
  leads: Lead[]
  sequences: EmailSeq[]
}) {
  const [activeTab, setActiveTab] = useState("pipeline")
  const [localLeads, setLocalLeads] = useState(leads)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const STAGES = ["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]
  const stageColor: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700",
    CONTACTED: "bg-yellow-100 text-yellow-800",
    PROPOSAL: "bg-orange-100 text-orange-700",
    NEGOTIATION: "bg-purple-100 text-purple-700",
    WON: "bg-green-100 text-green-700",
    LOST: "bg-red-100 text-red-700"
  }

  const handleDrop = (stage: string) => {
    if (draggedId) {
      setLocalLeads(prev => prev.map(l => l.id === draggedId ? { ...l, stage } : l))
      setDraggedId(null)
    }
  }

  const totalPipeline = localLeads.filter(l => l.stage !== "WON" && l.stage !== "LOST").length
  const wonLeads = localLeads.filter(l => l.stage === "WON").length

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mini-CRM</h1>
          <p className="text-muted-foreground mt-1">Manage leads, pipeline, and email sequences.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "pipeline" && <Button>Add Deal</Button>}
          {activeTab === "leads" && <><Button variant="outline">Import CSV</Button><Button>Add Lead</Button></>}
          {activeTab === "sequences" && <Button>New Sequence</Button>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 border rounded-xl bg-card shadow-sm">
          <p className="text-sm text-muted-foreground">Active Leads</p>
          <p className="text-2xl font-bold">{totalPipeline}</p>
        </div>
        <div className="p-4 border rounded-xl bg-card shadow-sm">
          <p className="text-sm text-muted-foreground">Won Deals</p>
          <p className="text-2xl font-bold">{wonLeads}</p>
        </div>
        <div className="p-4 border rounded-xl bg-card shadow-sm">
          <p className="text-sm text-muted-foreground">Total Leads</p>
          <p className="text-2xl font-bold">{leads.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto shrink-0">
        {[{ id: "pipeline", label: "Pipeline" }, { id: "leads", label: "Leads" }, { id: "sequences", label: "Email Sequences" }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Pipeline Tab */}
        {activeTab === "pipeline" && (
          <div className="flex gap-4 overflow-x-auto h-full pb-4 animate-in fade-in duration-300 items-start">
            {STAGES.slice(0, 4).map(stage => {
              const stageLeads = localLeads.filter(l => l.stage === stage)
              return (
                <div
                  key={stage}
                  className="flex-shrink-0 w-64 bg-muted/20 rounded-xl p-3 space-y-3 flex flex-col min-h-[200px]"
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(stage)}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm capitalize">{stage.charAt(0) + stage.slice(1).toLowerCase()}</h3>
                    <span className="text-xs bg-background border rounded-full px-2 py-0.5 font-medium">{stageLeads.length}</span>
                  </div>
                  {stageLeads.map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggedId(lead.id)}
                      className="bg-background p-3 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-sm">{lead.name ?? lead.email}</p>
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{lead.score}pts</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{lead.company ?? lead.source}</p>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="flex-1 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-xs">Drop here</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="bg-background border rounded-xl shadow-sm flex-1 overflow-auto animate-in fade-in duration-300">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0 backdrop-blur-sm z-10">
                <tr>
                  <th className="p-4 w-12"><input type="checkbox" className="rounded" /></th>
                  <th className="p-4 font-medium">Lead</th>
                  <th className="p-4 font-medium">Company</th>
                  <th className="p-4 font-medium">Stage</th>
                  <th className="p-4 font-medium">Source</th>
                  <th className="p-4 font-medium">Score</th>
                  <th className="p-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {localLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4"><input type="checkbox" className="rounded" /></td>
                    <td className="p-4">
                      <p className="font-medium">{lead.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </td>
                    <td className="p-4 text-muted-foreground">{lead.company ?? "—"}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${stageColor[lead.stage] ?? "bg-zinc-100 text-zinc-700"}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">{lead.source}</td>
                    <td className="p-4 font-medium">{lead.score}</td>
                    <td className="p-4 text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {localLeads.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No leads yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sequences Tab */}
        {activeTab === "sequences" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full animate-in fade-in duration-300">
            <div className="border rounded-xl bg-background shadow-sm overflow-y-auto">
              <div className="p-4 border-b font-bold bg-muted/20">Email Sequences</div>
              <div className="divide-y">
                {sequences.length === 0 && <p className="p-4 text-sm text-muted-foreground">No sequences created.</p>}
                {sequences.map(seq => (
                  <div key={seq.id} className="p-4 hover:bg-muted/10 cursor-pointer border-l-2 border-primary bg-muted/5">
                    <p className="font-bold text-sm">{seq.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Created {new Date(seq.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 border rounded-xl bg-background shadow-sm p-6 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a sequence to view and edit its steps.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
