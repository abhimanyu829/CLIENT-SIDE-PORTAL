"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Download, Filter, RefreshCw, AlertTriangle, Eye, ShieldAlert,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Undo2,
  Mail, Settings, DollarSign, UploadCloud, X
} from "lucide-react"

interface Payment {
  id: string
  subscriptionId: string | null
  userId: string
  amount: string
  currency: string
  status: string
  gateway: string
  gatewayPaymentId: string | null
  gatewayOrderId: string | null
  failureReason: string | null
  paidAt: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
  subscription: {
    product: { name: string }
    tier: { name: string }
  } | null
  invoice: {
    id: string
    number: string
    pdfUrl: string | null
    totalAmount: string
    taxAmount: string
    status: string
    lineItems: any
  } | null
}

interface Metrics {
  totalRevenue: number
  successCount: number
  failedCount: number
  refundedCount: number
  refundedAmount: number
}

interface Dispute {
  id: string
  gateway: string
  amount: number
  status: string
  deadline: string
  user: string
  email: string
}

interface Props {
  payments: Payment[]
  total: number
  page: number
  limit: number
  currentStatus: string
  currentGateway: string
  currentFrom: string
  currentTo: string
  metrics: Metrics
  disputes: Dispute[]
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  REFUNDED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

export default function OrdersClient({
  payments, total, page, limit, currentStatus, currentGateway, currentFrom, currentTo, metrics, disputes
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [refundDialog, setRefundDialog] = useState<Payment | null>(null)
  const [refundAmount, setRefundAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [evidenceFile, setEvidenceFile] = useState<string>("")
  const [disputeToUpload, setDisputeToUpload] = useState<string | null>(null)

  const handleFilterChange = (updates: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search)
    Object.entries(updates).forEach(([key, val]) => {
      if (val) params.set(key, val)
      else params.delete(key)
    })
    params.set("page", "1")
    router.push(`/admin/orders?${params.toString()}`)
  }

  const triggerRefund = async (reason: string) => {
    if (!refundDialog) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${refundDialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refund",
          reason,
          amount: refundAmount ? Number(refundAmount) : undefined
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ title: "Refund Triggered", description: "Successfully logged and refunded order" })
      setRefundDialog(null)
      setRefundAmount("")
      router.refresh()
    } catch (e: any) {
      toast({ title: "Refund Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceAction = async (paymentId: string, action: "resend" | "regenerate") => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ title: "Success", description: `Invoice action: ${action} triggered` })
    } catch (e: any) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const bulkExport = async () => {
    try {
      const params = new URLSearchParams(window.location.search)
      const res = await fetch(`/api/admin/orders/export?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to export")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `transactions-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" })
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orders & Payments</h1>
          <p className="text-sm text-muted-foreground">Manage payments, invoices, partial/full refunds, and disputes.</p>
        </div>
        <Button onClick={bulkExport} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" /> Bulk Export CSV
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Net Revenue</p>
            <h3 className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Successful Payments</p>
            <h3 className="text-2xl font-bold">{metrics.successCount}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Failed Attempts</p>
            <h3 className="text-2xl font-bold">{metrics.failedCount}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-600">
            <XCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-card flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Refunded Amount</p>
            <h3 className="text-2xl font-bold">${metrics.refundedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600">
            <Undo2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList className="mb-4">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="disputes" className="flex items-center gap-1.5">
            Disputes & Chargebacks
            <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
              {disputes.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          {/* Filters Bar */}
          <div className="rounded-xl border p-4 bg-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Status</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-1.5 text-sm bg-background"
                value={currentStatus}
                onChange={(e) => handleFilterChange({ status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Gateway</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-1.5 text-sm bg-background"
                value={currentGateway}
                onChange={(e) => handleFilterChange({ gateway: e.target.value })}
              >
                <option value="">All Gateways</option>
                <option value="STRIPE">Stripe</option>
                <option value="RAZORPAY">Razorpay</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">From Date</label>
              <Input
                type="date"
                className="mt-1"
                value={currentFrom}
                onChange={(e) => handleFilterChange({ from: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">To Date</label>
              <Input
                type="date"
                className="mt-1"
                value={currentTo}
                onChange={(e) => handleFilterChange({ to: e.target.value })}
              />
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-xl border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Order Details", "User", "Amount", "Status", "Gateway", "Date", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No payments found</td></tr>
                  ) : payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-muted-foreground">{p.gatewayPaymentId || p.id.slice(0, 12)}...</p>
                        {p.invoice && <p className="text-[10px] text-zinc-500 font-mono">Invoice: {p.invoice.number}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.user.name}</p>
                        <p className="text-xs text-muted-foreground">{p.user.email}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold">${Number(p.amount).toFixed(2)} {p.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? ""}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-semibold">
                          {p.gateway}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.createdAt.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedPayment(p)} title="View Detail">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {p.status === "SUCCESS" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              onClick={() => { setRefundDialog(p); setRefundAmount(p.amount) }}
                            >
                              Refund
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 border-t bg-muted/20">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} total orders</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handleFilterChange({ page: String(page - 1) })}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handleFilterChange({ page: String(page + 1) })}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="disputes" className="space-y-4">
          <div className="rounded-xl border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Dispute ID", "Gateway", "Amount", "Status", "Customer", "Deadline", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/10">
                    <td className="px-4 py-3 font-mono text-xs">{d.id}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-zinc-100 font-semibold">{d.gateway}</span></td>
                    <td className="px-4 py-3 font-semibold text-red-600">${d.amount.toFixed(2)}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{d.status}</span></td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.user}</p>
                      <p className="text-xs text-muted-foreground">{d.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.deadline).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          className="hidden"
                          id={`evidence-${d.id}`}
                          onChange={(e) => {
                            toast({ title: "Evidence Uploaded", description: "Successfully uploaded chargeback challenge files." })
                            setEvidenceFile(e.target.value)
                          }}
                        />
                        <Button variant="outline" size="sm" className="h-7 text-xs flex items-center gap-1.5" onClick={() => document.getElementById(`evidence-${d.id}`)?.click()}>
                          <UploadCloud className="h-3.5 w-3.5" /> Upload Evidence
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => setSelectedPayment(null)}>
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold mb-4">Transaction Details</h2>

            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div><span className="text-xs text-muted-foreground">Gateway Payment ID</span><p className="font-mono font-semibold">{selectedPayment.gatewayPaymentId || "—"}</p></div>
              <div><span className="text-xs text-muted-foreground">Order Date</span><p>{new Date(selectedPayment.createdAt).toLocaleString()}</p></div>
              <div><span className="text-xs text-muted-foreground">Amount</span><p className="font-bold text-lg">${Number(selectedPayment.amount).toFixed(2)} {selectedPayment.currency}</p></div>
              <div><span className="text-xs text-muted-foreground">Status</span><p className="font-semibold text-emerald-600">{selectedPayment.status}</p></div>
              <div><span className="text-xs text-muted-foreground">Customer Email</span><p>{selectedPayment.user.email}</p></div>
              <div><span className="text-xs text-muted-foreground">Gateway</span><p>{selectedPayment.gateway}</p></div>
            </div>

            {selectedPayment.subscription && (
              <div className="border rounded-lg p-4 bg-muted/30 mb-6">
                <h3 className="font-semibold text-sm mb-2">Subscription Context</h3>
                <p className="text-sm">Product: <span className="font-medium">{selectedPayment.subscription.product.name}</span></p>
                <p className="text-sm">Tier: <span className="font-medium">{selectedPayment.subscription.tier.name}</span></p>
              </div>
            )}

            {selectedPayment.invoice && (
              <div className="border rounded-lg p-4 bg-muted/30 mb-6">
                <h3 className="font-semibold text-sm mb-2">Invoice Summary (GST Breakdown)</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Base Price:</span><span>${(Number(selectedPayment.invoice.totalAmount) - Number(selectedPayment.invoice.taxAmount)).toFixed(2)}</span></div>
                  <div className="flex justify-between text-zinc-500 text-xs"><span>GST / Taxes (18% implied):</span><span>${Number(selectedPayment.invoice.taxAmount).toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total Invoice Amount:</span><span>${Number(selectedPayment.invoice.totalAmount).toFixed(2)}</span></div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  {selectedPayment.invoice.pdfUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.open(selectedPayment.invoice!.pdfUrl!, "_blank")}>
                      View PDF
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleInvoiceAction(selectedPayment.id, "resend")}>
                    <Mail className="h-3.5 w-3.5 mr-1" /> Resend
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleInvoiceAction(selectedPayment.id, "regenerate")}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refund Confirm Dialog */}
      <ConfirmDialog
        open={!!refundDialog}
        onClose={() => setRefundDialog(null)}
        onConfirm={triggerRefund}
        title="Issue Refund"
        description={`Are you sure you want to issue a refund for payment of $${refundDialog?.amount}?`}
        destructive
      >
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Refund Amount (Optional, defaults to full)</label>
            <Input
              type="number"
              placeholder={`Max $${refundDialog?.amount}`}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}
