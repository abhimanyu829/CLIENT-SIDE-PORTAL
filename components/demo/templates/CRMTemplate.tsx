"use client"

import { useState, useEffect } from "react"

const S = `
.crm-glass{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:1rem;padding:1.25rem}
.crm-row:hover{background:rgba(255,255,255,.025)}
.crm-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.75rem;padding:.5rem 1.25rem;font-size:.8125rem;font-weight:700;color:#fff;transition:all .2s;cursor:pointer}
.crm-btn:hover{opacity:.9}
.crm-stage{font-size:.625rem;font-weight:900;padding:.2rem .5rem;border-radius:9999px;text-transform:uppercase;letter-spacing:.06em}
@keyframes crmpulse{0%,100%{opacity:.5}50%{opacity:1}}.crm-live{animation:crmpulse 2s infinite}
`

const MOCK_LEADS = [
  {id:"1",name:"Acme Corp",contact:"Sarah Chen",email:"sarah@acme.com",value:12000,stage:"PROPOSAL",probability:75},
  {id:"2",name:"TechFlow Inc",contact:"Marcus W",email:"marcus@tf.io",value:8500,stage:"QUALIFIED",probability:50},
  {id:"3",name:"DevLaunch",contact:"Priya K",email:"priya@dl.dev",value:22000,stage:"NEGOTIATION",probability:90},
  {id:"4",name:"StartupXYZ",contact:"Alex R",email:"alex@xyz.co",value:4200,stage:"NEW",probability:20},
  {id:"5",name:"ScaleBase",contact:"Jordan M",email:"jordan@sb.ai",value:35000,stage:"WON",probability:100},
]

const STAGE_STYLE: Record<string,string> = {
  NEW:         "bg-zinc-700/30 text-zinc-400",
  CONTACTED:   "bg-blue-500/15 text-blue-400",
  QUALIFIED:   "bg-amber-500/15 text-amber-400",
  PROPOSAL:    "bg-purple-500/15 text-purple-400",
  NEGOTIATION: "bg-orange-500/15 text-orange-400",
  WON:         "bg-emerald-500/15 text-emerald-400",
  LOST:        "bg-red-500/15 text-red-400",
}

export default function CRMTemplate() {
  const [leads, setLeads] = useState(MOCK_LEADS)
  const [selected, setSelected] = useState<string|null>(null)
  const [activity, setActivity] = useState<string[]>([])

  const totalPipeline = leads.reduce((s,l) => s + l.value * l.probability / 100, 0)

  useEffect(() => {
    const msgs = ["📧 Email sent to Acme Corp","✓ Call scheduled with DevLaunch","◑ Proposal viewed by TechFlow","✦ AI scored ScaleBase deal 94/100"]
    let i = 0
    const id = setInterval(() => {
      setActivity(prev => [msgs[i % msgs.length], ...prev.slice(0,4)])
      i++
    }, 3000)
    return () => clearInterval(id)
  }, [])

  const selectedLead = leads.find(l => l.id === selected)

  return (
    <div className="h-full flex gap-4 text-white bg-[#090909] p-4 rounded-2xl overflow-hidden">
      <style>{S}</style>

      {/* Left Panel */}
      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-black text-lg">CRM Pipeline</h2>
            <p className="text-xs text-zinc-600">Demo workspace · 5 min session</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full crm-live" />
            <span className="text-xs text-zinc-600">Live</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {label:"Pipeline",value:`$${(totalPipeline/1000).toFixed(0)}K`,color:"text-purple-400"},
            {label:"Active Deals",value:leads.filter(l=>!["WON","LOST"].includes(l.stage)).length,color:"text-blue-400"},
            {label:"Win Rate",value:"68%",color:"text-emerald-400"},
          ].map(s=>(
            <div key={s.label} className="crm-glass text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-600">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Lead Table */}
        <div className="crm-glass" style={{padding:0,overflow:"hidden"}}>
          <div className="px-4 py-3 border-b border-white/5">
            <p className="font-black text-sm">All Leads</p>
          </div>
          {leads.map(lead => (
            <div key={lead.id} onClick={() => setSelected(lead.id === selected ? null : lead.id)}
              className={`crm-row px-4 py-3 flex items-center gap-3 cursor-pointer border-b border-white/5 last:border-0 transition-all ${selected===lead.id?"bg-purple-500/8":""}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-xs font-black shrink-0">
                {lead.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{lead.name}</p>
                <p className="text-[11px] text-zinc-600">{lead.contact}</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold">${lead.value.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-600">{lead.probability}%</p>
              </div>
              <span className={`crm-stage ${STAGE_STYLE[lead.stage]}`}>{lead.stage}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-56 space-y-4 shrink-0 hidden lg:flex flex-col">
        {/* Lead detail */}
        {selectedLead ? (
          <div className="crm-glass">
            <p className="font-black text-sm mb-3">{selectedLead.name}</p>
            <p className="text-xs text-zinc-600 mb-1">{selectedLead.contact}</p>
            <p className="text-xs text-zinc-700 mb-3">{selectedLead.email}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Value</span>
                <span className="font-bold">${selectedLead.value.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Probability</span>
                <span className="font-bold text-emerald-400">{selectedLead.probability}%</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="crm-btn flex-1 text-[11px]">Email</button>
              <button className="crm-btn flex-1 text-[11px]">Call</button>
            </div>
          </div>
        ) : (
          <div className="crm-glass text-center text-xs text-zinc-700 py-8">
            Select a lead to view details
          </div>
        )}

        {/* Live Activity */}
        <div className="crm-glass flex-1 overflow-hidden">
          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full crm-live" />
            Activity
          </p>
          <div className="space-y-2">
            {activity.map((a,i) => (
              <p key={i} className="text-[10px] text-zinc-600 leading-relaxed">{a}</p>
            ))}
            {activity.length === 0 && <p className="text-[10px] text-zinc-800">Waiting for events...</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
