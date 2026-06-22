"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { KeyRound, Check, X, Eye, EyeOff } from "lucide-react"

interface CredRequest {
  id: string
  userName: string
  userEmail: string
  productName: string
  productSlug: string
  productLoginUrl?: string | null
  email: string
  reason?: string | null
  status: string
  adminNotes?: string | null
  allowDashboard: boolean
  requestedAt: string
  resolvedAt?: string | null
  resolvedBy?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  DELIVERED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
}

const TABS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const

export default function CredentialRequestsClient({ requests: initial }: { requests: CredRequest[] }) {
  const router = useRouter()
  const [requests, setRequests] = useState(initial)
  const [tab, setTab] = useState<typeof TABS[number]>("ALL")
  const [approveTarget, setApproveTarget] = useState<CredRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<CredRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // Approve form state
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [notes, setNotes] = useState("")
  const [allowDashboard, setAllowDashboard] = useState(false)
  // Reject form state
  const [rejectReason, setRejectReason] = useState("")

  const filtered = tab === "ALL" ? requests : requests.filter((r) => r.status === tab)

  const patch = async (id: string, body: object) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/credential-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      return true
    } catch (err) {
      toast.error((err as Error).message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!approveTarget) return
    const ok = await patch(approveTarget.id, { action: "APPROVE", username, password, notes, allowDashboard })
    if (ok) {
      toast.success(`Credentials sent to ${approveTarget.email}`)
      setRequests((prev) => prev.map((r) => r.id === approveTarget.id ? { ...r, status: "APPROVED" } : r))
      setApproveTarget(null)
      setUsername(""); setPassword(""); setNotes(""); setAllowDashboard(false)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    const ok = await patch(rejectTarget.id, { action: "REJECT", notes: rejectReason })
    if (ok) {
      toast.success("Request rejected")
      setRequests((prev) => prev.map((r) => r.id === rejectTarget.id ? { ...r, status: "REJECTED" } : r))
      setRejectTarget(null)
      setRejectReason("")
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound className="w-6 h-6 text-indigo-400" /> Credential Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">{requests.length} total requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border border-border/50 rounded-lg p-1 w-fit bg-muted/30">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all",
              tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t} ({t === "ALL" ? requests.length : requests.filter((r) => r.status === t).length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border/50">
            <tr>
              {["User", "Product", "Reason", "Status", "Requested", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">No requests found</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-xs">{r.userName}</p>
                  <p className="text-xs text-muted-foreground">{r.userEmail}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-xs">{r.productName}</p>
                  {r.productLoginUrl && <a href={r.productLoginUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">Login URL</a>}
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.reason || "—"}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-medium", STATUS_COLORS[r.status] ?? STATUS_COLORS.PENDING)}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.requestedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {r.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        onClick={() => { setApproveTarget(r); setUsername(""); setPassword(""); setNotes(""); setAllowDashboard(false) }}>
                        <Check className="w-3 h-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-400 border-red-500/20 hover:bg-red-500/10 gap-1"
                        onClick={() => { setRejectTarget(r); setRejectReason("") }}>
                        <X className="w-3 h-3" /> Reject
                      </Button>
                    </div>
                  )}
                  {r.status !== "PENDING" && (
                    <span className="text-xs text-muted-foreground">{r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString() : "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approve Modal */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Approve Credential Request</DialogTitle>
            <DialogDescription>Enter credentials for <strong>{approveTarget?.productName}</strong> — they will be emailed to {approveTarget?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username or email" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Password</label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" className="pr-10" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Notes (optional)</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access instructions, additional info…" rows={2} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allowDashboard} onChange={(e) => setAllowDashboard(e.target.checked)} className="rounded" />
              <span className="text-xs text-muted-foreground">Allow user to view credentials in dashboard</span>
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
              <Button onClick={handleApprove} disabled={loading || !username || !password} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? "Sending…" : "Approve & Send Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Reject Credential Request</DialogTitle>
            <DialogDescription>Reject request for <strong>{rejectTarget?.productName}</strong> from {rejectTarget?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection (shown in audit log)…" rows={3} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={loading}>
                {loading ? "Rejecting…" : "Reject Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
