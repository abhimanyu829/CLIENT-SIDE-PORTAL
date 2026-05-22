"use client"
import { useState, useEffect, useRef } from "react"
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel"

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
      <div className="dash-glass p-5 rounded-t-2xl border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-white uppercase">{ticket.status}</span>
          <span className="text-xs text-zinc-500">ID: {ticket.id}</span>
        </div>
        <h1 className="text-xl font-bold">{ticket.title}</h1>
        <p className="text-sm text-zinc-400 mt-1">{ticket.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto dash-glass dash-scroll p-4 space-y-4">
        {loading ? (
          <div className="text-center text-zinc-500 text-sm mt-10">Loading thread...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-10">No messages yet.</div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderId === userId
            return (
              <div key={m.id || i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${isMe ? "bg-purple-600 text-white rounded-tr-sm" : "bg-white/10 text-zinc-200 rounded-tl-sm"}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-purple-300" : "text-zinc-500"}`}>
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="dash-glass p-4 rounded-b-2xl border-t border-white/5 shrink-0">
        <form onSubmit={handleSend} className="flex gap-3">
          <input 
            name="content" 
            required 
            autoComplete="off"
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500" 
            placeholder="Type your message..." 
          />
          <button 
            type="submit" 
            disabled={sending || ticket.status === "RESOLVED"}
            className="dash-btn px-6 py-2.5 rounded-xl font-medium text-sm transition-transform active:scale-95 disabled:opacity-50"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  )
}
