"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Check, X, Eye, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

type VerificationRow = {
  id: string
  orderId: string
  order: {
    id: string
    orderNumber: string
    status: string
    grandTotal: string
    currency: string
    items: Array<{
      name: string
      product?: { id: string; name: string; slug: string } | null
      tier?: { id: string; name: string; interval: string } | null
    }>
  }
  user: { email: string; name: string | null }
  utrNumber: string
  claimedAmount: string | null
  screenshotUrl: string | null
  reviewAttemptCount: number
  mismatchReason: string | null
  adminTransactionId: string | null
  adminActualAmount: string | null
  verificationStatus: string
  submittedAt: string
}

type DraftState = Record<string, { transactionId: string; amount: string }>

export default function VerificationsClient({ initialData }: { initialData: VerificationRow[] }) {
  const [verifications, setVerifications] = useState<VerificationRow[]>(initialData)
  const [drafts, setDrafts] = useState<DraftState>(() =>
    Object.fromEntries(
      initialData.map((row) => [
        row.id,
        {
          transactionId: row.adminTransactionId ?? row.utrNumber,
          amount: row.adminActualAmount ?? row.claimedAmount ?? row.order.grandTotal,
        },
      ])
    )
  )
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const updateDraft = (id: string, patch: Partial<{ transactionId: string; amount: string }>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        transactionId: prev[id]?.transactionId ?? "",
        amount: prev[id]?.amount ?? "",
        ...patch,
      },
    }))
  }

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setLoadingId(id)
    setError(null)

    try {
      const draft = drafts[id]
      const payload =
        action === "approve"
          ? {
              actualTransactionId: draft?.transactionId?.trim() ?? "",
              actualAmount: Number(draft?.amount ?? 0),
            }
          : undefined

      const res = await fetch(`/api/admin/payments/verifications/${id}/${action}`, {
        method: "POST",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      })

      const json = await res.json()

      if (!res.ok) {
        if (json?.error?.code === "RECHECK_REQUIRED" && json?.data?.verification) {
          const verification = json.data.verification as VerificationRow
          setVerifications((prev) => prev.map((row) => (row.id === id ? { ...row, ...verification } : row)))
          setDrafts((prev) => ({
            ...prev,
            [id]: {
              transactionId: verification.adminTransactionId ?? prev[id]?.transactionId ?? "",
              amount: verification.adminActualAmount ?? prev[id]?.amount ?? "",
            },
          }))
          setError(json.error.message || "Recheck required")
          return
        }
        throw new Error(json.error?.message || `Failed to ${action}`)
      }

      setVerifications((prev) => prev.filter((row) => row.id !== id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  if (verifications.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center">
        <Check className="mx-auto h-12 w-12 text-emerald-500/50" />
        <h3 className="mt-4 text-lg font-semibold text-white">All caught up</h3>
        <p className="mt-2 text-sm text-zinc-400">There are no pending manual payment verifications in the queue.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-500/10 p-4 text-red-400 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-zinc-950 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="p-4 font-medium">User & Order</th>
              <th className="p-4 font-medium">Claim vs Expected</th>
              <th className="p-4 font-medium">UTR / Screenshot</th>
              <th className="p-4 font-medium">Submitted</th>
              <th className="p-4 font-medium">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {verifications.map((v) => {
              const draft = drafts[v.id] ?? { transactionId: v.utrNumber, amount: v.claimedAmount ?? v.order.grandTotal }
              const hasRecheck = (v.reviewAttemptCount ?? 0) > 0 || !!v.mismatchReason

              return (
                <tr key={v.id} className="hover:bg-white/[0.02] transition-colors align-top">
                  <td className="p-4">
                    <p className="font-semibold text-white">{v.user.name ?? "Customer"}</p>
                    <p className="text-xs text-zinc-500">{v.user.email}</p>
                    <Badge variant="outline" className="mt-2 font-mono">{v.order.orderNumber}</Badge>
                    <div className="mt-3 space-y-1 text-xs text-zinc-500">
                      <p className="font-medium text-zinc-300">Products</p>
                      {v.order.items.map((item) => (
                        <p key={`${v.id}-${item.product?.id ?? item.name}`} className="font-mono">
                          {item.name}{item.tier?.name ? ` · ${item.tier.name}` : ""}
                        </p>
                      ))}
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Claimed</p>
                        <p className="font-semibold text-white">
                          ₹{Number(v.claimedAmount ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Expected</p>
                        <p className="font-semibold text-emerald-400">
                          ₹{Number(v.order.grandTotal).toFixed(2)}
                        </p>
                      </div>
                      {hasRecheck && (
                        <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                          {v.mismatchReason ?? "Recheck requested by backend"}
                        </p>
                      )}
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-zinc-900 px-2 py-1 rounded border border-white/5">{v.utrNumber}</span>
                      {v.screenshotUrl && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded" onClick={() => setSelectedImage(v.screenshotUrl)}>
                          <Eye className="h-4 w-4 text-zinc-400" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-3 text-xs text-zinc-500">
                      <p>Claimed amount: <span className="text-zinc-300">{draft.amount || v.claimedAmount || v.order.grandTotal}</span></p>
                      <p>Admin transaction: <span className="text-zinc-300">{v.adminTransactionId ?? "pending"}</span></p>
                      {v.reviewAttemptCount > 0 && <p>Review attempts: <span className="text-zinc-300">{v.reviewAttemptCount}</span></p>}
                    </div>
                  </td>

                  <td className="p-4 text-zinc-400 text-xs">
                    {format(new Date(v.submittedAt), "MMM d, yyyy HH:mm")}
                  </td>

                  <td className="p-4">
                    <div className="space-y-3 min-w-[280px]">
                      <div className="grid gap-2">
                        <Input
                          value={draft.transactionId}
                          onChange={(e) => updateDraft(v.id, { transactionId: e.target.value })}
                          placeholder="Actual transaction ID"
                          className="h-9 border-white/10 bg-zinc-900 text-xs font-mono"
                        />
                        <Input
                          value={draft.amount}
                          onChange={(e) => updateDraft(v.id, { amount: e.target.value })}
                          placeholder="Actual amount"
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-9 border-white/10 bg-zinc-900 text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          disabled={loadingId === v.id}
                          onClick={() => handleAction(v.id, "approve")}
                        >
                          {loadingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                          Verify Payment
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                          disabled={loadingId === v.id}
                          onClick={() => handleAction(v.id, "reject")}
                        >
                          {loadingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                          Reject
                        </Button>
                      </div>

                      {hasRecheck && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Recheck and refill details before verifying again.</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-h-full max-w-2xl bg-zinc-900 rounded-lg overflow-hidden border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="font-semibold text-white">Payment Screenshot</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedImage(null)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-2 flex justify-center bg-zinc-950">
              <img src={selectedImage} alt="Payment Proof" className="max-h-[80vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
