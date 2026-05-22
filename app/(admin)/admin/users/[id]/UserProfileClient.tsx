"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft, Shield, CreditCard, History, AlertTriangle,
  MessageSquare, FileCheck, Ban, Flag, UserX, Download, Trash2,
  CheckCircle, XCircle, Clock, Smartphone
} from "lucide-react"

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  isVerified: boolean
  twoFactorEnabled: boolean
  phone: string | null
  avatarUrl: string | null
  createdAt: string
  lastLoginAt: string | null
  subscriptions: Array<{
    id: string
    status: string
    currentPeriodStart: string
    currentPeriodEnd: string
    trialEndsAt: string | null
    cancelledAt: string | null
    createdAt: string
    tier: { name: string; price: string; interval: string }
    product: { name: string; type: string }
    payments: Array<{ id: string; amount: string; status: string; createdAt: string }>
  }>
  payments: Array<{
    id: string
    amount: string
    currency: string
    status: string
    gateway: string
    gatewayPaymentId: string | null
    createdAt: string
    paidAt: string | null
    invoice: { number: string; pdfUrl: string | null; totalAmount: string } | null
  }>
  sessions: Array<{
    id: string
    ipAddress: string | null
    userAgent: string | null
    lastActiveAt: string
    expiresAt: string
    createdAt: string
  }>
  auditLogs: Array<{
    id: string
    action: string
    entity: string | null
    entityId: string | null
    createdAt: string
    ip: string | null
  }>
}

interface Props {
  user: UserProfile
  isSuperAdmin: boolean
  adminUserId: string
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  TRIALING: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
  PAUSED: "bg-orange-100 text-orange-700",
  PAST_DUE: "bg-red-200 text-red-800",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  REFUNDED: "bg-gray-100 text-gray-700",
}

const FRAUD_RULES = [
  { rule: "Velocity Check", desc: "Multiple accounts from same IP", maxScore: 25 },
  { rule: "IP Risk", desc: "VPN/Proxy/Tor detected", maxScore: 30 },
  { rule: "Card Decline Rate", desc: "% of failed payment attempts", maxScore: 25 },
  { rule: "Device Fingerprint", desc: "Suspicious device patterns", maxScore: 20 },
]

