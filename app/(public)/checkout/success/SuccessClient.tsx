"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

export default function SuccessClient({ order }: { order: SuccessOrder }) {
  const router = useRouter()
  const [polling, setPolling] = useState(order.status !== "PAID" && order.status !== "FULFILLED")
  const [currentStatus, setCurrentStatus] = useState(order.status)

  // Poll for payment confirmation if order is still pending
  useEffect(() => {
    if (!polling) return

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/razorpay/status?orderId=${order.id}`)
        const json = await res.json()
        if (json?.data?.order?.status === "PAID" || json?.data?.order?.status === "FULFILLED" || json?.data?.paymentStatus === "SUCCESS") {
          setCurrentStatus("PAID")
          setPolling(false)
          clearInterval(interval)
        }
      } catch {
        // Continue polling on error
      }
    }, 3000)

    // Stop polling after 2 minutes
    const timeout = window.setTimeout(() => {
      setPolling(false)
      clearInterval(interval)
    }, 120_000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [order.id, polling])

  const isPaid = currentStatus === "PAID" || currentStatus === "FULFILLED"

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Status banner */}
        <div className={`rounded-lg border p-6 ${isPaid ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
          {polling ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
              <div>
                <h1 className="text-2xl font-bold text-amber-200">Confirming payment</h1>
                <p className="mt-1 text-sm text-amber-300/80">
                  Order {order.orderNumber} is being confirmed. This usually takes a few seconds.
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
          ) : (
            <>
              <RefreshCw className="mb-4 h-10 w-10 text-amber-300" />
              <h1 className="text-2xl font-bold text-amber-200">Payment is being processed</h1>
              <p className="mt-2 text-sm text-amber-300/80">
                Order {order.orderNumber} is still processing. Check your dashboard for updates — your subscription will activate automatically once confirmed.
              </p>
            </>
          )}
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