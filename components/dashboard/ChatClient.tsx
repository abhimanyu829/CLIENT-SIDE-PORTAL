"use client"
import { useState, useEffect, useRef } from "react"
import { useDashboardStore } from "@/hooks/useDashboardStore"
import { Sparkles, Send, Bot, User, CheckCircle2 } from "lucide-react"

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
      // Simulate API call for AI response
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
        <div className="bg-white border border-slate-200/90 shadow-sm p-5 rounded-2xl">
          <h2 className="font-extrabold text-lg text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Assistant
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-600 font-bold mb-1.5 block uppercase tracking-wider">
                Select Model
              </label>
              <select 
                value={model} 
                onChange={e => setModel(e.target.value)} 
                className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all shadow-xs cursor-pointer"
              >
                <option value="gpt-4o-mini" className="bg-white text-slate-900">GPT-4o Mini (Fast)</option>
                <option value="gpt-4o" className="bg-white text-slate-900">GPT-4o (Smart)</option>
                <option value="claude-3-5-sonnet" className="bg-white text-slate-900">Claude 3.5 Sonnet</option>
              </select>
            </div>
            
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 font-semibold">Monthly Usage</span>
                <span className="font-mono font-bold text-slate-900">
                  {stats?.aiTokensUsed?.toLocaleString() ?? 0} / {stats?.aiTokensLimit?.toLocaleString() ?? 100000}
                </span>
              </div>
              
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                <div 
                  className={`h-full rounded-full ${quotaPercent > 90 ? 'bg-rose-500' : 'bg-purple-600'}`}
                  style={{ width: `${Math.min(100, quotaPercent)}%`, transition: 'width 0.5s ease' }}
                />
              </div>
              <p className="text-[10px] text-slate-500 font-medium text-right">Resets on the 1st of every month</p>
            </div>
          </div>
        </div>

        {/* Feature Highlights Card */}
        <div className="hidden sm:block bg-gradient-to-br from-purple-50/80 to-indigo-50/60 border border-purple-200/80 p-4 rounded-2xl text-xs space-y-2.5">
          <div className="font-bold text-purple-950 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
            <span>AI Powered Support</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Ask questions about your projects, request data exports, or analyze your dashboard metrics.
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden">
        
        {/* Chat Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 border border-purple-200 text-purple-700">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">NexusAI Assistant</p>
              <p className="text-[10px] text-slate-500 font-medium">Model: {model.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Online
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/40">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
              <div className="p-4 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 mb-4 shadow-xs">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">NexusAI Assistant</h3>
              <p className="text-sm text-slate-600 mt-2 max-w-md leading-relaxed font-medium">
                Ask questions about your projects, request data exports, or analyze your dashboard metrics.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex gap-3.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' 
                    ? 'bg-purple-600 text-white font-medium rounded-tr-xs shadow-xs' 
                    : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs shadow-xs'
                }`}>
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar — Whitish Theme */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <form onSubmit={handleSend} className="relative flex items-center shadow-xs rounded-xl">
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-100 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all font-medium"
              placeholder="Ask me anything..."
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || loading}
              className="absolute right-2 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-purple-600 shadow-xs hover:scale-105"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

