"use client"
import { useState, useEffect, useRef } from "react"
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel"
import { Send, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function TicketDetailClient({ ticket, userId }: { ticket: any, userId: string }) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/messages`)
      if (res.ok) {
        const { data } = await res.json()
        setMessages(data)
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchMessages()
  }, []) // eslint-disable-line

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Real-time updates via Pusher
  useRealtimeChannel(`private-user-${userId}`, "ticket.message", (data: any) => {
    if (data.ticketId === ticket.id) {
      setMessages(prev => {
        if (prev.find(m => m.id === data.message.id)) return prev
        return [...prev, data.message]
      })
    }
  })

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSending(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    const content = formData.get("content") as string
    
    // Optimistic UI
    const tempId = Date.now().toString()
    setMessages(prev => [...prev, { id: tempId, content, senderId: userId, createdAt: new Date() }])
    form.reset()

    try {
      await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
    } catch {
      alert("Failed to send message")
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-5 rounded-t-2xl border border-slate-200/90 border-b-0 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <Link href="/dashboard/tickets" className="text-xs font-bold text-slate-500 hover:text-purple-600 flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Tickets
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase">{ticket.status}</span>
            <span className="text-xs text-slate-400 font-mono">ID: {ticket.id.slice(0, 8)}</span>
          </div>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">{ticket.title}</h1>
        <p className="text-sm text-slate-600 font-medium mt-1">{ticket.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/50 border-x border-slate-200/90 p-5 space-y-4">
        {loading ? (
          <div className="text-center text-slate-500 text-sm mt-10 font-medium">Loading thread...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-500 text-sm mt-10 font-medium">No messages yet.</div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderId === userId
            return (
              <div key={m.id || i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-purple-600 text-white font-medium rounded-tr-xs shadow-xs" : "bg-white border border-slate-200 text-slate-900 rounded-tl-xs shadow-xs"}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className={`text-[10px] mt-1.5 font-medium ${isMe ? "text-purple-200" : "text-slate-400"}`}>
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white p-4 rounded-b-2xl border border-slate-200/90 border-t-0 shrink-0">
        <form onSubmit={handleSend} className="flex gap-3">
          <input 
            name="content" 
            required 
            autoComplete="off"
            className="flex-1 bg-slate-50 border border-slate-300 focus:bg-white text-slate-900 font-medium placeholder:text-slate-400 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all" 
            placeholder="Type your message..." 
          />
          <button 
            type="submit" 
            disabled={sending || ticket.status === "RESOLVED"}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>{sending ? "..." : "Send"}</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

