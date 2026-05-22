"use client"
import { useState, useEffect, useRef } from "react"
import { useDashboardStore } from "@/hooks/useDashboardStore"

export default function ChatClient({ userId }: { userId: string }) {
  const { stats, setStats } = useDashboardStore()
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState("gpt-4o")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg = { role: "user", content: input }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      // Simulate API call for AI response (in reality this would hit an LLM API)
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content: userMsg.content,
          model,
        })
      })
      const { data } = await res.json()
      
      // Artificial delay for realism
      await new Promise(r => setTimeout(r, 1000))
      
      const aiResponse = "I'm a simulated AI response for the dashboard. To make this real, connect an OpenAI API key!"
      
      // Log assistant response to DB
      await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: data.roomId,
          role: "assistant",
          content: aiResponse,
          model,
          promptTokens: 20,
          completionTokens: 25
        })
      })

      setMessages(prev => [...prev, { role: "assistant", content: aiResponse }])
      
      // Optimistically update quota
      if (stats) {
        setStats({ ...stats, aiTokensUsed: stats.aiTokensUsed + 45 })
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: Could not connect to AI service." }])
    } finally {
      setLoading(false)
    }
  }

  const quotaPercent = stats ? (stats.aiTokensUsed / stats.aiTokensLimit) * 100 : 0

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-120px)] flex flex-col sm:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Sidebar - Quota & Settings */}
      <div className="w-full sm:w-64 flex flex-col gap-4 shrink-0">
        <div className="dash-glass p-5 rounded-2xl">
          <h2 className="font-bold text-lg mb-4">AI Assistant</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Model</label>
              <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500">
                <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                <option value="gpt-4o">GPT-4o (Smart)</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>
            
            <div className="pt-4 border-t border-white/5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">Monthly Usage</span>
                <span className="font-mono">{stats?.aiTokensUsed?.toLocaleString() ?? 0} / {stats?.aiTokensLimit?.toLocaleString() ?? 100000}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${quotaPercent > 90 ? 'bg-red-500' : 'bg-purple-500'}`}
                  style={{ width: `${Math.min(100, quotaPercent)}%`, transition: 'width 0.5s ease' }}
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 text-right">Resets on the 1st</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 dash-glass rounded-2xl border-white/5 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 dash-scroll space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <span className="text-4xl mb-4">✦</span>
              <h3 className="text-lg font-bold">NexusAI Assistant</h3>
              <p className="text-sm text-zinc-500 mt-2 max-w-md">Ask questions about your projects, request data exports, or analyze your dashboard metrics.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs">✦</span>
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-white/10 text-white rounded-tr-sm' : 'bg-transparent border border-white/5 text-zinc-300'
                }`}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <span className="text-xs">✦</span>
              </div>
              <div className="bg-transparent border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
              placeholder="Ask me anything..."
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || loading}
              className="absolute right-2 p-2 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
