"use client"

import { useState, useRef, useEffect } from "react"

const S = `
.d-glass{background:hsl(var(--card));backdrop-filter:blur(20px);border:1px solid hsl(var(--border))}
.d-btn{background:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.d-btn:hover{background:hsl(var(--primary)/0.9)}
.d-scroll::-webkit-scrollbar{width:3px}.d-scroll::-webkit-scrollbar-thumb{background:hsl(var(--primary)/0.3);border-radius:2px}
@keyframes db{0%,100%{opacity:1}50%{opacity:.3}}.d-live{animation:db 1.5s ease-in-out infinite}
@keyframes ds{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.d-msg{animation:ds .2s ease-out}
pre{background:hsl(var(--muted)/0.8);border:1px solid hsl(var(--border));border-radius:.75rem;padding:1rem;overflow-x:auto;font-size:.75rem;margin:.5rem 0;color:hsl(var(--foreground))}
code{font-family:'Courier New',monospace;color:hsl(var(--primary))}
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
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-sans">AI Agent</p>
          <div className="space-y-1">
            {AGENTS.map(a=>(
              <button key={a.id} onClick={()=>setAgent(a)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${agent.id===a.id?"bg-primary/10 border border-primary/30 text-primary":"d-glass text-muted-foreground hover:text-foreground"}`}>
                <span className="mr-1.5">{a.icon}</span>{a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Token usage */}
        <div className="d-glass rounded-2xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-sans">Token Usage</p>
          <p className="text-xl font-black text-primary">{totalTokens.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">of 100,000/mo</p>
          <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{width:`${(totalTokens/100000)*100}%`}} />
          </div>
        </div>

        {/* Conversation history */}
        <div className="d-glass rounded-2xl p-3 flex-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-sans">History</p>
          <div className="space-y-1">
            {initialRooms.slice(0,5).map((r:any,i:number)=>(
              <button key={r.id} className={`w-full text-left px-2 py-2 rounded-lg text-[11px] transition-all ${i===0?"bg-muted text-foreground":"text-muted-foreground hover:text-foreground hover:bg-muted/50"} truncate`}>
                {i===0 ? "Current session" : `Session ${i+1}`}
              </button>
            ))}
          </div>
          <button className="w-full mt-2 d-glass rounded-xl py-2 text-[11px] text-muted-foreground hover:text-foreground transition-all">
            + New chat
          </button>
        </div>
      </aside>

      {/* ── CHAT AREA ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col d-glass rounded-2xl overflow-hidden">

        {/* Chat header */}
        <div className="px-5 py-3 border-b border-border bg-muted/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-primary">{agent.icon}</span>
            <div>
              <p className="text-sm font-bold text-foreground">{agent.name}</p>
              <p className="text-[10px] text-muted-foreground">{agent.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full d-live" />
            Connected
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto d-scroll p-5 space-y-5 bg-background/50">
          {messages.length === 0 && (
            <div className="py-8 text-center space-y-6">
              <div className="text-5xl text-primary/50">✦</div>
              <div>
                <p className="font-black text-xl mb-1 text-foreground">How can I help you?</p>
                <p className="text-sm text-muted-foreground">Ask anything about your projects, subscriptions, code, or architecture.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                {STARTER_PROMPTS.map(p=>(
                  <button key={p} onClick={()=>setInput(p)}
                    className="bg-card border border-border rounded-xl p-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all text-left shadow-sm">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg=>(
            <div key={msg.id} className={`flex gap-3 d-msg ${msg.role==="user"?"flex-row-reverse":""}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${msg.role==="user"?"bg-primary text-primary-foreground":"bg-gradient-to-br from-primary to-accent text-primary-foreground"}`}>
                {msg.role==="user"?"U":agent.icon}
              </div>
              <div className={`flex-1 max-w-xl space-y-1 ${msg.role==="user"?"items-end flex flex-col":""}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role==="user"?"bg-primary/10 border border-primary/20 text-foreground":"d-glass text-foreground bg-card"}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.tokens && msg.tokens > 0 && (
                  <p className="text-[10px] text-muted-foreground">{msg.tokens} tokens</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 d-msg">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs text-primary-foreground">{agent.icon}</div>
              <div className="d-glass rounded-2xl px-4 py-3 bg-card">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i=>(
                    <div key={i} className="w-2 h-2 rounded-full bg-primary/60 d-live" style={{animationDelay:`${i*0.2}s`}} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border shrink-0 bg-card/80">
          <div className="bg-background border border-border rounded-2xl overflow-hidden focus-within:border-primary/50 transition-all shadow-sm">
            <textarea
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()} }}
              placeholder={`Message ${agent.name}... (Enter to send, Shift+Enter for newline)`}
              rows={2}
              className="w-full px-4 pt-3 pb-1 resize-none outline-none bg-transparent text-sm text-foreground placeholder-muted-foreground"
            />
            <div className="px-4 py-2 flex items-center justify-between border-t border-border/50 bg-muted/10">
              <div className="flex gap-2">
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">📎</button>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">Code</button>
              </div>
              <button onClick={send} disabled={!input.trim()||loading}
                className="d-btn px-4 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 hover:scale-105">
                {loading ? "Thinking..." : "Send"} {!loading && "→"}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">{agent.name} can make mistakes. Verify important information.</p>
        </div>
      </div>
    </div>
  )
}
