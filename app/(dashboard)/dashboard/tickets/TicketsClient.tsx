"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Ticket {
  id: string
  title: string
  status: string
  priority: string
  createdAt: Date
}

export default function TicketsClient({ initialTickets }: { initialTickets: Ticket[] }) {
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Get help from our enterprise support team.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Create New Ticket</Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/20 p-4 border rounded-xl">
        <div className="flex gap-2 w-full sm:w-auto">
          <input type="text" placeholder="Search tickets..." className="border rounded-lg px-3 py-2 text-sm flex-1 sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
          <select className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background">
            <option>All Statuses</option>
            <option>OPEN</option>
            <option>IN_PROGRESS</option>
            <option>RESOLVED</option>
            <option>CLOSED</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="border rounded-xl bg-background shadow-sm overflow-hidden">
        <div className="divide-y">
          {initialTickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No tickets found.</div>
          ) : (
            initialTickets.map(ticket => (
              <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} className="block hover:bg-muted/30 transition-colors p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">{ticket.id.slice(0, 8)}</span>
                      <h3 className="font-bold text-lg">{ticket.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
                    <span className="text-muted-foreground ml-2 hidden sm:block">→</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">Create Support Ticket</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <input type="text" className="w-full border rounded-lg p-2.5 text-sm bg-background" placeholder="Brief description of the issue" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm bg-background">
                    <option>Technical Issue</option>
                    <option>Billing</option>
                    <option>Feature Request</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm bg-background">
                    <option>LOW</option>
                    <option>MEDIUM</option>
                    <option>HIGH</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                  <div className="bg-muted/50 p-2 border-b flex gap-2 text-muted-foreground">
                    <button className="px-2 hover:text-foreground font-bold">B</button>
                    <button className="px-2 hover:text-foreground italic">I</button>
                    <button className="px-2 hover:text-foreground underline">U</button>
                    <div className="w-px h-5 bg-border mx-1"></div>
                    <button className="px-2 hover:text-foreground">&lt;/&gt;</button>
                  </div>
                  <textarea className="w-full p-3 text-sm min-h-[150px] resize-none outline-none bg-background" placeholder="Describe your issue in detail..."></textarea>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Attachments</label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                  <p className="text-sm text-muted-foreground">Click or drag files here to upload</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-muted/10 flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button>Submit Ticket</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
