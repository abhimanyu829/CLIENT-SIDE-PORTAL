/**
 * hooks/useRazorpayCheckout.ts
 *
 * Enterprise-grade React hook for Razorpay Standard Checkout.
 * Handles:
 *   - Order creation on backend
 *   - Dynamic script loading
 *   - Checkout popup with all payment methods (UPI, QR, Cards, Wallets, EMI)
 *   - HMAC signature verification via backend
 *   - Payment failure recovery with preserved state
 *   - Retry capability
 *
 * Usage:
 *   const { initiatePayment, loading, error, retrying, retry } = useRazorpayCheckout({ tierId, productId })
 */
"use client"

import { useCallback, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

declare global {
  interface Window {
    Razorpay?: any
  }
}

export type CheckoutMode = "cart" | "buy_now"

export interface UseRazorpayCheckoutOptions {
  tierId?: string
  productId?: string
  mode?: CheckoutMode
  couponCode?: string
  billingAddress?: {
    billingEmail?: string
    company?: string
    gstin?: string
  }
  /** If true, automatically redirect to success page after payment. Default: true */
  autoRedirect?: boolean
  onSuccess?: (data: { orderId: string; orderNumber: string; redirectUrl: string }) => void
  onError?: (error: string) => void
  onDismiss?: () => void
}

export interface UseRazorpayCheckoutResult {
  initiatePayment: () => Promise<void>
  loading: boolean
  error: string | null
  retryCount: number
  retry: () => void
  clearError: () => void
}

/**
 * Idempotent Razorpay script loader.
 * Resolves `true` when the `window.Razorpay` constructor is available.
 */
export const loadRazorpayScript = async (): Promise<boolean> => {
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

export function useRazorpayCheckout({
  tierId,
  productId,
  mode = "buy_now",
  couponCode,
  billingAddress,
  autoRedirect = true,
  onSuccess,
  onError,
  onDismiss,
}: UseRazorpayCheckoutOptions): UseRazorpayCheckoutResult {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const initiatePayment = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      // ── 1. Create Razorpay order ──────────────────────────────────────────
      const orderRes = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          tierId,
          productId,
          couponCode,
          billingAddress,
        }),
      })

      const orderJson = await orderRes.json()

      if (!orderRes.ok || !orderJson.success) {
        const rawMsg = orderJson.error?.message ?? orderJson.error?.code ?? "Unable to initiate payment."
        const msg = typeof rawMsg === "string" ? rawMsg : Array.isArray(rawMsg)
          ? rawMsg.map((e: any) => e.message).join(", ")
          : "Unable to initiate payment."
        throw new Error(msg)
      }

      const { keyId, order, razorpayOrder } = orderJson.data

      if (!razorpayOrder?.id || !keyId) {
        throw new Error("Invalid response from payment server. Please try again.")
      }

      // ── 2. Load Razorpay checkout.js ──────────────────────────────────────
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        throw new Error(
          "Razorpay Checkout failed to load. Please disable any ad blockers or content blockers and try again."
        )
      }

      // ── 3. Open Razorpay Standard Checkout ────────────────────────────────
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
          email: billingAddress?.billingEmail || session?.user?.email || "",
        },
        notes: {
          orderId: order.id,
          userId: session?.user?.id ?? "",
          tierId: tierId ?? "",
          productId: productId ?? "",
          checkoutMode: mode,
        },
        theme: { color: "#6366f1" },
        modal: {
          escape: true,
          animation: true,
          ondismiss: () => {
            setLoading(false)
            onDismiss?.()
          },
        },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          // ── 4. Verify payment on backend ──────────────────────────────────
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

            const verifyJson = await verifyRes.json()

            if (!verifyRes.ok || !verifyJson.success) {
              // Payment captured but verification had a network/server error.
              // The webhook will reconcile this. Redirect to success page anyway.
              const pendingUrl = `/checkout/success?orderId=${order.id}&pending=1`
              onSuccess?.({ orderId: order.id, orderNumber: order.orderNumber, redirectUrl: pendingUrl })
              if (autoRedirect) router.push(pendingUrl)
              setLoading(false)
              return
            }

            const successData = {
              orderId: verifyJson.data.orderId,
              orderNumber: verifyJson.data.orderNumber,
              redirectUrl: verifyJson.data.redirectUrl ?? `/checkout/success?orderId=${order.id}`,
            }
            onSuccess?.(successData)
            if (autoRedirect) router.push(successData.redirectUrl)
            setLoading(false)

          } catch {
            // Network failure during verify — redirect to pending success page
            const pendingUrl = `/checkout/success?orderId=${order.id}&pending=1`
            onSuccess?.({ orderId: order.id, orderNumber: order.orderNumber, redirectUrl: pendingUrl })
            if (autoRedirect) router.push(pendingUrl)
            setLoading(false)
          }
        },
      })

      rzp.on("payment.failed", (response: any) => {
        const msg =
          response?.error?.description ??
          response?.error?.reason ??
          "Payment failed. Please try a different payment method or contact support."
        setError(msg)
        onError?.(msg)
        setLoading(false)
      })

      rzp.open()

    } catch (err) {
      const message = (err as Error).message ?? "An unexpected error occurred. Please try again."
      setError(message)
      onError?.(message)
      setLoading(false)
    }
  }, [
    tierId, productId, mode, couponCode, billingAddress,
    session, autoRedirect, onSuccess, onError, onDismiss, router, loading,
  ])

  const retry = useCallback(() => {
    setError(null)
    setRetryCount(c => c + 1)
    initiatePayment()
  }, [initiatePayment])

  const clearError = useCallback(() => setError(null), [])

  return { initiatePayment, loading, error, retryCount, retry, clearError }
}
