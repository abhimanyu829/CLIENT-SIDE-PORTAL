"use client"

import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"

interface Lead {
  id: string
  name: string | null
  email: string
  company: string | null
  stage: string
  source: string
  score: number
  createdAt: string | Date
  metadata?: any
}

interface LeadActivity {
  id: string
  type: string
  note: string
  createdBy: string
  createdAt: string
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
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)

  const displayStages = STAGES.slice(0, 4) // Pipeline view: exclude WON/LOST

  useEffect(() => {
    if (selectedLead) {
      setLoadingActivities(true);
      fetch(`/api/leads/${selectedLead.id}/activity`)
        .then(res => res.json())
        .then(data => setActivities(data.data || []))
        .finally(() => setLoadingActivities(false));
    }
  }, [selectedLead]);

  const handleDrop = async (stage: string) => {
    if (!dragId || leads.find((l) => l.id === dragId)?.stage === stage) return

    const prevLeads = leads
    setLeads((prev) => prev.map((l) => (l.id === dragId ? { ...l, stage } : l)))
    setLoadingId(dragId)
    setDragId(null)

    try {
      if (onStageChange) {
        await onStageChange(dragId, stage)
      } else {
        await fetch(`/api/leads`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dragId, stage })
        });
        window.location.reload(); // Quick refresh to recalculate scores accurately
      }
    } catch {
      setLeads(prevLeads) // rollback on error
    } finally {
      setLoadingId(null)
    }
  }

  const scoreColor = (s: number) =>
    s >= 80 ? "text-emerald-600 bg-emerald-100" : s >= 50 ? "text-orange-600 bg-orange-100" : "text-zinc-600 bg-zinc-100"

  return (
    <div className="relative">
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
                  onClick={() => setSelectedLead(lead)}
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
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${scoreColor(lead.score)}`}>
                      🔥 {lead.score}
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

      {selectedLead && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedLead(null)} />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l z-50 p-6 flex flex-col animate-in slide-in-from-right">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedLead.name || selectedLead.email}</h2>
                <p className="text-sm text-gray-500">{selectedLead.company}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="mb-6 p-4 rounded-lg bg-gray-50 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Score</p>
                <p className={`text-2xl font-black ${scoreColor(selectedLead.score).split(' ')[0]}`}>{selectedLead.score}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Stage</p>
                <span className={`text-xs font-bold px-2 py-1 rounded mt-1 inline-block ${stageColors[selectedLead.stage]}`}>
                  {selectedLead.stage}
                </span>
              </div>
            </div>

            <h3 className="font-bold border-b pb-2 mb-4">Activity Timeline</h3>
            <div className="flex-1 overflow-y-auto">
              {loadingActivities ? (
                <div className="animate-pulse space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <p className="text-gray-500 text-sm">No activity recorded yet.</p>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {activities.map((act) => (
                    <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full border border-white bg-slate-300 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                        <span className="text-xs">{act.type === 'STAGE_CHANGE' ? '🔄' : act.type === 'EMAIL' ? '📧' : '📝'}</span>
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded border border-slate-200 bg-white shadow">
                        <div className="flex items-center justify-between space-x-2 mb-1">
                          <div className="font-bold text-slate-900 text-sm">{act.type.replace('_', ' ')}</div>
                          <time className="text-xs font-medium text-amber-500">{formatDistanceToNow(new Date(act.createdAt), {addSuffix: true})}</time>
                        </div>
                        <div className="text-slate-500 text-xs">{act.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
