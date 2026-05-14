"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Ticket {
  id: string
  title: string
  status: string
  priority: string
  category: string
  createdAt: string | Date
  updatedAt: string | Date
}

interface TicketListProps {
  tickets: Ticket[]
  onOpen?: (id: string) => void
  onCreateNew?: () => void
}

const statusBadge: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  WAITING: "bg-purple-100 text-purple-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-zinc-100 text-zinc-500",
}

const priorityDot: Record<string, string> = {
  HIGH: "bg-rose-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-zinc-300",
  CRITICAL: "bg-rose-700",
}

export function TicketList({ tickets, onOpen, onCreateNew }: TicketListProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const filtered = tickets.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "ALL" || t.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING">Waiting</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        {onCreateNew && (
          <Button onClick={onCreateNew} size="sm">
            New Ticket
          </Button>
        )}
      </div>

      {/* List */}
      <div className="divide-y border rounded-xl overflow-hidden">
        {filtered.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => onOpen?.(ticket.id)}
            className="flex items-center gap-4 p-4 hover:bg-muted/10 transition-colors cursor-pointer"
          >
            {/* Priority dot */}
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityDot[ticket.priority] ?? "bg-zinc-300"}`}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{ticket.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                #{ticket.id.slice(0, 8)} · {ticket.category} · Updated{" "}
                {new Date(ticket.updatedAt).toLocaleDateString()}
              </p>
            </div>

            {/* Status */}
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${statusBadge[ticket.status] ?? "bg-zinc-100 text-zinc-600"}`}
            >
              {ticket.status.replace("_", " ")}
            </span>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No tickets match your filters.</p>
            {onCreateNew && (
              <Button variant="link" className="mt-2 text-sm" onClick={onCreateNew}>
                Create your first ticket
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
