"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderType: string
  content: string
  fileUrl: string | null
  isRead: boolean
  createdAt: Date
}

interface ChatRoom {
  id: string
  isActive: boolean
  createdAt: Date
  messages: ChatMessage[]
}

export default function ChatClient({ 
  initialRooms,
  currentUserId
}: { 
  initialRooms: ChatRoom[],
  currentUserId: string
}) {
  const [rooms, setRooms] = useState<ChatRoom[]>(initialRooms)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(initialRooms[0]?.id || null)
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)

  const activeRoom = rooms.find(r => r.id === activeRoomId)
  const messages = activeRoom?.messages || []

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping, activeRoomId])

  const handleSend = () => {
    if (!input.trim() || !activeRoomId) return

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      roomId: activeRoomId,
      senderId: currentUserId,
      senderType: "USER",
      content: input,
      fileUrl: null,
      isRead: false,
      createdAt: new Date()
    }

    setRooms(prev => prev.map(room => {
      if (room.id === activeRoomId) {
        return { ...room, messages: [...room.messages, newMsg] }
      }
      return room
    }))
    setInput("")
    setIsTyping(true)

    // Mock agent reply (would be replaced by actual websocket/API call)
    setTimeout(() => {
      setRooms(prev => prev.map(room => {
        if (room.id === activeRoomId) {
          return {
            ...room,
            messages: [
              ...room.messages.map(m => ({ ...m, isRead: true })),
              {
                id: (Date.now() + 1).toString(),
                roomId: activeRoomId,
                senderId: "agent-1",
                senderType: "AGENT",
                content: "I am an AI assistant. How can I help you further?",
                fileUrl: null,
                isRead: true,
                createdAt: new Date()
              }
            ]
          }
        }
        return room
      }))
      setIsTyping(false)
    }, 2000)
  }

  const createNewRoom = () => {
    const newRoomId = Date.now().toString()
    const newRoom: ChatRoom = {
      id: newRoomId,
      isActive: true,
      createdAt: new Date(),
      messages: []
    }
    setRooms(prev => [newRoom, ...prev])
    setActiveRoomId(newRoomId)
  }

  return (
    <div className="flex h-full max-h-[calc(100vh-8rem)] bg-background border rounded-xl shadow-sm overflow-hidden relative">
      {/* Sidebar (Conversations) */}
      <div className="w-80 border-r bg-muted/10 hidden md:flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Conversations</h2>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {rooms.map(room => {
            const lastMessage = room.messages[room.messages.length - 1]
            const isActive = room.id === activeRoomId
            return (
              <div 
                key={room.id} 
                className={`p-4 cursor-pointer transition-colors ${isActive ? 'bg-muted/30 border-l-4 border-primary' : 'hover:bg-muted/10 border-l-4 border-transparent'}`}
                onClick={() => setActiveRoomId(room.id)}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-${isActive ? 'bold' : 'medium'} text-sm`}>Chat {room.id.slice(-4)}</span>
                  <span className="text-xs text-muted-foreground">
                    {lastMessage ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(room.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {lastMessage ? lastMessage.content : "New Conversation"}
                </p>
              </div>
            )
          })}
          {rooms.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">No conversations yet</div>
          )}
        </div>
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={createNewRoom}>New Conversation</Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-background relative">
        {/* Header */}
        <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-xl">🤖</div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
            </div>
            <div>
              <h3 className="font-bold text-sm">AI Support Agent</h3>
              <p className="text-xs text-green-600 font-medium">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">📞</Button>
            <Button variant="ghost" size="icon">⋮</Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/5">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground mt-10">Send a message to start chatting</div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.senderType === 'USER'
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] space-y-1`}>
                    <div className={`p-4 rounded-2xl ${
                      isUser 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-background border shadow-sm rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      
                      {msg.fileUrl && (
                        <div className="mt-3 flex items-center gap-3 p-3 bg-background/20 rounded-lg border border-primary-foreground/20">
                          <span className="text-2xl">📄</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Attachment</p>
                          </div>
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer">
                            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-background/20">⬇️</Button>
                          </a>
                        </div>
                      )}
                    </div>
                    
                    <div className={`flex items-center gap-1 text-xs text-muted-foreground ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isUser && (
                        <span className={msg.isRead ? 'text-blue-500' : ''}>
                          {msg.isRead ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-background border shadow-sm p-4 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-card border-t shrink-0">
          <div className="flex items-end gap-2 bg-background border rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary transition-all">
            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">📎</Button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Type a message..."
              className="flex-1 max-h-32 min-h-[40px] resize-none outline-none bg-transparent py-2 text-sm"
              rows={1}
            />
            <Button onClick={handleSend} className="shrink-0 rounded-lg px-6 h-10 font-medium" disabled={!activeRoomId}>Send</Button>
          </div>
          <div className="text-center mt-2">
            <span className="text-[10px] text-muted-foreground">Powered by OpenClaude Realtime (Pusher WebSockets)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
