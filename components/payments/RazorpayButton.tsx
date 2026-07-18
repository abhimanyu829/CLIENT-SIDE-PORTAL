"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { QrCode, Link as LinkIcon } from "lucide-react"

declare global {
  interface Window {
    Razorpay?: any
  }
}

interface RazorpayButtonProps {
  tierId: string
  productId?: string
  mode?: "cart" | "buy_now"
  paymentMethod?: "checkout" | "qr" | "link"
}

function loadRazorpayScript(timeout = 10000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false)
    if ((window as any).Razorpay) return resolve(true)

    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay-checkout]")
    let timer: number | null = null
    const cleanup = () => { if (timer) window.clearTimeout(timer) }

    if (existing) {
      const state = existing.getAttribute("data-razorpay-loaded")
      if (state === "error") {
        existing.remove()
      } else {
        const onLoad = () => { existing.setAttribute("data-razorpay-loaded", "loaded"); cleanup(); resolve(true) }
        const onError = () => { existing.setAttribute("data-razorpay-loaded", "error"); cleanup(); resolve(false) }
        existing.addEventListener("load", onLoad, { once: true })
        existing.addEventListener("error", onError, { once: true })
        timer = window.setTimeout(() => { cleanup(); resolve(Boolean((window as any).Razorpay)) }, timeout)
        return
      }
    }

    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.dataset.razorpayCheckout = "true"
    script.setAttribute("data-razorpay-loaded", "loading")
    script.onload = () => { script.setAttribute("data-razorpay-loaded", "loaded"); cleanup(); resolve(true) }
    script.onerror = () => { script.setAttribute("data-razorpay-loaded", "error"); cleanup(); resolve(false) }
    document.body.appendChild(script)
    timer = window.setTimeout(() => { cleanup(); resolve(Boolean((window as any).Razorpay)) }, timeout)
  })
}

export function RazorpayButton({ tierId, productId, mode = "buy_now", paymentMethod = "checkout" }: RazorpayButtonProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayment = async () => {
    setLoading(true)
    setError(null)

    try {
      const orderRes = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, tierId, productId, paymentMethod }),
      })
      const json = await orderRes.json()
      if (!orderRes.ok || !json.success) throw new Error(json.error?.message ?? "Unable to create Razorpay order")

      const data = json.data

      if (paymentMethod === "qr" && data.qr) {
        setLoading(false)
        router.push(`/checkout/failure?reason=qr_not_supported`)
        return
      }

      if (paymentMethod === "link" && data.paymentLink) {
        window.location.href = data.paymentLink.shortUrl
        return
      }

      const loaded = await loadRazorpayScript()
      if (!loaded) throw new Error("Unable to load Razorpay Checkout")

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.razorpayOrder.amount,
        currency: data.razorpayOrder.currency,
        name: "NexusAI",
        description: `Order ${data.order.orderNumber}`,
        image: "/logo.png",
        order_id: data.razorpayOrder.id,
        prefill: {
          name: session?.user?.name ?? "",
          email: session?.user?.email ?? "",
        },
        notes: {
          orderId: data.order.id,
          userId: session?.user?.id ?? "",
          tierId,
          productId: productId ?? "",
          checkoutMode: mode,
        },
        theme: {
          color: "#6366f1",
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
          },
        },
        handler: async (response: any) => {
          try {
            const verify = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })
            const verified = await verify.json()
            if (!verify.ok || !verified.success) throw new Error(verified.error?.message ?? "Payment verification failed")
            router.push(verified.data.redirectUrl)
          } catch (err) {
            setError((err as Error).message)
            setLoading(false)
          }
        },
      })

      rzp.open()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handlePayment}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-zinc-800 transition-colors"
      >
        {loading ? (
          "Processing..."
        ) : paymentMethod === "qr" ? (
          <>
            <QrCode className="h-4 w-4" /> Pay with QR
          </>
        ) : paymentMethod === "link" ? (
          <>
            <LinkIcon className="h-4 w-4" /> Get Payment Link
          </>
        ) : (
          "Pay with Razorpay"
        )}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
