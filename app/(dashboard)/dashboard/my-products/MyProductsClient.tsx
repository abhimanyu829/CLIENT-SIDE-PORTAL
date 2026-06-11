"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface Entitlement {
  id: string
  productId: string
  productName: string
  productSlug: string
  productThumbnail?: string | null
  productDescription?: string | null
  productCategory?: string | null
  status: string
  type: string
  grantedAt: string
  expiresAt?: string | null
  accessRevokedAt?: string | null
  refundEligibleUntil?: string | null
  refundRequested: boolean
  hasCredentials: boolean
  orderId?: string | null
}

interface Props {
  entitlements: Entitlement[]
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
    SUSPENDED: "bg-yellow-100 text-yellow-700 border-yellow-200",
    REVOKED: "bg-red-100 text-red-700 border-red-200",
    EXPIRED: "bg-slate-100 text-slate-500 border-slate-200",
  }
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", map[status] ?? "bg-slate-100 text-slate-500")}>
      {status}
    </span>
  )
}

function CountdownBadge({ until }: { until: string }) {
  const remaining = Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000))
  if (remaining === 0) return null
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  return (
    <span className="text-xs text-amber-600 font-medium">
      ↩️ Refund: {mins}m {secs}s left
    </span>
  )
}

export default function MyProductsClient({ entitlements }: Props) {
  const [credentials, setCredentials] = useState<Record<string, unknown> | null>(null)
  const [credLoading, setCredLoading] = useState<string | null>(null)
  const [refundDialog, setRefundDialog] = useState<Entitlement | null>(null)
  const [refundReason, setRefundReason] = useState("")
  const [refunding, setRefunding] = useState(false)
  const [credDialog, setCredDialog] = useState(false)

  const viewCredentials = useCallback(async (id: string) => {
    setCredLoading(id)
    try {
      const res = await fetch(`/api/entitlements/${id}/credentials`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCredentials(json.data.credentials)
      setCredDialog(true)
    } catch (err) {
      toast.error(`Failed to load credentials: ${(err as Error).message}`)
    } finally {
      setCredLoading(null)
    }
  }, [])

  const checkEligibility = useCallback(async (id: string) => {
    const res = await fetch(`/api/refunds/request?entitlementId=${id}`)
    const json = await res.json()
    return json.data
  }, [])

  const openRefundDialog = useCallback(async (ent: Entitlement) => {
    const elig = await checkEligibility(ent.id)
    if (!elig.eligible) {
      if (elig.refundRequested) {
        toast.info("A refund has already been requested for this product.")
      } else {
        toast.error("Refund window has closed. Refunds are only available within 3 hours of purchase.")
      }
      return
    }
    setRefundDialog(ent)
    setRefundReason("")
  }, [checkEligibility])

  const submitRefund = useCallback(async () => {
    if (!refundDialog) return
    if (refundReason.trim().length < 10) {
      toast.error("Please provide a detailed reason (at least 10 characters)")
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
    } finally {
      setRefunding(false)
    }
  }, [refundDialog, refundReason])

  const active = entitlements.filter((e) => e.status === "ACTIVE")
  const inactive = entitlements.filter((e) => e.status !== "ACTIVE")

  if (entitlements.length === 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-5xl">📦</div>
        <h2 className="text-xl font-semibold">No products yet</h2>
        <p className="text-slate-500">Browse the marketplace to find your first AI tool or SaaS product.</p>
        <Button asChild>
          <a href="/marketplace">Browse Marketplace</a>
        </Button>
      </div>
    )
  }

  const renderCard = (ent: Entitlement) => {
    const now = Date.now()
    const refundEligible =
      !ent.refundRequested &&
      !!ent.refundEligibleUntil &&
      new Date(ent.refundEligibleUntil).getTime() > now
    const expiresInDays = ent.expiresAt
      ? Math.ceil((new Date(ent.expiresAt).getTime() - now) / 86_400_000)
      : null

    return (
      <Card key={ent.id} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {ent.productThumbnail ? (
                <img
                  src={ent.productThumbnail}
                  alt={ent.productName}
                  className="w-12 h-12 rounded-lg object-cover border"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
                  {ent.productName.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm">{ent.productName}</h3>
                {ent.productCategory && (
                  <p className="text-xs text-slate-400">{ent.productCategory}</p>
                )}
              </div>
            </div>
            <StatusBadge status={ent.status} />
          </div>

          {ent.productDescription && (
            <p className="text-sm text-slate-500 line-clamp-2">{ent.productDescription}</p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>📅 Purchased {new Date(ent.grantedAt).toLocaleDateString()}</span>
            {ent.expiresAt && expiresInDays !== null && (
              <span className={expiresInDays <= 7 ? "text-amber-600 font-medium" : ""}>
                {expiresInDays > 0 ? `⏱ Expires in ${expiresInDays}d` : "⚠️ Expired"}
              </span>
            )}
            {!ent.expiresAt && <span>♾️ Lifetime access</span>}
          </div>

          {refundEligible && ent.refundEligibleUntil && (
            <CountdownBadge until={ent.refundEligibleUntil} />
          )}

          <div className="flex flex-wrap gap-2">
            {ent.hasCredentials && ent.status === "ACTIVE" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={credLoading === ent.id}
                onClick={() => viewCredentials(ent.id)}
              >
                {credLoading === ent.id ? "Loading…" : "🔑 View Credentials"}
              </Button>
            )}

            <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
              <a href={`/marketplace/${ent.productSlug}`}>View Product</a>
            </Button>

            {ent.status === "EXPIRED" && (
              <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" asChild>
                <a href={`/marketplace/${ent.productSlug}`}>Renew Subscription</a>
              </Button>
            )}

            {refundEligible && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => openRefundDialog(ent)}
              >
                ↩️ Request Refund
              </Button>
            )}

            {ent.refundRequested && (
              <span className="text-xs text-slate-400 italic self-center">Refund requested</span>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">My Products</h1>
        <p className="text-slate-500 text-sm mt-1">
          {entitlements.length} product{entitlements.length !== 1 ? "s" : ""} in your library
        </p>
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Active ({active.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map(renderCard)}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Inactive ({inactive.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
            {inactive.map(renderCard)}
          </div>
        </section>
      )}

      {/* Credentials Dialog */}
      <Dialog open={credDialog} onOpenChange={setCredDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🔑 Product Credentials</DialogTitle>
            <DialogDescription>
              Keep these secure. Do not share them. NexusAI will never ask for these via chat or email.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3 mt-2">
              {Object.entries(credentials).map(([key, value]) => (
                <div key={key} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{key}</p>
                  <p className="font-mono text-sm mt-1 break-all text-slate-800">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </p>
                  <button
                    className="text-xs text-indigo-600 mt-1 hover:underline"
                    onClick={() => {
                      navigator.clipboard.writeText(typeof value === "string" ? value : JSON.stringify(value))
                      toast.success(`${key} copied`)
                    }}
                  >
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
              You are requesting a refund for <strong>{refundDialog?.productName}</strong>.
              This will immediately deactivate your access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Textarea
              placeholder="Please describe why you are requesting a refund (minimum 10 characters)…"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRefundDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={submitRefund}
                disabled={refunding || refundReason.trim().length < 10}
              >
                {refunding ? "Submitting…" : "Submit Refund Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
