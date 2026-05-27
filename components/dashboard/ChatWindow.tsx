"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { pusherClient } from "@/lib/pusher-client"

interface Message {
  id: string
  senderId: string
  content: string
  createdAt: string | Date
  sender?: { id: string; name: string | null; avatarUrl: string | null }
}

interface ChatRoom {
  id: string
  name: string
}

interface ChatWindowProps {
  initialRooms: ChatRoom[]
  initialMessages: Message[]
  currentUserId: string
  initialRoomId: string
}

export function ChatWindow({ initialRooms, initialMessages, currentUserId, initialRoomId }: ChatWindowProps) {
  const [activeRoomId, setActiveRoomId] = useState(initialRoomId)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Subscribe to Pusher channel for real-time messages
  useEffect(() => {
    const channel = pusherClient.subscribe(`chat-${activeRoomId}`)
    channel.bind("new-message", (data: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev
        return [...prev, data]
      })
    })
    return () => pusherClient.unsubscribe(`chat-${activeRoomId}`)
  }, [activeRoomId])

  const switchRoom = async (roomId: string) => {
    setActiveRoomId(roomId)
    setMessages([])
    const res = await fetch(`/api/chat/rooms/${roomId}/messages`)
    if (res.ok) {
      const { data } = await res.json()
      setMessages(data)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)

    // Optimistic add
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      senderId: currentUserId,
      content: text,
      createdAt: new Date().toISOString(),
      sender: { id: currentUserId, name: "You", avatarUrl: null },
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch(`/api/chat/rooms/${activeRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        const { data } = await res.json()
        // Replace optimistic with server response
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data : m)))
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full border rounded-xl overflow-hidden bg-background shadow-sm">
      {/* Sidebar */}
      {initialRooms.length > 1 && (
        <aside className="w-56 border-r flex flex-col bg-muted/10 shrink-0">
          <div className="p-3 border-b font-semibold text-sm">Rooms</div>
          <div className="flex-1 overflow-y-auto divide-y">
            {initialRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => switchRoom(room.id)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  room.id === activeRoomId
                    ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-muted/20"
                }`}
              >
                # {room.name}
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUserId
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                    {(msg.sender?.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  }`}
                >
                  {!isMe && (
                    <p className="text-[10px] font-bold mb-0.5 opacity-70">
                      {msg.sender?.name ?? "Support"}
                    </p>
                  )}
                  <p>{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border rounded-xl bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button onClick={sendMessage} disabled={!input.trim() || sending} className="rounded-xl">
            {sending ? "…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  )
}
