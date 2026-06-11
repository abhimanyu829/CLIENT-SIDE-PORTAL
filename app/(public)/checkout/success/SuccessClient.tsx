"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BadgeCheck, FileText, LayoutDashboard, Loader2, PackageCheck, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type SuccessOrder = {
  id: string
  orderNumber: string
  status: string
  currency: string
  grandTotal: number
  paidAt: string | null
  items: Array<{
    id: string
    name: string
    tierName: string
    fulfillmentType: string
    productName: string
  }>
  invoiceId: string | null
}

type PollState = "POLLING" | "CONFIRMED" | "TIMEOUT"

export default function SuccessClient({ order, userId }: { order: SuccessOrder; userId?: string }) {
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
      if (json?.data?.order?.status === "PAID" || json?.data?.order?.status === "FULFILLED" || json?.data?.paymentStatus === "SUCCESS") {
        setCurrentStatus("PAID")
        setPollState("CONFIRMED")
        return true
      }
    } catch {
      // Continue polling on error
    }
    return false
  }, [order.id])

  useEffect(() => {
    if (pollState !== "POLLING") return

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

    // Hard timeout at 2 minutes
    const hardTimeout = setTimeout(() => {
      if (mountedRef.current && pollState === "POLLING") {
        setPollState("TIMEOUT")
      }
    }, 120_000)

    return () => {
      mountedRef.current = false
      if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current)
      clearTimeout(hardTimeout)
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

        channel.bind("billing.refresh", () => {
          if (!mountedRef.current) return
          // Immediately poll when we get a realtime event
          pollStatus()
        })

        channel.bind("subscription.update", () => {
          if (!mountedRef.current) return
          pollStatus()
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
  }, [userId, pollState, pollStatus])

  const isPaid = currentStatus === "PAID" || currentStatus === "FULFILLED"

  // When confirmed via Pusher or polling, refresh router data
  useEffect(() => {
    if (isPaid) {
      setPollState("CONFIRMED")
    }
  }, [isPaid])

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Status banner */}
        <div className={`rounded-lg border p-6 ${
          isPaid ? "border-emerald-500/30 bg-emerald-500/10" :
          pollState === "TIMEOUT" ? "border-amber-500/30 bg-amber-500/10" :
          "border-amber-500/30 bg-amber-500/10"
        }`}>
          {pollState === "POLLING" && !isPaid ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
              <div>
                <h1 className="text-2xl font-bold text-amber-200">Confirming payment</h1>
                <p className="mt-1 text-sm text-amber-300/80">
                  Order {order.orderNumber} is being confirmed. This usually takes a few seconds.
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
                Order {order.orderNumber} is confirmed and NexusAI access provisioning has been queued or completed.
              </p>
            </>
          ) : pollState === "TIMEOUT" ? (
            <>
              <RefreshCw className="mb-4 h-10 w-10 text-amber-300" />
              <h1 className="text-2xl font-bold text-amber-200">Payment is being processed</h1>
              <p className="mt-2 text-sm text-amber-300/80">
                Order {order.orderNumber} is still processing. Check your dashboard for updates — your subscription will activate automatically once confirmed.
              </p>
              <Button variant="outline" size="sm" className="mt-3 border-amber-500/30 bg-transparent text-amber-200 hover:bg-amber-500/20" onClick={() => {
                setPollState("POLLING")
                pollCountRef.current = 0
              }}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Check again
              </Button>
            </>
          ) : null}
        </div>

        {/* Activated items */}
        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-bold">{isPaid ? "Activated items" : "Order items"}</h2>
          </div>
          <div className="divide-y divide-white/10">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-zinc-500">{item.tierName} · {item.fulfillmentType.replaceAll("_", " ")}</p>
                </div>
                {isPaid && <PackageCheck className="h-5 w-5 text-emerald-300" />}
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
      </div>
    </div>
  )
}