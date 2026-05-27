/**
 * RazorpayButton.tsx
 *
 * Enterprise-grade Razorpay Standard Checkout trigger.
 * Uses ONLY Razorpay Standard Checkout — which natively handles:
 *   UPI · QR · Cards · Wallets · Net Banking · EMI
 *
 * NO manual QR generation. NO payment link generation.
 * Razorpay's own popup handles all payment methods.
 */
"use client"

import { useCallback, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { CreditCard, Loader2, RefreshCw, AlertCircle } from "lucide-react"

declare global {
  interface Window {
    Razorpay?: any
  }
}

interface RazorpayButtonProps {
  /** DB tierId to be purchased */
  tierId: string
  /** Optional DB productId */
  productId?: string
  /** "cart" uses the user's active cart; "buy_now" creates a one-item cart */
  mode?: "cart" | "buy_now"
  /** Coupon code to apply to the order */
  couponCode?: string
  /** Visual label override */
  label?: string
  /** Additional CSS classes */
  className?: string
  /** Called when payment is verified successfully */
  onSuccess?: (orderId: string, orderNumber: string) => void
  /** Called when payment fails or is dismissed */
  onError?: (message: string) => void
  /** Whether to auto-redirect to success page */
  autoRedirect?: boolean
}

/**
 * Dynamically loads the Razorpay checkout.js script.
 * Idempotent — safe to call multiple times.
 */
const loadRazorpayScript = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Already loaded
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true)
      return
    }

    const existingScript = document.getElementById("razorpay-checkout")

    // Script already exists
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true))
      existingScript.addEventListener("error", () => resolve(false))
      return
    }

    const script = document.createElement("script")

    script.id = "razorpay-checkout"
    script.src = "https://checkout.razorpay.com/v1/checkout.js"

    script.async = true

    script.onload = () => {
      console.log("✅ Razorpay SDK loaded")
      resolve(true)
    }

    script.onerror = () => {
      console.error("❌ Razorpay SDK failed to load")
      resolve(false)
    }

    document.body.appendChild(script)
  })
}

export function RazorpayButton({
  tierId,
  productId,
  mode = "buy_now",
  couponCode,
  label,
  className,
  onSuccess,
  onError,
  autoRedirect = true,
}: RazorpayButtonProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const handlePayment = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      // ── Step 1: Create Razorpay order on backend ──────────────────────────
      const orderRes = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, tierId, productId, couponCode }),
      })

      const json = await orderRes.json()

      if (!orderRes.ok || !json.success) {
        const msg = json.error?.message ?? json.error?.code ?? "Unable to create order. Please try again."
        throw new Error(typeof msg === "string" ? msg : "Unable to create order.")
      }

      const { keyId, order, razorpayOrder } = json.data

      if (!razorpayOrder?.id) {
        throw new Error("Payment gateway did not return an order ID. Please try again.")
      }

      if (!keyId) {
        throw new Error("Payment gateway is not configured. Please contact support.")
      }

      // ── Step 2: Load Razorpay checkout.js ─────────────────────────────────
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded || !(window as any).Razorpay) {
        throw new Error(
          "Razorpay Checkout could not be loaded. Please check your internet connection and disable any ad blockers, then try again."
        )
      }

      // ── Step 3: Open Razorpay Standard Checkout ───────────────────────────
      // This popup natively handles: UPI · QR · Cards · Wallets · Net Banking · EMI
      // No manual QR generation required.
      const rzp = new (window as any).Razorpay({
        key: keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency ?? "INR",
        name: "NexusAI",
        description: `Order ${order.orderNumber}`,
        image: "/logo.png",
        order_id: razorpayOrder.id,
        prefill: {
          name: session?.user?.name ?? "",
          email: session?.user?.email ?? "",
        },
        notes: {
          orderId: order.id,
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
            // Don't set error on dismiss — user may have intentionally closed
          },
          escape: true,
          animation: true,
        },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          // ── Step 4: Verify payment signature on backend ──────────────────
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })

            const verified = await verifyRes.json()

            if (!verifyRes.ok || !verified.success) {
              // Payment went through but verify endpoint errored.
              // This is safe — webhook will reconcile the state.
              // Redirect to success page with the order ID so user can track.
              const fallbackUrl = `/checkout/success?orderId=${order.id}&pending=1`
              if (autoRedirect) router.push(fallbackUrl)
              onSuccess?.(order.id, order.orderNumber)
              setLoading(false)
              return
            }

            onSuccess?.(verified.data.orderId, verified.data.orderNumber)

            if (autoRedirect) {
              router.push(verified.data.redirectUrl ?? `/checkout/success?orderId=${order.id}`)
            }
            setLoading(false)
          } catch (verifyErr) {
            // Network error during verify — payment may have succeeded.
            // Redirect to success page; webhook will confirm.
            const fallbackUrl = `/checkout/success?orderId=${order.id}&pending=1`
            if (autoRedirect) router.push(fallbackUrl)
            onSuccess?.(order.id, order.orderNumber)
            setLoading(false)
          }
        },
      })

      // Handle payment.failed event from Razorpay
      rzp.on("payment.failed", (response: any) => {
        const msg = response?.error?.description ?? response?.error?.reason ?? "Payment failed. Please try a different payment method."
        setError(msg)
        onError?.(msg)
        setLoading(false)
      })

      rzp.open()

    } catch (err) {
      const message = (err as Error).message ?? "An unexpected error occurred."
      setError(message)
      onError?.(message)
      setLoading(false)
    }
  }, [tierId, productId, mode, couponCode, session, autoRedirect, onSuccess, onError, router, loading])

  const handleRetry = () => {
    setError(null)
    setRetryCount(c => c + 1)
    handlePayment()
  }

  return (
    <div className="space-y-2">
      <button
        id={`razorpay-pay-${tierId}`}
        onClick={handlePayment}
        disabled={loading}
        className={
          className ??
          "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            {label ?? "Pay with Razorpay"}
          </>
        )}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 hover:text-red-100 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry payment
          </button>
        </div>
      )}
    </div>
  )
}
