"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Users, ShieldOff, Pause, ShieldCheck, History } from "lucide-react"

interface Entitlement {
  id: string
  userName: string
  userEmail: string
  status: string
  grantedAt: string
  expiresAt?: string | null
  accessRevokedAt?: string | null
  revocationReason?: string | null
  orderId?: string | null
}

interface AuditEntry { id: string; action: string; entityId?: string | null; createdAt: string }

interface Props {
  data: {
    product: { id: string; name: string; slug: string }
    entitlements: Entitlement[]
    auditLogs: AuditEntry[]
  }
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  SUSPENDED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  REVOKED: "bg-red-500/10 text-red-400 border-red-500/20",
  EXPIRED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
}

export default function OwnershipsClient({ data }: Props) {
  const router = useRouter()
  const [entitlements, setEntitlements] = useState(data.entitlements)
  const [loading, setLoading] = useState<string | null>(null)

  const action = async (id: string, act: "REVOKE" | "SUSPEND" | "REACTIVATE") => {
    setLoading(id + act)
    try {
      const res = await fetch(`/api/admin/entitlements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const newStatus = act === "REVOKE" ? "REVOKED" : act === "SUSPEND" ? "SUSPENDED" : "ACTIVE"
      setEntitlements((prev) => prev.map((e) => e.id === id ? { ...e, status: newStatus } : e))
      toast.success(`Access ${act.toLowerCase()}d`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <a href="/admin/products" className="hover:text-foreground transition-colors">Products</a>
          <span>/</span>
          <span>{data.product.name}</span>
          <span>/</span>
          <span>Ownerships</span>
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-400" /> Product Ownerships
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{entitlements.length} ownership records for <strong>{data.product.name}</strong></p>
      </div>

      {/* Ownerships Table */}
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border/50">
            <tr>
              {["User", "Status", "Granted", "Expires", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {entitlements.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-10 text-sm">No ownership records</td></tr>
            ) : entitlements.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-xs">{e.userName}</p>
                  <p className="text-xs text-muted-foreground">{e.userEmail}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-medium", STATUS_COLORS[e.status] ?? STATUS_COLORS.EXPIRED)}>
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(e.grantedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{e.expiresAt ? new Date(e.expiresAt).toLocaleDateString() : "Lifetime"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {e.status === "ACTIVE" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/10 gap-1"
                          disabled={loading === e.id + "SUSPEND"} onClick={() => action(e.id, "SUSPEND")}>
                          <Pause className="w-3 h-3" /> Suspend
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-400 border-red-500/20 hover:bg-red-500/10 gap-1"
                          disabled={loading === e.id + "REVOKE"} onClick={() => action(e.id, "REVOKE")}>
                          <ShieldOff className="w-3 h-3" /> Revoke
                        </Button>
                      </>
                    )}
                    {(e.status === "SUSPENDED" || e.status === "REVOKED") && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 gap-1"
                        disabled={loading === e.id + "REACTIVATE"} onClick={() => action(e.id, "REACTIVATE")}>
                        <ShieldCheck className="w-3 h-3" /> Reactivate
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Log */}
      {data.auditLogs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" /> Ownership Audit Log
          </h2>
          <div className="space-y-2">
            {data.auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-xs text-muted-foreground border border-border/30 rounded-lg px-4 py-2.5 bg-muted/20">
                <span className="font-mono font-medium text-foreground/70">{log.action}</span>
                <span>{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
