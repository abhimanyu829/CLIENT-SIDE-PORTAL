"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface DemoSessionRow {
  id: string
  productId: string
  userId?: string | null
  sessionToken: string
  signedToken?: string | null
  previewUrl?: string | null
  isExpired: boolean
  isRevoked: boolean
  convertedToOrder: boolean
  abuseFlag: boolean
  viewedPages: number
  revokedReason?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  durationMinutes: number
  startedAt: string
  expiresAt: string
  revokedAt: string | null
  lastActivityAt: string | null
  convertedAt: string | null
  product: { id: string; name: string; slug: string; thumbnailUrl?: string | null }
}

interface Props {
  data: {
    activeSessions: DemoSessionRow[]
    recentSessions: DemoSessionRow[]
    abuseAlerts: DemoSessionRow[]
    productStats: Array<{ productId: string; _count: { id: number }; _sum: { convertedToOrder: unknown } }>
  }
}

function sessionStatus(s: DemoSessionRow) {
  if (s.isRevoked) return { label: "Revoked", color: "bg-red-100 text-red-700 border-red-200" }
  if (s.convertedToOrder) return { label: "Converted", color: "bg-green-100 text-green-700 border-green-200" }
  if (s.isExpired) return { label: "Expired", color: "bg-slate-100 text-slate-500 border-slate-200" }
  return { label: "Active", color: "bg-emerald-100 text-emerald-700 border-emerald-200" }
}

function RemainingBadge({ expiresAt }: { expiresAt: string }) {
  const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  if (remaining === 0) return <span className="text-slate-400">–</span>
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  return <span className="font-mono text-sm text-amber-600">{mins}m {secs}s</span>
}

function SessionTable({
  sessions,
  onRevoke,
}: {
  sessions: DemoSessionRow[]
  onRevoke: (s: DemoSessionRow) => void
}) {
  const [search, setSearch] = useState("")
  const filtered = sessions.filter(
    (s) =>
      s.product.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.includes(search) ||
      (s.ipAddress ?? "").includes(search)
  )

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search by product, session ID, or IP…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Session</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                  No sessions found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const st = sessionStatus(s)
                return (
                  <TableRow key={s.id} className={cn(s.abuseFlag && "bg-red-50/50")}>
                    <TableCell>
                      <div className="font-mono text-xs text-slate-500">
                        {s.id.slice(0, 8)}…
                      </div>
                      {s.abuseFlag && (
                        <span className="text-xs bg-red-100 text-red-700 px-1 rounded">⚠️ Abuse</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">{s.product.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", st.color)}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{s.viewedPages}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {s.ipAddress ?? "–"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(s.startedAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {!s.isExpired && !s.isRevoked ? (
                        <RemainingBadge expiresAt={s.expiresAt} />
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!s.isRevoked && !s.isExpired && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onRevoke(s)}
                          className="h-7 text-xs"
                        >
                          Revoke
                        </Button>
                      )}
                      {s.isRevoked && s.revokedReason && (
                        <span className="text-xs text-slate-400 italic">{s.revokedReason}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function AdminPreviewsClient({ data }: Props) {
  const [isPending, startTransition] = useTransition()
  const [revoking, setRevoking] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  const handleRevoke = async (session: DemoSessionRow) => {
    const r = prompt(
      `Revoke session for "${session.product.name}"?\n\nEnter reason (optional):`,
      "Abuse detected"
    )
    if (r === null) return // cancelled

    setRevoking(session.id)
    try {
      const res = await fetch(`/api/admin/previews/${session.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: r || "Revoked by admin" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success("Session revoked and token blacklisted")
      setTimeout(() => window.location.reload(), 500)
    } catch (err) {
      toast.error(`Failed to revoke: ${(err as Error).message}`)
    } finally {
      setRevoking(null)
    }
  }

  const totalActivePreviews = data.activeSessions.length
  const totalAbuseFlags = data.abuseAlerts.length
  const totalConversions = data.recentSessions.filter((s) => s.convertedToOrder).length
  const conversionRate =
    data.recentSessions.length > 0
      ? ((totalConversions / data.recentSessions.length) * 100).toFixed(1)
      : "0"

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Preview Sessions</h1>
        <p className="text-slate-500 text-sm mt-1">
          Monitor, manage, and revoke live preview sessions across all products
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Now", value: totalActivePreviews, accent: "text-emerald-600" },
          { label: "Abuse Flags", value: totalAbuseFlags, accent: "text-red-600" },
          { label: "Total (Recent)", value: data.recentSessions.length, accent: "text-slate-700" },
          { label: "Conversion Rate", value: `${conversionRate}%`, accent: "text-indigo-600" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="pt-5">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.accent}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({data.activeSessions.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Recent ({data.recentSessions.length})
          </TabsTrigger>
          <TabsTrigger value="abuse" className="data-[state=active]:text-red-600">
            ⚠️ Abuse ({data.abuseAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <SessionTable sessions={data.activeSessions} onRevoke={handleRevoke} />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <SessionTable sessions={data.recentSessions} onRevoke={handleRevoke} />
        </TabsContent>

        <TabsContent value="abuse" className="mt-4">
          {data.abuseAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              ✅ No abuse flags detected
            </div>
          ) : (
            <SessionTable sessions={data.abuseAlerts} onRevoke={handleRevoke} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