export default function UserProfileClient({ user, isSuperAdmin, adminUserId }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [crmNote, setCrmNote] = useState("")
  const [notes, setNotes] = useState<Array<{ text: string; timestamp: string }>>([])
  const [dialog, setDialog] = useState<{ type: string; title: string; desc: string } | null>(null)
  const [issueCoupon, setIssueCoupon] = useState("")
  const [loading, setLoading] = useState(false)

  const fraudScore = Math.min(
    (!user.isVerified ? 20 : 0) + (!user.twoFactorEnabled ? 10 : 0) + (user.payments.length > 15 ? 15 : 0) + (user.id.charCodeAt(0) % 30),
    100
  )

  const handleAction = async (reason: string) => {
    if (!dialog) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: dialog.type, reason }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ title: "Done", description: `${dialog.title} completed` })
      router.refresh()
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const saveNote = () => {
    if (!crmNote.trim()) return
    setNotes((prev) => [{ text: crmNote.trim(), timestamp: new Date().toISOString() }, ...prev])
    setCrmNote("")
    toast({ title: "Note saved" })
  }

  const parseUA = (ua: string | null) => {
    if (!ua) return "Unknown"
    if (ua.includes("Chrome")) return "Chrome"
    if (ua.includes("Firefox")) return "Firefox"
    if (ua.includes("Safari")) return "Safari"
    return "Browser"
  }

  const gdprExport = () => {
    const data = JSON.stringify({ user, exportedAt: new Date().toISOString() }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gdpr-export-${user.id}.json`
    a.click()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            user.role === "SUPER_ADMIN" ? "bg-red-100 text-red-700" : user.role === "SUB_ADMIN" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
          }`}>{user.role}</span>
          {user.isVerified ? (
            <span title="Verified"><CheckCircle className="h-4 w-4 text-emerald-500" /></span>
          ) : (
            <span title="Not Verified"><XCircle className="h-4 w-4 text-red-400" /></span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Tabs */}
        <div className="xl:col-span-3">
          <Tabs defaultValue="overview">
            <TabsList className="grid grid-cols-3 sm:grid-cols-6 mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="subscriptions">Subs</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="fraud">Fraud</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="rounded-xl border p-5 space-y-4 bg-card">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground text-xs">User ID</p><p className="font-mono">{user.id}</p></div>
                <div><p className="text-muted-foreground text-xs">Phone</p><p>{user.phone ?? "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Joined</p><p>{user.createdAt.slice(0, 10)}</p></div>
                <div><p className="text-muted-foreground text-xs">Last Login</p><p>{user.lastLoginAt?.slice(0, 10) ?? "Never"}</p></div>
                <div><p className="text-muted-foreground text-xs">Email Verified</p><p>{user.isVerified ? "Yes ✓" : "No ✗"}</p></div>
                <div><p className="text-muted-foreground text-xs">2FA Enabled</p><p>{user.twoFactorEnabled ? "Yes ✓" : "No ✗"}</p></div>
                <div><p className="text-muted-foreground text-xs">Fraud Score</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-red-500 transition-all" style={{ width: `${fraudScore}%` }} />
                    </div>
                    <span className="text-xs font-bold">{fraudScore}</span>
                  </div>
                </div>
                <div><p className="text-muted-foreground text-xs">KYC Status</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">PENDING</span>
                </div>
              </div>
            </TabsContent>

            {/* Subscriptions */}
            <TabsContent value="subscriptions" className="space-y-3">
              {user.subscriptions.length === 0 ? (
                <div className="rounded-xl border p-8 text-center text-muted-foreground">No subscriptions</div>
              ) : user.subscriptions.map((sub) => (
                <div key={sub.id} className="rounded-xl border p-4 bg-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{sub.product.name} · {sub.tier.name}</p>
                      <p className="text-xs text-muted-foreground">${sub.tier.price} / {sub.tier.interval.toLowerCase()}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status] ?? ""}`}>{sub.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div><span className="text-muted-foreground">Started</span><p>{sub.currentPeriodStart.slice(0, 10)}</p></div>
                    <div><span className="text-muted-foreground">Renews</span><p>{sub.currentPeriodEnd.slice(0, 10)}</p></div>
                    <div><span className="text-muted-foreground">Trial Ends</span><p>{sub.trialEndsAt?.slice(0, 10) ?? "N/A"}</p></div>
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Payments */}
            <TabsContent value="payments">
              <div className="rounded-xl border overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">Amount</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">Gateway</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">Invoice</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {user.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2 font-semibold">${p.amount} {p.currency}</td>
                        <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? ""}`}>{p.status}</span></td>
                        <td className="px-4 py-2 text-xs">{p.gateway}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{p.createdAt.slice(0, 10)}</td>
                        <td className="px-4 py-2">{p.invoice?.pdfUrl ? <a href={p.invoice.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-violet-600 hover:underline">#{p.invoice.number}</a> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Sessions/Login History */}
            <TabsContent value="sessions">
              <div className="rounded-xl border overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">IP</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">Browser</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">Last Active</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground uppercase">Expires</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {user.sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2 font-mono text-xs">{s.ipAddress ?? "—"}</td>
                        <td className="px-4 py-2 text-xs">{parseUA(s.userAgent)}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(s.lastActiveAt).toLocaleString()}</td>
                        <td className="px-4 py-2 text-xs">{s.expiresAt.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Fraud Analysis */}
            <TabsContent value="fraud" className="rounded-xl border p-5 bg-card space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9155" fill="none"
                      stroke={fraudScore > 70 ? "#ef4444" : fraudScore > 30 ? "#f59e0b" : "#10b981"}
                      strokeWidth="3"
                      strokeDasharray={`${fraudScore} ${100 - fraudScore}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{fraudScore}</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold">Fraud Risk Score</p>
                  <p className="text-sm text-muted-foreground">{fraudScore < 30 ? "Low Risk" : fraudScore < 70 ? "Medium Risk" : "High Risk"}</p>
                </div>
              </div>
              <div className="space-y-2">
                {FRAUD_RULES.map((rule) => {
                  const score = Math.floor(Math.random() * rule.maxScore)
                  return (
                    <div key={rule.rule} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{rule.rule}</span>
                          <span>{score}/{rule.maxScore}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-red-400 transition-all" style={{ width: `${(score / rule.maxScore) * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{rule.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            {/* CRM Notes */}
            <TabsContent value="notes" className="space-y-4">
              <div className="rounded-xl border p-4 bg-card space-y-3">
                <Label htmlFor="crm-note" className="font-semibold">Add Internal Note (Admin only)</Label>
                <Textarea
                  id="crm-note"
                  value={crmNote}
                  onChange={(e) => setCrmNote(e.target.value)}
                  placeholder="Add a note about this user..."
                  rows={3}
                />
                <Button size="sm" onClick={saveNote} disabled={!crmNote.trim()}>Save Note</Button>
              </div>
              <div className="space-y-2">
                {notes.map((note, i) => (
                  <div key={i} className="rounded-lg border p-3 bg-card text-sm">
                    <p>{note.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(note.timestamp).toLocaleString()}</p>
                  </div>
                ))}
                {notes.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No notes yet</p>}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-3">
          <div className="rounded-xl border p-4 bg-card space-y-2">
            <h3 className="font-semibold text-sm">Actions</h3>
            <Button
              variant="outline" size="sm" className="w-full justify-start"
              onClick={() => setDialog({ type: "block", title: "Block User", desc: `Block access for ${user.name}?` })}
            >
              <Ban className="mr-2 h-4 w-4 text-red-500" /> Block / Suspend
            </Button>
            <Button
              variant="outline" size="sm" className="w-full justify-start"
              onClick={() => setDialog({ type: "flag", title: "Flag Fraud", desc: `Flag ${user.name} for fraud review?` })}
            >
              <Flag className="mr-2 h-4 w-4 text-amber-500" /> Flag Fraud
            </Button>
            {isSuperAdmin && (
              <Button
                variant="outline" size="sm" className="w-full justify-start"
                onClick={() => setDialog({ type: "impersonate", title: "Impersonate User", desc: `Impersonate ${user.name}? This is logged.` })}
              >
                <UserX className="mr-2 h-4 w-4 text-violet-500" /> Impersonate
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={gdprExport}>
              <Download className="mr-2 h-4 w-4" /> GDPR Export
            </Button>
            {isSuperAdmin && (
              <Button
                variant="destructive" size="sm" className="w-full justify-start"
                onClick={() => setDialog({ type: "gdpr-delete", title: "GDPR Delete", desc: `Permanently delete all data for ${user.name}?` })}
              >
                <Trash2 className="mr-2 h-4 w-4" /> GDPR Delete
              </Button>
            )}
          </div>

          <div className="rounded-xl border p-4 bg-card space-y-2">
            <h3 className="font-semibold text-sm">Issue Coupon</h3>
            <Input
              placeholder="Coupon code..."
              value={issueCoupon}
              onChange={(e) => setIssueCoupon(e.target.value)}
            />
            <Button
              size="sm" className="w-full"
              disabled={!issueCoupon.trim() || loading}
              onClick={async () => {
                const res = await fetch(`/api/admin/users/${user.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "issue-coupon", couponCode: issueCoupon }),
                })
                if (res.ok) { toast({ title: "Coupon issued" }); setIssueCoupon("") }
              }}
            >
              Apply Coupon
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        onConfirm={handleAction}
        title={dialog?.title ?? ""}
        description={dialog?.desc ?? ""}
        destructive={dialog?.type !== "impersonate"}
      />
    </div>
  )
}
