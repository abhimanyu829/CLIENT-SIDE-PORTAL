"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export default function ChatbotTemplate() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Hi! I'm your AI support agent. How can I help you today?" }
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickReplies = ["Reset my password", "Where is my order?", "Pricing plans"]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
        })
      })

      if (!response.ok || !response.body) throw new Error("Stream failed")

      const assistantId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }])

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        // Handle SSE lines
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim()
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content ?? ""
              accumulated += delta
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m))
            } catch {
              // plain text stream
              accumulated += data
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m))
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }])
    } finally {
      setIsTyping(false)
    }
  }


  return (
    <div className="flex flex-col h-full bg-background max-w-4xl mx-auto border-x shadow-sm">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl">
            🤖
          </div>
          <div>
            <h2 className="font-bold">AI Support Agent</h2>
            <p className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Online
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm">Talk to Human</Button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div 
              className={`max-w-[80%] p-3 rounded-2xl ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground rounded-br-sm" 
                  : "bg-muted rounded-bl-sm"
              }`}
            >
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-muted p-4 rounded-2xl rounded-bl-sm flex gap-1 items-center">
              <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-card space-y-3">
        {messages.length === 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {quickReplies.map(reply => (
              <button 
                key={reply}
                onClick={() => handleSend(reply)}
                className="whitespace-nowrap px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors border"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
            placeholder="Type your message..."
            className="flex-1 p-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          />
          <Button onClick={() => handleSend(input)} className="rounded-xl px-6">
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
