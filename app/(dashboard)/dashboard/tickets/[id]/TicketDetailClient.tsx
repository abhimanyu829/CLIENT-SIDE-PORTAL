"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface TicketMessage {
  id: string
  senderId: string
  content: string
  isInternal: boolean
  createdAt: Date
}

interface Ticket {
  id: string
  title: string
  priority: string
  status: string
  createdAt: Date
  messages: TicketMessage[]
}

export default function TicketDetailClient({ ticket, currentUserId }: { ticket: Ticket, currentUserId: string }) {
  const [replyText, setReplyText] = useState("")

  return (
    <div className="max-w-4xl mx-auto space-y-6 min-h-full flex flex-col">
      <Link href="/dashboard/tickets" className="text-sm text-muted-foreground hover:text-primary mb-2 inline-block">
        ← Back to Tickets
      </Link>

      {/* Header Info */}
      <div className="border rounded-xl bg-background shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{ticket.title}</h1>
            <p className="text-sm text-muted-foreground">Ticket {ticket.id.slice(0, 8)} • Opened on {new Date(ticket.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              ticket.priority === 'HIGH' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              ticket.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {ticket.priority}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
              ticket.status === 'RESOLVED' ? 'bg-muted text-muted-foreground' :
              ticket.status === 'OPEN' ? 'border-green-500 text-green-600' :
              'border-yellow-500 text-yellow-600'
            }`}>
              {ticket.status}
            </span>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 space-y-6 pb-24">
        {ticket.messages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-background rounded-xl border">No messages yet.</div>
        ) : (
          ticket.messages.map((message) => {
            const isUser = message.senderId === currentUserId
            return (
              <div key={message.id} className="flex gap-4">
                <div className={`w-10 h-10 rounded-full flex shrink-0 items-center justify-center font-bold ${isUser ? 'bg-primary/20 text-primary' : 'bg-blue-100 text-blue-700'}`}>
                  {isUser ? 'ME' : 'ST'}
                </div>
                <div className={`flex-1 border rounded-xl shadow-sm overflow-hidden ${isUser ? 'bg-background' : 'bg-background border-blue-100 dark:border-blue-900'}`}>
                  <div className={`p-3 border-b flex justify-between text-sm ${isUser ? 'bg-muted/20' : 'bg-blue-50/50 dark:bg-blue-900/10'}`}>
                    <span className={`font-medium ${isUser ? '' : 'text-blue-700 dark:text-blue-400'}`}>
                      {isUser ? 'You' : 'Support Staff'}
                      {!isUser && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] px-1.5 py-0.5 rounded ml-2 uppercase font-bold">Staff</span>}
                    </span>
                    <span className="text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Reply Box (Sticky Bottom) */}
      <div className="fixed bottom-0 md:bottom-auto md:relative left-0 right-0 p-4 md:p-0 bg-background md:bg-transparent border-t md:border-0 z-10 w-full md:max-w-none">
        <div className="border rounded-xl bg-background shadow-sm overflow-hidden focus-within:border-primary/50 transition-colors">
          <div className="bg-muted/50 p-2 border-b flex gap-2 text-muted-foreground">
             <button className="px-2 hover:text-foreground font-bold">B</button>
             <button className="px-2 hover:text-foreground italic">I</button>
             <button className="px-2 hover:text-foreground">&lt;/&gt;</button>
             <div className="w-px h-5 bg-border mx-1"></div>
             <button className="px-2 hover:text-foreground">📎 Attach File</button>
          </div>
          <textarea 
            className="w-full p-4 min-h-[120px] resize-none outline-none bg-background text-sm" 
            placeholder="Type your reply here..."
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
          ></textarea>
          <div className="p-3 bg-muted/10 flex justify-between items-center border-t">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Live updates enabled
            </span>
            <div className="flex gap-2">
              <Button variant="outline">Close Ticket</Button>
              <Button>Send Reply</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
