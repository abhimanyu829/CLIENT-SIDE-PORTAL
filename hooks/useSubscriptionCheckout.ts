/**
 * hooks/useSubscriptionCheckout.ts
 *
 * Phase 7 — Recurring subscription checkout (Razorpay Subscriptions).
 * Distinct from the one-time order flow: uses subscription_id-based checkout
 * and the Phase-4 server contract. Never marks billing active client-side —
 * the verified webhook drives the lifecycle; this hook only confirms signature
 * and surfaces the honest pending state.
 */
"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { loadRazorpayScript } from "@/hooks/useRazorpayCheckout"

declare global {
  interface Window {
    Razorpay?: any
  }
}

export interface SubscriptionCheckoutResult {
  internalSubscriptionId: string
  razorpaySubscriptionId: string
  planVersionId: string
}

export interface UseSubscriptionCheckoutOptions {
  internalSubscriptionId?: string
  onPending?: (data: SubscriptionCheckoutResult) => void
  onError?: (error: string) => void
  onDismiss?: () => void
}

export interface UseSubscriptionCheckoutResult {
  initiateSubscription: (planVersionId: string) => Promise<void>
  loading: boolean
  error: string | null
  pending: SubscriptionCheckoutResult | null
  clearError: () => void
}

export function useSubscriptionCheckout({
  onPending,
  onError,
  onDismiss,
}: UseSubscriptionCheckoutOptions): UseSubscriptionCheckoutResult {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<SubscriptionCheckoutResult | null>(null)

  const initiateSubscription = useCallback(async (planVersionId: string) => {
    if (!planVersionId) {
      setError("Plan version is unavailable for checkout.")
      onError?.("Plan version is unavailable for checkout.")
      return
    }
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      // 1. Server-side creation (Phase 4): never creates from client inputs.
      const res = await fetch("/api/customer/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planVersionId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? json.error ?? "Unable to initiate subscription.")
      }
      const { keyId, internalSubscriptionId, razorpaySubscriptionId } = json.data as {
        keyId: string
        internalSubscriptionId: string
        razorpaySubscriptionId: string
      }
      if (!keyId || !razorpaySubscriptionId) {
        throw new Error("Invalid subscription preparation response.")
      }

      // 2. Load Razorpay checkout.
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        throw new Error("Razorpay Checkout failed to load. Disable blocker extensions and retry.")
      }

      // 3. Open subscription checkout (recurring contract, explicit consent).
      const rzp = new (window as any).Razorpay({
        key: keyId,
        subscription_id: razorpaySubscriptionId,
        name: "NexusAI",
        description: "Recurring subscription",
        image: "/logo.png",
        theme: { color: "#6366f1" },
        notes: {
          internalSubscriptionId,
          planVersionId,
        },
        modal: {
          escape: true,
          animation: true,
          ondismiss: () => {
            setLoading(false)
            onDismiss?.()
          },
        },
        handler: async (response: {
          razorpay_payment_id?: string
          razorpay_subscription_id?: string
          razorpay_signature?: string
        }) => {
          try {
            const verifyRes = await fetch("/api/customer/subscriptions/confirm-checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                internalSubscriptionId,
                razorpaySubscriptionId: response.razorpay_subscription_id ?? razorpaySubscriptionId,
                razorpayPaymentId: response.razorpay_payment_id ?? "",
                razorpaySignature: response.razorpay_signature ?? "",
              }),
            })
            const verifyJson = await verifyRes.json()
            if (!verifyRes.ok || !verifyJson.success) {
              // Signature failed or payload incomplete: billing is NOT verified.
              const reason = verifyJson.error ?? "Checkout verification failed."
              const message = typeof reason === "string" ? reason : "Checkout verification failed."
              setError(message)
              onError?.(message)
              setLoading(false)
              return
            }
            const result: SubscriptionCheckoutResult = {
              internalSubscriptionId,
              razorpaySubscriptionId,
              planVersionId,
            }
            setPending(result)
            onPending?.(result)
            // Activation is confirmed by the payment webhook — reflect pending.
            router.push(`/dashboard/subscription?checked=1`)
            setLoading(false)
          } catch {
            const message = "Payment may have been processed, but verification is pending (webhook confirmation)."
            setError(message)
            onError?.(message)
            setLoading(false)
          }
        },
      })

      rzp.on("payment.failed", (response: any) => {
        const msg =
          response?.error?.description ??
          response?.error?.reason ??
          "Payment failed. No charge was confirmed."
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
  }, [loading, router, onPending, onError, onDismiss])

  const clearError = useCallback(() => setError(null), [])

  return { initiateSubscription, loading, error, pending, clearError }
}
