"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface Msg { role: "user" | "assistant"; content: string; citations?: { title: string; canonicalUrl: string | null }[] }

export function AiSupportWidget() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Hi! Ask about products, pricing, docs, or describe an issue." }])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [guestToken] = useState(() => Math.random().toString(36).slice(2, 18))
  const [ticketDraft, setTicketDraft] = useState(false)
  const [ticketTitle, setTicketTitle] = useState("")
  const [ticketDesc, setTicketDesc] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: "user", content: input }
    setMsgs((p) => [...p, userMsg])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/ai-support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, conversationId: conversationId ?? undefined, guestToken }),
      })
      const data = await res.json()
      if (data.conversationId) setConversationId(data.conversationId)
      if (data.error) setMsgs((p) => [...p, { role: "assistant", content: data.error }])
      else
        setMsgs((p) => [
          ...p,
          { role: "assistant", content: data.answer, citations: data.citations?.map((c: { title: string; canonicalUrl: string | null }) => ({ title: c.title, canonicalUrl: c.canonicalUrl })) },
        ])
    } catch {
      setMsgs((p) => [...p, { role: "assistant", content: "Service unavailable. Try again." }])
    }
    setLoading(false)
  }

  async function submitTicket() {
    const res = await fetch("/api/ai-support/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: ticketTitle, description: ticketDesc, conversationId: conversationId ?? undefined }),
    })
    const data = await res.json()
    if (data.ticket) {
      setMsgs((p) => [...p, { role: "assistant", content: `Ticket created: ${data.ticket.id} — ${data.ticket.title}. Track in dashboard tickets.` }])
      setTicketDraft(false)
      setTicketTitle("")
      setTicketDesc("")
    } else setMsgs((p) => [...p, { role: "assistant", content: data.error ?? "Ticket failed. Please use dashboard support." }])
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-xl z-50 bg-primary text-primary-foreground ${open ? "hidden" : ""}`}
        aria-label="Open support chat"
      >
        💬
      </button>
      {open && (
        <div className="fixed bottom-6 right-6 w-[380px] max-w-[92vw] h-[520px] bg-background border rounded-2xl shadow-2xl flex flex-col z-50">
          <div className="p-3 bg-primary text-primary-foreground rounded-t-2xl flex justify-between items-center">
            <span className="font-semibold text-sm">Support Assistant</span>
            <button onClick={() => setOpen(false)} className="text-primary-foreground/80">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl p-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  {m.citations?.length ? (
                    <div className="mt-1 text-xs opacity-70">
                      {m.citations.map((c, j) => (
                        <div key={j}>
                          {c.canonicalUrl ? (
                            <a href={c.canonicalUrl} target="_blank" rel="noopener" className="underline">
                              {c.title}
                            </a>
                          ) : (
                            c.title
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs text-muted-foreground">Thinking…</div>}
            <div ref={endRef} />
          </div>
          <div className="p-2 border-t flex justify-center">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setTicketDraft((v) => !v)}>
              {ticketDraft ? "Cancel" : "Report issue"}
            </Button>
          </div>
          {ticketDraft ? (
            <div className="p-3 border-t space-y-2">
              <input value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} placeholder="Issue title" className="w-full border rounded px-2 py-1 text-sm" />
              <textarea value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} placeholder="Describe the problem" rows={3} className="w-full border rounded px-2 py-1 text-sm" />
              <Button size="sm" onClick={submitTicket} disabled={!ticketTitle.trim() || !ticketDesc.trim()}>
                Submit ticket
              </Button>
            </div>
          ) : (
            <div className="p-2 border-t flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
                }}
                placeholder="Type message…"
                rows={1}
                className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none"
              />
              <Button onClick={send} disabled={!input.trim() || loading} size="icon">
                ↑
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
