"use client"

import { useState } from "react"
import Link from "next/link"

const S = `
.d-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.d-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.d-live{animation:db 1.5s ease-in-out infinite}
.d-scroll::-webkit-scrollbar{width:3px}.d-scroll::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:2px}
`

const STATUS_OPTIONS = ["OPEN","IN_PROGRESS","WAITING","RESOLVED","CLOSED"]
const STATUS_STYLE: Record<string,string> = {
  OPEN:        "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  WAITING:     "bg-amber-500/10 text-amber-400 border-amber-500/30",
  RESOLVED:    "bg-zinc-700/30 text-zinc-400 border-zinc-600/30",
  CLOSED:      "bg-zinc-900/50 text-zinc-600 border-zinc-800/30",
}

interface Msg { id:string; senderId:string; content:string; isInternal:boolean; createdAt:Date }
interface Ticket { id:string; title:string; priority:string; status:string; category?:string; createdAt:Date; messages:Msg[] }

const AI_SUGGESTIONS = [
  "Could you provide the error message or logs?",
  "Thank you for your patience. Our team is investigating.",
  "This has been escalated to a senior engineer.",
]

export default function TicketDetailClient({ ticket, currentUserId }: { ticket: Ticket; currentUserId: string }) {
  const [replyText, setReplyText] = useState("")
  const [showAI, setShowAI] = useState(false)
  const [msgs, setMsgs] = useState(ticket.messages)

  const handleSend = () => {
    if (!replyText.trim()) return
    setMsgs(prev => [...prev, {
      id: `tmp-${Date.now()}`, senderId: currentUserId, content: replyText,
      isInternal: false, createdAt: new Date()
    }])
    setReplyText("")
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <style>{S}</style>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <Link href="/dashboard/tickets" className="hover:text-zinc-400 transition-colors">Support</Link>
        <span>/</span>
        <span className="text-zinc-400 truncate">{ticket.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── MAIN THREAD ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Ticket Header */}
          <div className="d-glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="text-xl font-black leading-tight">{ticket.title}</h1>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border whitespace-nowrap ${STATUS_STYLE[ticket.status] ?? STATUS_STYLE.OPEN}`}>
                {ticket.status?.replace("_"," ")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
              <span className="font-mono">#{ticket.id.slice(0,8)}</span>
              <span>·</span>
              <span>{ticket.category ?? "General"}</span>
              <span>·</span>
              <span className={`font-bold ${ticket.priority==="HIGH"?"text-red-400":ticket.priority==="MEDIUM"?"text-amber-400":"text-zinc-500"}`}>
                {ticket.priority} Priority
              </span>
              <span>·</span>
              <span>{new Date(ticket.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="d-glass rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <p className="text-sm font-bold">Conversation Thread</p>
              <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full d-live" />
                Real-time
              </div>
            </div>

            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto d-scroll">
              {msgs.length === 0 ? (
                <div className="py-12 text-center text-zinc-600 text-sm">No messages yet. Start the conversation below.</div>
              ) : msgs.map(msg => {
                const isUser = msg.senderId === currentUserId
                return (
                  <div key={msg.id} className="p-5 flex gap-3">
                    <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-black ${isUser ? "bg-violet-600" : "bg-blue-600"}`}>
                      {isUser ? "ME" : "ST"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-sm font-bold">{isUser ? "You" : "Support Staff"}</p>
                        {!isUser && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black tracking-wider">STAFF</span>}
                        <span className="text-xs text-zinc-700 ml-auto">{new Date(msg.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                      <div className={`d-glass rounded-xl p-4 text-sm text-zinc-300 leading-relaxed ${!isUser ? "border-blue-500/10" : ""}`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Typing indicator */}
            <div className="px-5 py-3 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs text-zinc-700">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full d-live" />
                Support agent is typing...
              </div>
            </div>
          </div>

          {/* AI Suggestions */}
          {showAI && (
            <div className="d-glass rounded-2xl p-4 border border-purple-500/20">
              <p className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-1.5">
                ✦ AI Reply Suggestions
              </p>
              <div className="space-y-2">
                {AI_SUGGESTIONS.map((s,i)=>(
                  <button key={i} onClick={()=>setReplyText(s)}
                    className="w-full text-left d-glass rounded-xl p-3 text-xs text-zinc-400 hover:text-zinc-200 hover:border-purple-500/30 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reply Box */}
          <div className="d-glass rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-zinc-950/50">
              <button className="text-xs text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded hover:bg-white/5 font-bold">B</button>
              <button className="text-xs text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded hover:bg-white/5 italic">I</button>
              <button className="text-xs text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded hover:bg-white/5">{"</>"}</button>
              <div className="h-4 w-px bg-white/5 mx-1" />
              <button className="text-xs text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded hover:bg-white/5">📎</button>
              <button onClick={()=>setShowAI(o=>!o)}
                className={`ml-auto text-xs px-2.5 py-1 rounded-lg transition-all ${showAI ? "bg-purple-600/30 text-purple-300" : "text-zinc-600 hover:text-purple-300"}`}>
                ✦ AI Assist
              </button>
            </div>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend() }}
              className="w-full p-4 min-h-28 resize-none outline-none bg-transparent text-sm text-zinc-300 placeholder-zinc-700"
              placeholder="Type your reply... (⌘+Enter to send)"
            />
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
              <p className="text-xs text-zinc-700">Markdown supported</p>
              <div className="flex gap-2">
                <button className="d-glass px-3 py-2 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 transition-all">Close Ticket</button>
                <button onClick={handleSend}
                  className="d-btn px-4 py-2 rounded-xl text-xs font-bold text-white hover:scale-105 transition-all disabled:opacity-50"
                  disabled={!replyText.trim()}>
                  Send Reply →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Status control */}
          <div className="d-glass rounded-2xl p-5">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Status</p>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map(s=>(
                <button key={s} className={`w-full text-left d-glass rounded-xl px-3 py-2.5 text-xs font-bold transition-all border ${ticket.status===s ? STATUS_STYLE[s] : "text-zinc-600 hover:text-zinc-300 hover:border-white/10"}`}>
                  {ticket.status===s && "● "}{s.replace("_"," ")}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket info */}
          <div className="d-glass rounded-2xl p-5">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Details</p>
            <div className="space-y-2.5 text-xs">
              {[["Ticket ID", `#${ticket.id.slice(0,8)}`],["Category", ticket.category??"General"],["Priority", ticket.priority],["Created", new Date(ticket.createdAt).toLocaleDateString()],["Messages", `${msgs.length} messages`]].map(([k,v])=>(
                <div key={k} className="flex items-center justify-between">
                  <span className="text-zinc-600">{k}</span>
                  <span className="text-zinc-300 font-medium font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="d-glass rounded-2xl p-5">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Activity</p>
            <div className="space-y-3">
              {[["Ticket opened","Just now"],["Assigned to support","2m ago"],["Status: In Progress","5m ago"]].map(([action,time],i)=>(
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-400">{action}</p>
                    <p className="text-[10px] text-zinc-700">{time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
