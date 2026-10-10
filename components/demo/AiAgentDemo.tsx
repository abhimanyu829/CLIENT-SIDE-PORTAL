"use client"

/**
 * components/demo/AiAgentDemo.tsx
 * Interactive AI assistant demo backed by the REAL server endpoint
 * POST /api/ai/chat (server-side model key, streaming plain-text response).
 * No session id is sent, so this demo conversation is not persisted by the
 * endpoint. When the server reports the model is not configured (503), the
 * demo shows an honest unavailable state instead of scripted replies.
 */
import { useRef, useState } from "react"
import { Loader2, RotateCcw, Send, AlertTriangle, Bot } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

const SUGGESTIONS = [
  "Explain the difference between a chatbot and an AI agent.",
  "What information do I need before automating a support workflow?",
  "When should a business keep a human in the loop for AI output?",
]

export function AiAgentDemo() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function send(text: string) {
    const content = text.trim()
    if (!content || streaming || unavailable) return
    setError(null)
    const next: Message[] = [...messages, { role: "user", content }]
    setMessages(next)
    setInput("")
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      })

      if (res.status === 503) {
        setUnavailable(true)
        setError("The AI service is not configured on this deployment, so the demo cannot answer right now. No scripted replies are shown in place of a real model response.")
        return
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(typeof json?.error === "string" ? json.error : `The assistant returned an error (${res.status}).`)
        return
      }
      if (!res.body) {
        setError("The assistant returned an empty response.")
        return
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }])
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunkText = decoder.decode(value, { stream: true })
        if (!chunkText) continue
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { role: "assistant", content: last.content + chunkText }
          return copy
        })
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("The request failed. Check your connection and try again.")
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
        This demo sends your message to the server-side assistant endpoint, which calls the configured model
        provider. Conversations are not saved by this demo (no session id is sent). Do not type confidential
        or personal information. AI output may be inaccurate and must be reviewed before being relied on.
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Bot className="h-4 w-4 text-indigo-300" /> AI assistant — demonstration
          </p>
          <button
            type="button"
            onClick={() => { abortRef.current?.abort(); setMessages([]); setError(null) }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-accent/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>

        <div className="min-h-[280px] space-y-4 p-4" aria-live="polite">
          {messages.length === 0 && !error && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask a question to see how the assistant responds. Suggested prompts:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/10">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6 ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-secondary text-foreground"}`}>
                {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}

          {streaming && messages[messages.length - 1]?.role === "user" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for the model…
            </p>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void send(input) }}
          className="flex gap-2 border-t border-border p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder={unavailable ? "AI service unavailable on this deployment" : "Ask the assistant…"}
            aria-label="Message the AI assistant"
            disabled={unavailable || streaming}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || unavailable || input.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </form>
      </div>
    </div>
  )
}