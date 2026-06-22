"use client"

import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  ExternalLink, KeyRound, RefreshCw, ShoppingBag, Clock, CalendarDays,
  Package, Layers, CheckCircle2, XCircle, PauseCircle, AlertTriangle,
} from "lucide-react"

interface Entitlement {
  id: string
  productId: string
  productName: string
  productSlug: string
  productThumbnail?: string | null
  productDescription?: string | null
  productCategory?: string | null
  productStatus?: string | null
  productAccessUrl?: string | null
  productLoginUrl?: string | null
  productDashboardUrl?: string | null
  productAccessNotes?: string | null
  status: string
  type: string
  grantedAt: string
  expiresAt?: string | null
  remainingDays: number | null
  accessRevokedAt?: string | null
  refundEligibleUntil?: string | null
  refundRequested: boolean
  hasCredentials: boolean
  orderId?: string | null
  subscriptionPlan?: string | null
  subscriptionStatus?: string | null
  subscriptionExpiry?: string | null
  hasPendingCredentialRequest: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE: { label: "Active", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  SUSPENDED: { label: "Suspended", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: <PauseCircle className="w-3 h-3" /> },
  REVOKED: { label: "Revoked", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
  EXPIRED: { label: "Expired", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.EXPIRED
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-medium", cfg.color)}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function CountdownBadge({ until }: { until: string }) {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [until])
  if (!remaining) return null
  const mins = Math.floor(remaining / 60), secs = remaining % 60
  return <span className="text-xs text-amber-400 font-medium">↩ Refund window: {mins}m {secs}s</span>
}

// ─── Credential Request Dialog ───────────────────────────────────────────────
function CredentialRequestDialog({
  entitlementId, productName, open, onClose, onSuccess,
}: { entitlementId: string; productName: string; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/credential-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlementId, reason: reason.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success("Request submitted — we'll email your credentials shortly.")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-indigo-400" /> Request Login Credentials</DialogTitle>
          <DialogDescription>Submit a request for <strong>{productName}</strong>. An admin will review and email your credentials.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Textarea
            placeholder="Optional: describe why you need credentials (e.g. lost access, first time setup)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? "Submitting…" : "Submit Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MyProductsClient({ entitlements }: { entitlements: Entitlement[] }) {
  const [credentials, setCredentials] = useState<Record<string, unknown> | null>(null)
  const [credLoading, setCredLoading] = useState<string | null>(null)
  const [refundDialog, setRefundDialog] = useState<Entitlement | null>(null)
  const [refundReason, setRefundReason] = useState("")
  const [refunding, setRefunding] = useState(false)
  const [credDialog, setCredDialog] = useState(false)
  const [credReqDialog, setCredReqDialog] = useState<Entitlement | null>(null)
  const [localPending, setLocalPending] = useState<Set<string>>(new Set())

  const viewCredentials = useCallback(async (id: string) => {
    setCredLoading(id)
    try {
      const res = await fetch(`/api/entitlements/${id}/credentials`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCredentials(json.data.credentials)
      setCredDialog(true)
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    } finally { setCredLoading(null) }
  }, [])

  const checkEligibility = useCallback(async (id: string) => {
    const res = await fetch(`/api/refunds/request?entitlementId=${id}`)
    return (await res.json()).data
  }, [])

  const openRefundDialog = useCallback(async (ent: Entitlement) => {
    const elig = await checkEligibility(ent.id)
    if (!elig.eligible) {
      toast.error(elig.refundRequested ? "Refund already requested." : "Refund window closed (3 hours).")
      return
    }
    setRefundDialog(ent)
    setRefundReason("")
  }, [checkEligibility])

  const submitRefund = useCallback(async () => {
    if (!refundDialog || refundReason.trim().length < 10) {
      toast.error("Please provide a detailed reason (≥10 chars)")
      return
    }
    setRefunding(true)
    try {
      const res = await fetch("/api/refunds/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlementId: refundDialog.id, reason: refundReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(json.data.message)
      setRefundDialog(null)
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      toast.error(`Refund failed: ${(err as Error).message}`)
    } finally { setRefunding(false) }
  }, [refundDialog, refundReason])

  const active = entitlements.filter((e) => e.status === "ACTIVE")
  const inactive = entitlements.filter((e) => e.status !== "ACTIVE")

  if (entitlements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold">No products yet</h2>
        <p className="text-muted-foreground text-sm max-w-xs">Browse the marketplace to find your first AI tool or SaaS product.</p>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <a href="/marketplace">Browse Marketplace</a>
        </Button>
      </div>
    )
  }

  const renderCard = (ent: Entitlement) => {
    const now = Date.now()
    const refundEligible = !ent.refundRequested && !!ent.refundEligibleUntil && new Date(ent.refundEligibleUntil).getTime() > now
    const isActive = ent.status === "ACTIVE"
    const hasPending = ent.hasPendingCredentialRequest || localPending.has(ent.id)

    return (
      <Card key={ent.id} className="overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {ent.productThumbnail ? (
                <img src={ent.productThumbnail} alt={ent.productName} className="w-12 h-12 rounded-xl object-cover border border-border/50" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shrink-0">
                  {ent.productName.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm">{ent.productName}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {ent.productCategory && <span className="text-xs text-muted-foreground">{ent.productCategory}</span>}
                  {ent.productStatus && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ent.productStatus}</span>
                  )}
                </div>
              </div>
            </div>
            <StatusBadge status={ent.status} />
          </div>

          {/* Description */}
          {ent.productDescription && (
            <p className="text-sm text-muted-foreground line-clamp-2">{ent.productDescription}</p>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Purchased {new Date(ent.grantedAt).toLocaleDateString()}</span>
            </div>
            {ent.subscriptionPlan && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="w-3.5 h-3.5" />
                <span>{ent.subscriptionPlan}</span>
              </div>
            )}
            {ent.subscriptionStatus && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Package className="w-3.5 h-3.5" />
                <span>Sub: {ent.subscriptionStatus}</span>
              </div>
            )}
            {ent.expiresAt && (
              <div className={cn("flex items-center gap-1.5", ent.remainingDays !== null && ent.remainingDays <= 7 ? "text-amber-400" : "text-muted-foreground")}>
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {ent.remainingDays !== null && ent.remainingDays > 0
                    ? `Expires in ${ent.remainingDays}d`
                    : ent.remainingDays === 0 ? "Expired today" : "Expired"}
                </span>
              </div>
            )}
            {!ent.expiresAt && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /><span>Lifetime access</span>
              </div>
            )}
          </div>

          {/* Refund countdown */}
          {refundEligible && ent.refundEligibleUntil && <CountdownBadge until={ent.refundEligibleUntil} />}

          {/* Access Notes */}
          {isActive && ent.productAccessNotes && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 border border-border/30">
              📋 {ent.productAccessNotes}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* Open Product — ONLY when ACTIVE and URL exists */}
            {isActive && ent.productAccessUrl && (
              <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5" asChild>
                <a href={ent.productAccessUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3" /> Open Product
                </a>
              </Button>
            )}

            {/* View Credentials (existing encrypted cred flow) */}
            {ent.hasCredentials && isActive && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={credLoading === ent.id} onClick={() => viewCredentials(ent.id)}>
                <KeyRound className="w-3 h-3" />
                {credLoading === ent.id ? "Loading…" : "View Credentials"}
              </Button>
            )}

            {/* Request Login Credentials */}
            {isActive && (
              hasPending ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-dashed border-border rounded-full px-3 h-8">
                  <KeyRound className="w-3 h-3" /> Credentials Requested
                </span>
              ) : (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setCredReqDialog(ent)}>
                  <KeyRound className="w-3 h-3" /> Request Login Credentials
                </Button>
              )
            )}

            {/* Marketplace link */}
            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
              <a href={`/marketplace/${ent.productSlug}`}>View Product</a>
            </Button>

            {/* Renew */}
            {ent.status === "EXPIRED" && (
              <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" asChild>
                <a href={`/marketplace/${ent.productSlug}`}>Renew</a>
              </Button>
            )}

            {/* Refund */}
            {refundEligible && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => openRefundDialog(ent)}>
                ↩ Request Refund
              </Button>
            )}
            {ent.refundRequested && <span className="text-xs text-muted-foreground italic self-center">Refund requested</span>}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">My Products</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {entitlements.length} product{entitlements.length !== 1 ? "s" : ""} in your library
        </p>
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Active ({active.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{active.map(renderCard)}</div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Inactive ({inactive.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">{inactive.map(renderCard)}</div>
        </section>
      )}

      {/* Credentials Dialog */}
      <Dialog open={credDialog} onOpenChange={setCredDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Product Credentials</DialogTitle>
            <DialogDescription>Keep these secure. NexusAI will never ask for these via chat.</DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3 mt-2">
              {Object.entries(credentials).map(([key, value]) => (
                <div key={key} className="bg-muted/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{key}</p>
                  <p className="font-mono text-sm mt-1 break-all">{typeof value === "string" ? value : JSON.stringify(value)}</p>
                  <button className="text-xs text-indigo-400 mt-1 hover:underline"
                    onClick={() => { navigator.clipboard.writeText(typeof value === "string" ? value : JSON.stringify(value)); toast.success(`${key} copied`) }}>
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={!!refundDialog} onOpenChange={(open) => !open && setRefundDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Refund</DialogTitle>
            <DialogDescription>
              Requesting refund for <strong>{refundDialog?.productName}</strong>. This will deactivate your access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Textarea placeholder="Describe why you are requesting a refund (min 10 characters)…" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={4} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRefundDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={submitRefund} disabled={refunding || refundReason.trim().length < 10}>
                {refunding ? "Submitting…" : "Submit Refund Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credential Request Dialog */}
      {credReqDialog && (
        <CredentialRequestDialog
          entitlementId={credReqDialog.id}
          productName={credReqDialog.productName}
          open={!!credReqDialog}
          onClose={() => setCredReqDialog(null)}
          onSuccess={() => setLocalPending((prev) => new Set([...prev, credReqDialog!.id]))}
        />
      )}
    </div>
  )
}
