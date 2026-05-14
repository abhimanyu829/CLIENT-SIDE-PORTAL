"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface AuditLog {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  ip: string | null
  beforeJson: unknown
  afterJson: unknown
  createdAt: string | Date
  user: { name: string | null; email: string } | null
}

interface AuditViewerProps {
  logs: AuditLog[]
  showSearch?: boolean
}

const actionColors: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  login: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  failed: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
}

function getActionColor(action: string) {
  const key = Object.keys(actionColors).find((k) => action.toLowerCase().includes(k))
  return key ? actionColors[key] : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
}

export function AuditViewer({ logs, showSearch = true }: AuditViewerProps) {
  const [search, setSearch] = useState("")
  const [diffLog, setDiffLog] = useState<AuditLog | null>(null)

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.user?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.entity ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const hasDiff = (log: AuditLog) => log.beforeJson !== null || log.afterJson !== null

  return (
    <div className="flex flex-col gap-4">
      {showSearch && (
        <input
          type="text"
          placeholder="Search action, user, or entity..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      )}

      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="p-3 font-medium">Time</th>
              <th className="p-3 font-medium">Action</th>
              <th className="p-3 font-medium">Actor</th>
              <th className="p-3 font-medium">Entity</th>
              <th className="p-3 font-medium">IP</th>
              <th className="p-3 text-right font-medium">Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y font-mono text-xs">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                <td className="p-3 text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded font-semibold ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="p-3">{log.user?.name ?? log.user?.email ?? "System"}</td>
                <td className="p-3 text-muted-foreground">
                  {log.entity}
                  {log.entityId ? `#${log.entityId.slice(0, 8)}` : ""}
                </td>
                <td className="p-3 text-muted-foreground">{log.ip ?? "—"}</td>
                <td className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasDiff(log)}
                    onClick={() => setDiffLog(log)}
                  >
                    {hasDiff(log) ? "View" : "—"}
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No logs match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Diff Modal */}
      {diffLog && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setDiffLog(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-background border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-muted/10">
              <h3 className="font-bold font-mono text-sm">Diff — {diffLog.action}</h3>
              <button onClick={() => setDiffLog(null)} className="text-muted-foreground hover:text-foreground text-xl">
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 divide-x max-h-[60vh] overflow-auto">
              <div className="bg-rose-950/40 p-4">
                <p className="text-xs text-rose-400 font-bold mb-2">BEFORE</p>
                <pre className="text-xs text-rose-200 whitespace-pre-wrap">
                  {JSON.stringify(diffLog.beforeJson, null, 2)}
                </pre>
              </div>
              <div className="bg-emerald-950/40 p-4">
                <p className="text-xs text-emerald-400 font-bold mb-2">AFTER</p>
                <pre className="text-xs text-emerald-200 whitespace-pre-wrap">
                  {JSON.stringify(diffLog.afterJson, null, 2)}
                </pre>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end">
              <Button onClick={() => setDiffLog(null)}>Close</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
