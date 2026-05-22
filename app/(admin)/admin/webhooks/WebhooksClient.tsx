"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import {
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Skull,
  Webhook,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"

type WebhookStatus = "PENDING" | "PROCESSED" | "FAILED" | "DEAD"
type WebhookSource = "STRIPE" | "RAZORPAY" | "INTERNAL"

interface WebhookEventRow {
  id: string
  source: WebhookSource
  eventType: string
  eventId: string
  status: WebhookStatus
  attempts: number
  createdAt: string
  lastAttemptAt: string | null
  processedAt: string | null
  errorMessage: string | null
  payload: object
}

interface Props {
  events: WebhookEventRow[]
  total: number
  page: number
  limit: number
  activeStatus: string
  activeSource: string
  statusCounts: Array<{ status: string; count: number }>
  dlqEvents: WebhookEventRow[]
  isSuperAdmin: boolean
}

const STATUS_CONFIG: Record<WebhookStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: "Pending",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
  PROCESSED: { label: "Processed", color: "bg-green-500/20 text-green-400 border-green-500/30",  icon: <CheckCircle2 className="w-3 h-3" /> },
  FAILED:    { label: "Failed",    color: "bg-red-500/20 text-red-400 border-red-500/30",         icon: <AlertTriangle className="w-3 h-3" /> },
  DEAD:      { label: "Dead",      color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",      icon: <Skull className="w-3 h-3" /> },
}

function StatusBadge({ status }: { status: WebhookStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", cfg.color)}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function PayloadViewer({ payload }: { payload: object }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs text-zinc-400 hover:text-white p-0 h-auto">
          View Payload <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 p-3 bg-zinc-900 rounded-lg text-[10px] text-zinc-300 overflow-auto max-h-48 border border-zinc-800">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function WebhooksClient({
  events,
  total,
  page,
  limit,
  activeStatus,
  activeSource,
  statusCounts,
  dlqEvents,
  isSuperAdmin,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [replayingId, setReplayingId] = useState<string | null>(null)

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s.count]))

  const totalPages = Math.ceil(total / limit)

  const handleReplay = async (eventId: string) => {
    setReplayingId(eventId)
    try {
      const res = await fetch(`/api/admin/webhooks/${eventId}/replay`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Replay failed", description: data.error, variant: "destructive" })
      } else {
        toast({ title: "Replayed", description: `Webhook event re-queued for processing` })
        startTransition(() => router.refresh())
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" })
    } finally {
      setReplayingId(null)
    }
  }

  const EventTable = ({ rows }: { rows: WebhookEventRow[] }) => (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-400">Event Type</TableHead>
            <TableHead className="text-zinc-400">Source</TableHead>
            <TableHead className="text-zinc-400">Status</TableHead>
            <TableHead className="text-zinc-400">Attempts</TableHead>
            <TableHead className="text-zinc-400">Received</TableHead>
            <TableHead className="text-zinc-400">Error</TableHead>
            <TableHead className="text-zinc-400">Payload</TableHead>
            <TableHead className="text-zinc-400">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-zinc-500 py-12">
                No webhook events found
              </TableCell>
            </TableRow>
          )}
          {rows.map((event) => (
            <TableRow key={event.id} className="border-zinc-800 hover:bg-zinc-900/50">
              <TableCell>
                <div>
                  <p className="text-sm font-mono text-white">{event.eventType}</p>
                  <p className="text-[10px] text-zinc-500 truncate max-w-[180px]">{event.eventId}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded font-medium",
                  event.source === "STRIPE" ? "bg-violet-500/20 text-violet-400" : "bg-blue-500/20 text-blue-400"
                )}>
                  {event.source}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={event.status} />
              </TableCell>
              <TableCell className="text-zinc-300 text-sm">{event.attempts}</TableCell>
              <TableCell className="text-zinc-400 text-xs">
                {new Date(event.createdAt).toLocaleString()}
              </TableCell>
              <TableCell>
                {event.errorMessage ? (
                  <span className="text-red-400 text-xs line-clamp-2 max-w-[200px]">
                    {event.errorMessage}
                  </span>
                ) : (
                  <span className="text-zinc-600 text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                <PayloadViewer payload={event.payload} />
              </TableCell>
              <TableCell>
                {["FAILED", "DEAD"].includes(event.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs gap-1.5"
                    onClick={() => handleReplay(event.id)}
                    disabled={replayingId === event.id || event.attempts >= 10}
                  >
                    {replayingId === event.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Replay
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Webhook className="w-6 h-6 text-violet-400" />
            Webhooks & Events
          </h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Idempotent webhook event log with replay capability
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-300 gap-2"
          onClick={() => startTransition(() => router.refresh())}
          disabled={isPending}
        >
          <RefreshCw className={cn("w-4 h-4", isPending && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">{cfg.label}</span>
              {cfg.icon}
            </div>
            <p className="text-2xl font-bold text-white mt-2">
              {(statusMap[status] ?? 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select
          value={activeSource || "all"}
          onValueChange={(v) => {
            const url = new URL(window.location.href)
            if (v === "all") url.searchParams.delete("source")
            else url.searchParams.set("source", v)
            url.searchParams.set("page", "1")
            router.push(url.pathname + "?" + url.searchParams.toString())
          }}
        >
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="STRIPE">Stripe</SelectItem>
            <SelectItem value="RAZORPAY">Razorpay</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeStatus || "all"}
        onValueChange={(v) => {
          const url = new URL(window.location.href)
          if (v === "all") url.searchParams.delete("status")
          else url.searchParams.set("status", v)
          url.searchParams.set("page", "1")
          router.push(url.pathname + "?" + url.searchParams.toString())
        }}
      >
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="all">All ({total})</TabsTrigger>
          {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
            <TabsTrigger key={s} value={s}>
              {cfg.label} ({statusMap[s] ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeStatus || "all"} className="mt-4">
          <EventTable rows={events} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-zinc-400 text-sm">
                Page {page} of {totalPages} — {total} total events
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-300"
                  disabled={page <= 1}
                  onClick={() => {
                    const url = new URL(window.location.href)
                    url.searchParams.set("page", String(page - 1))
                    router.push(url.pathname + "?" + url.searchParams.toString())
                  }}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-300"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const url = new URL(window.location.href)
                    url.searchParams.set("page", String(page + 1))
                    router.push(url.pathname + "?" + url.searchParams.toString())
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dead Letter Queue Section */}
      {dlqEvents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skull className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-300">Dead Letter Queue</h2>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              {dlqEvents.length} events require manual intervention
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            These events failed 5+ times and have been moved to the dead-letter queue.
            Manual review and replay is required.
          </p>
          <EventTable rows={dlqEvents} />
        </div>
      )}
    </div>
  )
}
