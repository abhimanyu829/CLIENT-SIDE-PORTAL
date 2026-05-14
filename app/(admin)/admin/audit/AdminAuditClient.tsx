"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface AuditLogEntry {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  ip: string | null
  beforeJson: unknown
  afterJson: unknown
  createdAt: Date
  user: { name: string; email: string } | null
}

export default function AdminAuditClient({ logs }: { logs: AuditLogEntry[] }) {
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [search, setSearch] = useState("")

  const filtered = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    (l.user?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (l.entity ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Track system events, administrative actions, and security alerts.</p>
        </div>
        <Button variant="outline">Export CSV</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-background p-4 border rounded-xl shadow-sm">
        <div className="flex-1 relative flex gap-2">
          <input
            type="text"
            placeholder="Search by actor, action, or entity..."
            className="flex-1 pl-4 pr-4 py-2 border rounded-lg bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="border rounded-lg px-3 py-2 text-sm bg-background">
            <option>All Actions</option>
            <option>user.*</option>
            <option>product.*</option>
            <option>subscription.*</option>
          </select>
        </div>
      </div>

      <div className="bg-background border rounded-xl shadow-sm flex-1 overflow-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0 backdrop-blur-sm z-10">
            <tr>
              <th className="p-4 font-medium">Time</th>
              <th className="p-4 font-medium">Action</th>
              <th className="p-4 font-medium">Actor</th>
              <th className="p-4 font-medium">Entity</th>
              <th className="p-4 font-medium">IP Address</th>
              <th className="p-4 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y font-mono text-xs">
            {filtered.map(log => (
              <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                <td className="p-4 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="p-4 font-bold text-primary">{log.action}</td>
                <td className="p-4">{log.user?.name ?? log.user?.email ?? "System"}</td>
                <td className="p-4 text-muted-foreground">{log.entity ?? "—"}{log.entityId ? `:${log.entityId.slice(0, 8)}` : ""}</td>
                <td className="p-4 text-muted-foreground">{log.ip ?? "—"}</td>
                <td className="p-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLog(log)}
                    disabled={!log.beforeJson && !log.afterJson}
                  >
                    {log.beforeJson || log.afterJson ? "View Diff" : "—"}
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-muted-foreground">Showing {filtered.length} of {logs.length} logs</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">1</Button>
          <Button variant="outline" size="sm">Next</Button>
        </div>
      </div>

      {selectedLog && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedLog(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-background rounded-xl shadow-2xl z-50 border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-muted/20">
              <h2 className="font-bold font-mono text-sm">Event: {selectedLog.action}</h2>
              <button onClick={() => setSelectedLog(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-0 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm max-h-[60vh] overflow-auto">
              <pre className="p-4">
                <code>
                  {JSON.stringify({ before: selectedLog.beforeJson, after: selectedLog.afterJson }, null, 2)}
                </code>
              </pre>
            </div>
            <div className="p-4 border-t bg-muted/10 flex justify-end">
              <Button onClick={() => setSelectedLog(null)}>Close</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
