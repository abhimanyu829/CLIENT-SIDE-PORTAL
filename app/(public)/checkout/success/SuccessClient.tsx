"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BadgeCheck, Download, FileText, LayoutDashboard, Loader2, PackageCheck, Receipt, RefreshCw, Rocket, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

type SuccessOrder = {
  id: string
  orderNumber: string
  status: string
  gateway: string | null
  currency: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  grandTotal: number
  paidAt: string | null
  items: Array<{
    id: string
    name: string
    tierName: string
    interval: string | null
    fulfillmentType: string
    productName: string
    category: string | null
    unitPrice: number
    quantity: number
    freeServices: string[]
  }>
  invoiceId: string | null
  invoiceNumber: string | null
  payment: { gateway: string | null; gatewayPaymentId: string | null; status: string; paidAt: string | null } | null
}

type PollState = "POLLING" | "DEPLOYMENT_QUEUED" | "CONFIRMED" | "TIMEOUT"

export default function SuccessClient({ order, userId }: { order: SuccessOrder; userId?: string }) {
  const router = useRouter()
  const [pollState, setPollState] = useState<PollState>(
    order.status === "PAID" || order.status === "FULFILLED" ? "CONFIRMED" : "POLLING"
  )
  const [currentStatus, setCurrentStatus] = useState(order.status)
  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollCountRef = useRef(0)
  const mountedRef = useRef(true)

  // ── Exponential backoff polling ──────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/razorpay/status?orderId=${order.id}`)
      const json = await res.json()

      // Deployment URL ready — redirect straight to service dashboard
      if (json?.data?.deploymentUrl) {
        router.replace(json.data.deploymentUrl)
        return true
      }

      // Payment confirmed, no deployment service (instant-delivery products)
      if (
        json?.data?.order?.status === "PAID" ||
        json?.data?.order?.status === "FULFILLED" ||
        json?.data?.paymentStatus === "SUCCESS"
      ) {
        setCurrentStatus("PAID")
        setPollState("CONFIRMED")
        return true
      }

      // Payment verified but service record is being created (race with createPurchasedServicesForOrder)
      // Keep polling — the next cycle will pick up the deploymentUrl
      if (json?.data?.paymentStatus === "DEPLOYMENT_QUEUED") {
        setCurrentStatus("PAID")
        setPollState("DEPLOYMENT_QUEUED")
        return false // don't stop — keep polling
      }

      // Admin rejected the manual payment verification
      if (json?.data?.paymentStatus === "REJECTED") {
        const redirectUrl =
          json.data.redirectUrl || `/checkout/failure?error=PAYMENT_DENIED&orderId=${order.id}`
        router.replace(redirectUrl)
        return true
      }
    } catch {
      // Continue polling on error
    }
    return false
  }, [order.id, router])

  useEffect(() => {
    if (pollState !== "POLLING" && pollState !== "DEPLOYMENT_QUEUED") return

    const scheduleNext = () => {
      pollCountRef.current += 1
      // Exponential backoff: 3s, 5s, 8s, 12s, 15s, 15s, ...
      const delays = [3000, 5000, 8000, 12000, 15000]
      const delay = delays[Math.min(pollCountRef.current - 1, delays.length - 1)]

      pollIntervalRef.current = setTimeout(async () => {
        if (!mountedRef.current) return
        const confirmed = await pollStatus()
        if (!confirmed && mountedRef.current) {
          scheduleNext()
        }
      }, delay)
    }

    scheduleNext()

    // Hard timeout at 5 minutes — but NOT for manual verification: admin review
    // can take hours and the customer must keep seeing the waiting state until
    // an explicit APPROVE/DENY arrives.
    const awaitingManualVerification = order.status === "AWAITING_VERIFICATION"
    const hardTimeout = awaitingManualVerification
      ? null
      : setTimeout(() => {
          if (mountedRef.current && (pollState === "POLLING" || pollState === "DEPLOYMENT_QUEUED")) {
            setPollState("TIMEOUT")
          }
        }, 300_000)

    return () => {
      mountedRef.current = false
      if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current)
      if (hardTimeout) clearTimeout(hardTimeout)
    }
  }, [order.id, pollState, pollStatus])

  // ── Pusher realtime subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!userId || pollState === "CONFIRMED") return
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return

    let channel: any = null
    let pusherModule: any = null

    const connect = async () => {
      try {
        const PusherClient = (await import("pusher-js")).default
        pusherModule = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap2",
          authEndpoint: "/api/pusher/auth",
        })

        channel = pusherModule.subscribe(`private-user-${userId}`)

        // General billing refresh — poll immediately
        channel.bind("billing.refresh", () => {
          if (!mountedRef.current) return
          pollStatus()
        })

        channel.bind("subscription.update", () => {
          if (!mountedRef.current) return
          pollStatus()
        })

        // Admin approved manual payment — redirect to deployment page immediately
        channel.bind("payment.approved", (data: any) => {
          if (!mountedRef.current) return
          if (data?.deploymentUrl) {
            router.replace(data.deploymentUrl)
          } else {
            // No service-type item — just confirm payment
            setCurrentStatus("PAID")
            setPollState("CONFIRMED")
          }
        })

        // Service workspace created / deployment status changed — redirect to service page
        channel.bind("service-update", (data: any) => {
          if (!mountedRef.current) return
          if (data?.purchasedServiceId) {
            router.replace(`/dashboard/services/${data.purchasedServiceId}`)
          }
        })

        // Admin rejected payment — redirect immediately without waiting for next poll
        channel.bind("payment.rejected", (data: any) => {
          if (!mountedRef.current) return
          const redirectUrl =
            data?.redirectUrl || `/checkout/failure?error=PAYMENT_DENIED&orderId=${order.id}`
          router.replace(redirectUrl)
        })
      } catch {
        // Pusher not available, fall back to polling only
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      if (channel && pusherModule) {
        try {
          pusherModule.unsubscribe(`private-user-${userId}`)
        } catch {}
      }
    }
  }, [userId, pollState, pollStatus, order.id, router])

  const isPaid = currentStatus === "PAID" || currentStatus === "FULFILLED"
  const awaitingManualVerification = order.status === "AWAITING_VERIFICATION"
  const isDeploymentQueued = pollState === "DEPLOYMENT_QUEUED"

  // When confirmed via Pusher or polling, refresh router data
  useEffect(() => {
    if (isPaid && !isDeploymentQueued) {
      setPollState("CONFIRMED")
    }
  }, [isPaid, isDeploymentQueued])

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Status banner */}
        <div
          className={`rounded-lg border p-6 ${
            isDeploymentQueued
              ? "border-blue-500/30 bg-blue-500/10"
              : isPaid
              ? "border-emerald-500/30 bg-emerald-500/10"
              : pollState === "TIMEOUT"
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          {/* Deployment in progress (payment approved, service workspace being set up) */}
          {isDeploymentQueued ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <Rocket className="h-8 w-8 text-blue-300 animate-pulse" />
                <h1 className="text-2xl font-bold text-blue-200">Deployment in progress</h1>
              </div>
              <p className="text-sm text-blue-300/80">
                Your payment has been verified and approved. Our team is provisioning and deploying your
                service — this usually takes a few minutes. You will be automatically redirected to your
                service dashboard once it's ready.
              </p>
              <p className="mt-2 text-xs text-blue-300/50">
                You can safely leave this page. Check your dashboard for live status updates.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-blue-300/60">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for deployment confirmation…
              </div>
            </>
          ) : pollState === "POLLING" && !isPaid ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
              <div>
                <h1 className="text-2xl font-bold text-amber-200">
                  {awaitingManualVerification ? "Waiting for manual verification" : "Confirming payment"}
                </h1>
                <p className="mt-1 text-sm text-amber-300/80">
                  {awaitingManualVerification
                    ? "Your payment verification is currently being processed. This process may take a few minutes or several hours depending on verification. Please wait while our team reviews your payment."
                    : `Order ${order.orderNumber} is being confirmed. This usually takes a few seconds.`}
                </p>
                <p className="mt-1 text-xs text-amber-300/60">
                  Realtime updates active — you'll see changes immediately.
                </p>
              </div>
            </div>
          ) : isPaid ? (
            <>
              <BadgeCheck className="mb-4 h-10 w-10 text-emerald-300" />
              <h1 className="text-3xl font-black">Payment verified</h1>
              <p className="mt-2 text-zinc-300">
                Order {order.orderNumber} is confirmed and NexusAI access provisioning has been queued or
                completed.
              </p>
            </>
          ) : pollState === "TIMEOUT" ? (
            <>
              <RefreshCw className="mb-4 h-10 w-10 text-amber-300" />
              <h1 className="text-2xl font-bold text-amber-200">Payment is being processed</h1>
              <p className="mt-2 text-sm text-amber-300/80">
                Order {order.orderNumber} is still processing. Check your dashboard for updates — your
                subscription will activate automatically once confirmed.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-amber-500/30 bg-transparent text-amber-200 hover:bg-amber-500/20"
                onClick={() => {
                  setPollState("POLLING")
                  pollCountRef.current = 0
                }}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Check again
              </Button>
            </>
          ) : null}
        </div>

        {isPaid && !isDeploymentQueued ? (
          /* ── Premium paid-invoice card ─────────────────────────────── */
          <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl shadow-black/40">
            <div className="px-6 pt-8 pb-6 sm:px-10">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                  <BadgeCheck className="h-4 w-4" /> Invoice Paid
                </span>
                <span className="text-xs font-medium text-zinc-400">
                  {order.invoiceNumber ?? `Order ${order.orderNumber}`}
                </span>
              </div>

              <p className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
                {order.currency === "INR" ? "₹" : `${order.currency} `}
                {order.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-sm text-zinc-400">Total paid</p>

              <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <dt className="text-zinc-500">Invoice number</dt>
                  <dd className="font-semibold">{order.invoiceNumber ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <dt className="text-zinc-500">Order ID</dt>
                  <dd className="font-semibold">{order.orderNumber}</dd>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <dt className="text-zinc-500">Payment date</dt>
                  <dd className="font-semibold">
                    {(order.payment?.paidAt ?? order.paidAt)
                      ? new Date(order.payment?.paidAt ?? order.paidAt!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <dt className="text-zinc-500">Payment method</dt>
                  <dd className="font-semibold">{(order.payment?.gateway ?? order.gateway ?? "—").replaceAll("_", " ")}</dd>
                </div>
                {order.payment?.gatewayPaymentId && (
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3 sm:col-span-2">
                    <dt className="text-zinc-500">Transaction ID</dt>
                    <dd className="font-mono text-xs font-semibold">{order.payment.gatewayPaymentId}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="border-t border-zinc-100 px-6 py-6 sm:px-10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Purchased services</h3>
              <ul className="mt-4 space-y-4">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{item.productName}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {item.tierName}
                        {item.category ? ` · ${item.category}` : ""}
                        {item.interval ? ` · ${item.interval.replaceAll("_", " ").toLowerCase()}` : ""}
                        {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                      </p>
                      {item.freeServices.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.freeServices.slice(0, 6).map((svc) => (
                            <span key={svc} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-100">
                              <Sparkles className="h-2.5 w-2.5" /> {svc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="whitespace-nowrap text-sm font-bold">
                      {order.currency === "INR" ? "₹" : `${order.currency} `}
                      {(item.unitPrice * item.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-2 border-t border-zinc-100 pt-4 text-sm">
                {order.subtotal > 0 && (
                  <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span>{order.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                )}
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600"><span>Discount</span><span>- {order.discountTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                )}
                {order.taxTotal > 0 && (
                  <div className="flex justify-between text-zinc-500"><span>Tax</span><span>{order.taxTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                )}
                <div className="flex items-baseline justify-between pt-2 text-base font-black text-zinc-900">
                  <span>Total paid</span>
                  <span>
                    {order.currency === "INR" ? "₹" : `${order.currency} `}
                    {order.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-zinc-100 bg-zinc-50/70 px-6 py-6 sm:grid-cols-2 sm:px-10">
              <Button asChild className="h-11 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">
                <a href={order.invoiceId ? `/api/invoices/${order.invoiceId}/download` : "/dashboard/invoices"} download>
                  <Download className="mr-2 h-4 w-4" /> Download Invoice
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100">
                <a href={order.invoiceId ? `/api/invoices/${order.invoiceId}/receipt` : "/dashboard/invoices"} download>
                  <Receipt className="mr-2 h-4 w-4" /> Download Receipt
                </a>
              </Button>
            </div>
          </div>
        ) : (
          /* ── Activated / order items (pre-confirmation states) ─────── */
          <>
            <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="font-bold">
                  {isDeploymentQueued ? "Deploying items" : isPaid ? "Activated items" : "Order items"}
                </h2>
              </div>
              <div className="divide-y divide-white/10">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-zinc-500">
                        {item.tierName} · {item.fulfillmentType.replaceAll("_", " ")}
                      </p>
                    </div>
                    {isDeploymentQueued ? (
                      <Rocket className="h-5 w-5 text-blue-300 animate-pulse" />
                    ) : isPaid ? (
                      <PackageCheck className="h-5 w-5 text-emerald-300" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button asChild>
                <Link href="/dashboard/subscriptions">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Open billing center
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/10 bg-transparent">
                <Link href={order.invoiceId ? `/api/invoices/${order.invoiceId}/download` : "/dashboard/invoices"}>
                  <FileText className="mr-2 h-4 w-4" />
                  Download invoice
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
