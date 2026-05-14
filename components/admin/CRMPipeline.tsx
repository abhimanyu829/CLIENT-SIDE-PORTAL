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
  createdAt: string | Date
}

interface CRMPipelineProps {
  initialLeads: Lead[]
  onStageChange?: (leadId: string, newStage: string) => Promise<void>
}

const STAGES = ["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]

const stageColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  PROPOSAL: "bg-orange-100 text-orange-700",
  NEGOTIATION: "bg-purple-100 text-purple-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-rose-100 text-rose-700",
}

export function CRMPipeline({ initialLeads, onStageChange }: CRMPipelineProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [dragId, setDragId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const displayStages = STAGES.slice(0, 4) // Pipeline view: exclude WON/LOST

  const handleDrop = async (stage: string) => {
    if (!dragId || leads.find((l) => l.id === dragId)?.stage === stage) return

    const prevLeads = leads
    setLeads((prev) => prev.map((l) => (l.id === dragId ? { ...l, stage } : l)))
    setLoadingId(dragId)
    setDragId(null)

    try {
      await onStageChange?.(dragId, stage)
    } catch {
      setLeads(prevLeads) // rollback on error
    } finally {
      setLoadingId(null)
    }
  }

  const scoreColor = (s: number) =>
    s >= 80 ? "text-emerald-600" : s >= 50 ? "text-orange-500" : "text-rose-500"

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {displayStages.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage === stage)
        return (
          <div
            key={stage}
            className="flex-shrink-0 w-64 flex flex-col bg-muted/20 rounded-xl border p-3 gap-3 min-h-[200px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${stageColors[stage]}`}>
                {stage}
              </span>
              <span className="text-xs text-muted-foreground bg-background border rounded-full px-2">
                {stageLeads.length}
              </span>
            </div>

            {stageLeads.map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={() => setDragId(lead.id)}
                className={`bg-background rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all shadow-sm ${
                  loadingId === lead.id ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <p className="font-semibold text-sm leading-tight">{lead.name ?? lead.email}</p>
                {lead.company && (
                  <p className="text-xs text-muted-foreground mt-0.5">{lead.company}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground uppercase">{lead.source}</span>
                  <span className={`text-xs font-bold ${scoreColor(lead.score)}`}>
                    {lead.score}pts
                  </span>
                </div>
              </div>
            ))}

            {stageLeads.length === 0 && (
              <div className="flex-1 border-2 border-dashed rounded-lg flex items-center justify-center min-h-[80px]">
                <span className="text-xs text-muted-foreground">Drop here</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
