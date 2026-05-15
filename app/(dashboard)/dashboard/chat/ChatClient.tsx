"use client"

import { useState, useRef, useEffect } from "react"

const S = `
.d-glass{background:rgba(255,255,255,.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
.d-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.d-scroll::-webkit-scrollbar{width:3px}.d-scroll::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:2px}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.d-live{animation:db 1.5s ease-in-out infinite}
@keyframes ds{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.d-msg{animation:ds .2s ease-out}
pre{background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.06);border-radius:.75rem;padding:1rem;overflow-x:auto;font-size:.75rem;margin:.5rem 0}
code{font-family:'Courier New',monospace;color:#c4b5fd}
`

interface Msg { id:string; role:"user"|"assistant"; content:string; tokens?:number }

const AGENTS = [
  { id:"nexus",   name:"NexusAI",       icon:"✦", desc:"General AI assistant — architecture, code, analytics" },
  { id:"coder",   name:"Code Agent",    icon:"⬡", desc:"Specialized coding, debugging, and refactoring" },
  { id:"deploy",  name:"Deploy Agent",  icon:"◈", desc:"Infrastructure, CI/CD, and deployment guidance" },
]

const STARTER_PROMPTS = [
  "Analyze my subscription trends and suggest optimizations",
  "Write a Next.js API route with Prisma and Zod validation",
  "Explain our deployment architecture and suggest improvements",
  "Generate a TypeScript interface for our user schema",
]

export default function ChatClient({ initialRooms, currentUserId }: { initialRooms: any[]; currentUserId: string }) {
  const [messages, setMessages] = useState<Msg[]>(() => {
    const room = initialRooms[0]
    if (!room) return []
    return room.messages.map((m:any) => ({ id:m.id, role: m.senderType==="AGENT"?"assistant":"user", content:m.content, tokens:Math.floor(Math.random()*200+50) }))
  })
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [agent, setAgent] = useState(AGENTS[0])
  const [totalTokens, setTotalTokens] = useState(4200)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: input }
    setMessages(p => [...p, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages:[...messages,userMsg].map(m=>({role:m.role,content:m.content})) }),
      })

      if (res.ok) {
        const data = await res.json()
        const tokens = Math.floor(Math.random()*300+100)
        setMessages(p => [...p, { id:`a-${Date.now()}`, role:"assistant", content: data.message ?? "I'm sorry, I couldn't process that request.", tokens }])
        setTotalTokens(t => t + tokens)
      } else {
        setMessages(p => [...p, { id:`a-${Date.now()}`, role:"assistant", content: "⚠️ The AI service is currently unavailable. Please check your API key configuration.", tokens:0 }])
      }
    } catch {
      setMessages(p => [...p, { id:`a-${Date.now()}`, role:"assistant", content: "⚠️ Connection error. Please try again.", tokens:0 }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex gap-4 max-w-6xl mx-auto" style={{height:"calc(100vh - 88px)"}}>
      <style>{S}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 gap-3">
        {/* Agent selector */}
        <div className="d-glass rounded-2xl p-3">
          <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">AI Agent</p>
          <div className="space-y-1">
            {AGENTS.map(a=>(
              <button key={a.id} onClick={()=>setAgent(a)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${agent.id===a.id?"bg-violet-600/30 border border-violet-500/30 text-violet-200":"d-glass text-zinc-500 hover:text-zinc-300"}`}>
                <span className="mr-1.5">{a.icon}</span>{a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Token usage */}
        <div className="d-glass rounded-2xl p-3">
          <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">Token Usage</p>
          <p className="text-xl font-black text-purple-400">{totalTokens.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-700">of 100,000/mo</p>
          <div className="h-1 bg-zinc-900 rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full" style={{width:`${(totalTokens/100000)*100}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)"}} />
          </div>
        </div>

        {/* Conversation history */}
        <div className="d-glass rounded-2xl p-3 flex-1">
          <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">History</p>
          <div className="space-y-1">
            {initialRooms.slice(0,5).map((r:any,i:number)=>(
              <button key={r.id} className={`w-full text-left px-2 py-2 rounded-lg text-[11px] transition-all ${i===0?"bg-white/5 text-zinc-300":"text-zinc-600 hover:text-zinc-400 hover:bg-white/3"} truncate`}>
                {i===0 ? "Current session" : `Session ${i+1}`}
              </button>
            ))}
          </div>
          <button className="w-full mt-2 d-glass rounded-xl py-2 text-[11px] text-zinc-600 hover:text-zinc-400 transition-all">
            + New chat
          </button>
        </div>
      </aside>

      {/* ── CHAT AREA ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col d-glass rounded-2xl overflow-hidden">

        {/* Chat header */}
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-purple-400">{agent.icon}</span>
            <div>
              <p className="text-sm font-bold">{agent.name}</p>
              <p className="text-[10px] text-zinc-600">{agent.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full d-live" />
            Connected
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto d-scroll p-5 space-y-5">
          {messages.length === 0 && (
            <div className="py-8 text-center space-y-6">
              <div className="text-5xl">✦</div>
              <div>
                <p className="font-black text-xl mb-1">How can I help you?</p>
                <p className="text-sm text-zinc-600">Ask anything about your projects, subscriptions, code, or architecture.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                {STARTER_PROMPTS.map(p=>(
                  <button key={p} onClick={()=>setInput(p)}
                    className="d-glass rounded-xl p-3 text-xs text-zinc-500 hover:text-zinc-300 hover:border-purple-500/30 transition-all text-left">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg=>(
            <div key={msg.id} className={`flex gap-3 d-msg ${msg.role==="user"?"flex-row-reverse":""}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${msg.role==="user"?"bg-violet-600":"bg-gradient-to-br from-purple-600 to-blue-600"}`}>
                {msg.role==="user"?"U":agent.icon}
              </div>
              <div className={`flex-1 max-w-xl space-y-1 ${msg.role==="user"?"items-end flex flex-col":""}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role==="user"?"bg-violet-600/20 border border-violet-500/20":"d-glass"}`}>
                  <p className="text-zinc-200 whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.tokens && msg.tokens > 0 && (
                  <p className="text-[10px] text-zinc-700">{msg.tokens} tokens</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 d-msg">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xs">{agent.icon}</div>
              <div className="d-glass rounded-2xl px-4 py-3">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i=>(
                    <div key={i} className="w-2 h-2 rounded-full bg-purple-400 d-live" style={{animationDelay:`${i*0.2}s`}} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/5 shrink-0">
          <div className="d-glass rounded-2xl overflow-hidden focus-within:border-purple-500/40 transition-all">
            <textarea
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()} }}
              placeholder={`Message ${agent.name}... (Enter to send, Shift+Enter for newline)`}
              rows={2}
              className="w-full px-4 pt-3 pb-1 resize-none outline-none bg-transparent text-sm text-white placeholder-zinc-700"
            />
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="flex gap-2">
                <button className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors">📎</button>
                <button className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors">Code</button>
              </div>
              <button onClick={send} disabled={!input.trim()||loading}
                className="d-btn px-4 py-1.5 rounded-xl text-xs font-bold text-white hover:scale-105 transition-all disabled:opacity-40 flex items-center gap-1.5">
                {loading ? "Thinking..." : "Send"} {!loading && "→"}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-zinc-800 text-center mt-2">{agent.name} can make mistakes. Verify important information.</p>
        </div>
      </div>
    </div>
  )
}
