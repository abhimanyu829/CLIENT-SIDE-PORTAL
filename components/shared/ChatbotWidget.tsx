"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! How can I help you today?" }
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = { role: "user", content: input }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    try {
      // Streaming response interaction
      const guestSessionId = Math.random().toString(36).substring(2, 15)
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], sessionId: guestSessionId })
      })

      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ""

      setMessages(prev => [...prev, { role: "assistant", content: "" }])
      setIsTyping(false)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        assistantMessage += chunk

        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1].content = assistantMessage
          return newMessages
        })
      }
    } catch (error) {
      console.error("Chat error:", error)
      setIsTyping(false)
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again later." }])
    }
  }

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center text-2xl transition-all duration-300 hover:scale-110 z-50 ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        💬
      </button>

      {/* Chat Popup */}
      <div 
        className={`fixed bottom-6 right-6 w-[350px] sm:w-[400px] bg-background border shadow-2xl rounded-2xl flex flex-col transition-all duration-300 transform origin-bottom-right z-50 ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 pointer-events-none translate-y-4'
        }`}
        style={{ height: '500px', maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* Header */}
        <div className="p-4 bg-primary text-primary-foreground rounded-t-2xl flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <h3 className="font-bold text-sm">AI Assistant</h3>
              <p className="text-xs text-primary-foreground/80">Typically replies instantly</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-primary-foreground/80 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-br-sm' 
                  : 'bg-muted border text-foreground rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[80%] bg-muted border rounded-2xl rounded-bl-sm p-4 text-sm flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions / Escalation */}
        <div className="px-4 py-2 bg-background border-t shrink-0 flex justify-center">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
            Talk to Human
          </Button>
        </div>

        {/* Input */}
        <div className="p-3 bg-background border-t rounded-b-2xl shrink-0 flex gap-2 items-end">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type your message..."
            className="flex-1 max-h-32 min-h-[40px] p-2 text-sm bg-muted/50 border rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            rows={1}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isTyping} size="icon" className="shrink-0 h-10 w-10 rounded-xl">
            ↑
          </Button>
        </div>
      </div>
    </>
  )
}
