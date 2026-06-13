"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CreditCard,
  FileText,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Upload,
  WalletCards,
  X,
} from "lucide-react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

declare global {
  interface Window {
    Razorpay?: any
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

type InitialBuyNow = {
  tierId: string
  productId: string
  productSlug: string
  productName: string
  productType: string
  tierName: string
  interval: string
  currency: string
  price: number
  taxRate: number
  vendorName: string
  aiQuota: unknown
  thumbnailUrl?: string | null
} | null

type Cart = {
  id: string
  subtotal: string
  discountTotal: string
  taxTotal: string
  grandTotal: string
  currency: string
  couponCode?: string | null
  items: Array<{
    id: string
    quantity: number
    unitPrice: string
    currency: string
    product: { id: string; name: string; slug: string; type: string; thumbnailUrl?: string | null }
    tier?: { id: string; name: string; interval: string; aiQuota: unknown } | null
  }>
}

// ── State Machine ─────────────────────────────────────────────────────────────

type CheckoutState =
  | { phase: "IDLE"; step: "review" | "billing" | "payment" }
  | { phase: "LOADING_CART" }
  | { phase: "LOADING_SDK" }
  | { phase: "CREATING_ORDER" }
  | { phase: "PAYMENT_PENDING"; orderId: string; orderNumber: string; razorpayOrderId: string; keyId: string }
  | { phase: "VERIFYING"; orderId: string }
  | { phase: "SUCCESS"; redirectUrl: string }
  | { phase: "FAILED"; error: string; orderId?: string; canRetry: boolean }
  | { phase: "DISMISSED"; orderId: string; orderNumber: string }
  | { phase: "REDIRECTING" }
  | { phase: "MANUAL_UPI"; gateway: "PAYTM" | "PHONEPE"; orderId: string; orderNumber: string; amount: number; upiId: string; upiName: string; qrDataUrl: string }

// ── Constants ──────────────────────────────────────────────────────────────────

const SDK_LOAD_TIMEOUT_MS = 15_000
const VERIFY_TIMEOUT_MS = 30_000
const ORDER_CREATE_TIMEOUT_MS = 30_000

const trustSignals: Array<{ Icon: typeof ShieldCheck; label: string }> = [
  { Icon: ShieldCheck, label: "Server-verified signatures and webhooks" },
  { Icon: BadgeCheck, label: "Atomic order, invoice and entitlement activation" },
  { Icon: WalletCards, label: "Cards, UPI, net banking, wallets and EMI" },
  { Icon: FileText, label: "Invoice generated after captured payment" },
  { Icon: Building2, label: "Vendor payout ledger and platform fees tracked" },
]

const intervalLabels: Record<string, string> = {
  MONTHLY: "/month",
  YEARLY: "/year",
  WEEKLY: "/week",
  ONE_TIME: "",
  LIFETIME: " lifetime",
  PER_SEAT: "/seat",
  USAGE_BASED: " usage",
  TOKEN_BASED: "/tokens",
}

function formatMoney(value: number | string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

// ── Razorpay SDK Loader with Timeout ───────────────────────────────────────────

function loadRazorpayScript(timeoutMs = SDK_LOAD_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true)
      return
    }

    const existing = document.getElementById("razorpay-checkout")
    if (existing) {
      existing.addEventListener("load", () => resolve(true))
      existing.addEventListener("error", () => resolve(false))
      return
    }

    const script = document.createElement("script")
    script.id = "razorpay-checkout"
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true

    const timer = setTimeout(() => {
      console.error("[CHECKOUT] ❌ Razorpay SDK load timed out")
      script.remove()
      resolve(false)
    }, timeoutMs)

    script.onload = () => {
      clearTimeout(timer)
      console.log("[CHECKOUT] ✅ Razorpay SDK loaded")
      resolve(true)
    }

    script.onerror = () => {
      clearTimeout(timer)
      console.error("[CHECKOUT] ❌ Razorpay SDK failed to load")
      script.remove()
      resolve(false)
    }

    document.body.appendChild(script)
  })
}

// ── Checkout Session ID ────────────────────────────────────────────────────────

function generateCheckoutSessionId(): string {
  return `cks_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CheckoutClient({
  initialBuyNow,
  productSlug,
}: {
  initialBuyNow: InitialBuyNow
  productSlug?: string
}) {
  const router = useRouter()
  const [cart, setCart] = useState<Cart | null>(null)
  const [state, setState] = useState<CheckoutState>(
    initialBuyNow ? { phase: "IDLE", step: "review" } : { phase: "LOADING_CART" }
  )
  const [couponCode, setCouponCode] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [company, setCompany] = useState("")
  const [gstin, setGstin] = useState("")
  const [selectedGateway, setSelectedGateway] = useState<"RAZORPAY" | "PHONEPE" | "PAYTM">("RAZORPAY")
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const checkoutSessionId = useRef(generateCheckoutSessionId())
  const retryCountRef = useRef(0)

  // Manual UPI form state
  const [utrNumber, setUtrNumber] = useState("")
  const [claimedAmount, setClaimedAmount] = useState("")
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [submittingUtr, setSubmittingUtr] = useState(false)

  // ── Load cart ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialBuyNow) return
    let mounted = true
    fetch("/api/cart")
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.data) setCart(json.data)
      })
      .catch(() => {
        if (mounted) setState({ phase: "FAILED", error: "Unable to load your cart. Please refresh and try again.", canRetry: true })
      })
      .finally(() => {
        if (mounted) setState({ phase: "IDLE", step: "review" })
      })
    return () => { mounted = false }
  }, [initialBuyNow])

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (initialBuyNow) {
      const subtotal = initialBuyNow.price
      const tax = subtotal * ((initialBuyNow.taxRate || 18) / 100)
      return {
        currency: initialBuyNow.currency,
        subtotal,
        discount: 0,
        tax,
        total: subtotal + tax,
        items: [{
          id: initialBuyNow.tierId,
          name: initialBuyNow.productName,
          tier: initialBuyNow.tierName,
          interval: initialBuyNow.interval,
          quantity: 1,
          price: initialBuyNow.price,
          type: initialBuyNow.productType,
          thumbnailUrl: initialBuyNow.thumbnailUrl,
        }],
      }
    }
    return {
      currency: cart?.currency ?? "INR",
      subtotal: Number(cart?.subtotal ?? 0),
      discount: Number(cart?.discountTotal ?? 0),
      tax: Number(cart?.taxTotal ?? 0),
      total: Number(cart?.grandTotal ?? 0),
      items: cart?.items.map((item) => ({
        id: item.id,
        name: item.product.name,
        tier: item.tier?.name ?? "Default",
        interval: item.tier?.interval ?? "ONE_TIME",
        quantity: item.quantity,
        price: Number(item.unitPrice),
        type: item.product.type,
        thumbnailUrl: item.product.thumbnailUrl,
      })) ?? [],
    }
  }, [cart, initialBuyNow])

  // ── Apply coupon ───────────────────────────────────────────────────────────
  const applyCoupon = useCallback(async () => {
    if (!couponCode.trim() || initialBuyNow) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_coupon", couponCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Coupon could not be applied.")
      setCart(json.data)
    } catch (err) {
      setCouponError((err as Error).message)
    } finally {
      setCouponLoading(false)
    }
  }, [couponCode, initialBuyNow])

  // ── Core: Initiate Payment ──────────────────────────────────────────────────
  const initiatePayment = useCallback(async () => {
    setState({ phase: "CREATING_ORDER" })

    try {
      // 1. Create order on backend (server-side pricing, validation)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), ORDER_CREATE_TIMEOUT_MS)

      // Choose endpoint based on gateway
      let endpoint = "/api/payments/razorpay/order"
      if (selectedGateway === "PHONEPE") endpoint = "/api/payments/phonepe/order"
      if (selectedGateway === "PAYTM") endpoint = "/api/payments/paytm/order"

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: initialBuyNow ? "buy_now" : "cart",
          productId: initialBuyNow?.productId,
          tierId: initialBuyNow?.tierId,
          couponCode: couponCode || cart?.couponCode || undefined,
          billingAddress: { billingEmail, company, gstin },
          checkoutSessionId: checkoutSessionId.current,
        }),
      })
      clearTimeout(timeout)

      const json = await res.json()

      if (!res.ok || !json.success) {
        const errorMsg = json.error?.message ?? json.error?.code ?? "Unable to start secure checkout."
        const msg = typeof errorMsg === "string" ? errorMsg : "Unable to start secure checkout. Please try again."
        throw new Error(msg)
      }

      const data = json.data

      if (selectedGateway === "PHONEPE" || selectedGateway === "PAYTM") {
        // ── UPI Manual Gateway Flow ─────────────────────────────────────────
        // Backend returns: { data: { gateway, order: { id, orderNumber, amount }, upiId, upiName } }
        if (!data.upiId || !data.upiName || !data.order?.id) {
          throw new Error(
            `UPI gateway configuration is incomplete. Please contact support. (Gateway: ${selectedGateway})`
          )
        }
        const upiLink = [
          `upi://pay?pa=${encodeURIComponent(data.upiId)}`,
          `pn=${encodeURIComponent(data.upiName)}`,
          `am=${Number(data.order.amount).toFixed(2)}`,
          `cu=INR`,
          `tn=${encodeURIComponent(`NexusAI Order ${data.order.orderNumber}`)}`,
          `tr=${encodeURIComponent(data.order.orderNumber)}`,
        ].join("&")
        const qrDataUrl = await QRCode.toDataURL(upiLink, {
          margin: 1,
          width: 260,
          errorCorrectionLevel: "H",
        })

        setState({
          phase: "MANUAL_UPI",
          gateway: selectedGateway as "PAYTM" | "PHONEPE",
          orderId: data.order.id,
          orderNumber: data.order.orderNumber,
          amount: Number(data.order.amount),
          upiId: data.upiId,
          upiName: data.upiName,
          qrDataUrl,
        })
        setUtrNumber("")
        setScreenshot(null)
        setClaimedAmount(Number(data.order.amount).toFixed(2))
        return
      }

      if (!data?.razorpayOrder?.id) {
        throw new Error("No Razorpay order ID received. Please try again.")
      }

      console.log(`[CHECKOUT] ✅ Order created: ${data.order.orderNumber}, Razorpay ID: ${data.razorpayOrder.id}`)

      // 2. Load Razorpay SDK with timeout
      setState({ phase: "LOADING_SDK" })
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        setState({
          phase: "FAILED",
          error: "Payment gateway could not be loaded. Please check your internet connection and try again.",
          canRetry: true,
        })
        return
      }

      // 3. Open Razorpay Standard Checkout
      setState({
        phase: "PAYMENT_PENDING",
        orderId: data.order.id,
        orderNumber: data.order.orderNumber,
        razorpayOrderId: data.razorpayOrder.id,
        keyId: data.keyId,
      })

      const rzpOptions: any = {
        key: data.keyId,
        amount: data.razorpayOrder.amount,
        currency: data.razorpayOrder.currency,
        name: "NexusAI",
        description: `Order ${data.order.orderNumber}`,
        order_id: data.razorpayOrder.id,
        prefill: {
          email: billingEmail || undefined,
        },
        notes: {
          orderId: data.order.id,
          checkoutSessionId: checkoutSessionId.current,
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true,
        },
        config: {
          upi: { flow: "collect" },
        },
        theme: { color: "#111827" },
        modal: {
          ondismiss: () => {
            console.log("[CHECKOUT] Razorpay modal dismissed by user")
            setState({
              phase: "DISMISSED",
              orderId: data.order.id,
              orderNumber: data.order.orderNumber,
            })
          },
        },
        handler: async (response: any) => {
          // Payment succeeded — verify signature
          setState({ phase: "VERIFYING", orderId: data.order.id })
          try {
            console.log("[CHECKOUT] Payment captured, verifying signature...")
            const verifyController = new AbortController()
            const verifyTimeout = setTimeout(() => verifyController.abort(), VERIFY_TIMEOUT_MS)

            const verify = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: verifyController.signal,
              body: JSON.stringify({
                orderId: data.order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })
            clearTimeout(verifyTimeout)

            const verified = await verify.json()

            if (!verify.ok || !verified.success) {
              console.error("[CHECKOUT] ❌ Payment verification failed:", verified.error)
              // Payment went through but verification failed — webhook will reconcile
              setState({
                phase: "FAILED",
                error: `Payment was processed but verification is pending. Your order ${data.order.orderNumber} is being confirmed. You'll receive a confirmation shortly.`,
                orderId: data.order.id,
                canRetry: false,
              })
              return
            }

            console.log("[CHECKOUT] ✅ Payment verified, redirecting to success page")
            setState({ phase: "SUCCESS", redirectUrl: verified.data.redirectUrl })
            router.push(verified.data.redirectUrl)
          } catch (verifyError) {
            console.error("[CHECKOUT] ❌ Verification request error:", verifyError)
            // Network error — redirect to success page, webhook will reconcile
            setState({
              phase: "FAILED",
              error: `Payment was processed but we couldn't confirm it immediately. Your order ${data.order.orderNumber} is being verified. Please check your dashboard.`,
              orderId: data.order.id,
              canRetry: false,
            })
          }
        },
      }

      const rzp = new window.Razorpay!(rzpOptions)

      rzp.on("payment.failed", (response: any) => {
        console.error("[CHECKOUT] ❌ Razorpay payment.failed:", response.error)
        setState({
          phase: "FAILED",
          error: `Payment failed: ${response.error?.description ?? "Unknown error"}. Please try a different payment method.`,
          canRetry: true,
        })
      })

      rzp.open()
    } catch (err) {
      console.error("[CHECKOUT] ❌ Checkout flow error:", err)
      const message = (err as Error).message

      let userMessage: string
      if (message.includes("UNAUTHORIZED") || message.includes("sign in")) {
        userMessage = "Please sign in to continue checkout."
      } else if (message.includes("ACCOUNT_RESTRICTED") || message.includes("Verify your email")) {
        userMessage = "Please verify your email before checkout."
      } else if (message.includes("EMPTY_CART")) {
        userMessage = "Your cart is empty. Add items before checking out."
      } else if (message.includes("SOLD_OUT")) {
        userMessage = "This product is sold out. Please try again later."
      } else if (message.includes("RAZORPAY_NOT_CONFIGURED") || message.includes("Payment gateway")) {
        userMessage = "Payment gateway is temporarily unavailable. Please try again later."
      } else if (message.includes("PRODUCT_NOT_FOUND") || message.includes("TIER_NOT_FOUND")) {
        userMessage = "This product is no longer available. Please refresh and try again."
      } else if (message.includes("PRODUCT_UNAVAILABLE")) {
        userMessage = "This product is not available for purchase at this time."
      } else if (message.includes("ZERO_TOTAL")) {
        userMessage = "This checkout has no payable amount."
      } else if (err instanceof DOMException && err.name === "AbortError") {
        userMessage = "Checkout request timed out. Please check your connection and try again."
      } else {
        userMessage = message
      }

      setState({ phase: "FAILED", error: userMessage, canRetry: true })
    }
  }, [initialBuyNow, couponCode, cart, billingEmail, company, gstin, router, selectedGateway])

  // ── Retry ───────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    retryCountRef.current += 1
    setUtrNumber("")
    setClaimedAmount("")
    setScreenshot(null)
    setState({ phase: "IDLE", step: "payment" })
  }, [])

  // ── Submit UTR ──────────────────────────────────────────────────────────────
  const submitUtr = useCallback(async (orderId: string, expectedAmount: number) => {
    const parsedAmount = Number(claimedAmount)
    if (!utrNumber || utrNumber.length < 12 || utrNumber.length > 22 || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert("Please provide a valid 12–22 digit UTR / transaction reference and a valid claimed amount.")
      return
    }
    setSubmittingUtr(true)
    try {
      let base64Screenshot: string | null = null
      if (screenshot) {
        const reader = new FileReader()
        reader.readAsDataURL(screenshot)
        base64Screenshot = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
        })
      }

      const res = await fetch("/api/payments/submit-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          utrNumber,
          claimedAmount: Number.isFinite(parsedAmount) ? parsedAmount : expectedAmount,
          screenshot: base64Screenshot,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || "Failed to submit verification.")

      setState({ phase: "SUCCESS", redirectUrl: "/dashboard/orders" })
      router.push("/dashboard/orders")
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmittingUtr(false)
    }
  }, [claimedAmount, utrNumber, screenshot, router])

  // ── Derived UI state ────────────────────────────────────────────────────────
  const isLoading = state.phase === "LOADING_CART" || state.phase === "LOADING_SDK" || state.phase === "CREATING_ORDER" || state.phase === "VERIFYING"
  const errorMessage = state.phase === "FAILED" ? state.error : state.phase === "DISMISSED" ? "Payment was not completed. You can retry safely — duplicate orders are prevented." : null
  const canRetry = state.phase === "FAILED" ? state.canRetry : state.phase === "DISMISSED"
  const currentStep = state.phase === "IDLE" ? state.step : state.phase === "LOADING_CART" ? "review" : state.phase === "FAILED" || state.phase === "DISMISSED" ? "payment" : "payment"

  // ── Loading state ───────────────────────────────────────────────────────────
  if (state.phase === "LOADING_CART") {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading secure checkout
        </div>
      </div>
    )
  }

  // ── Empty cart ──────────────────────────────────────────────────────────────
  if (!initialBuyNow && summary.items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center px-4">
        <div className="max-w-md rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center">
          <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
          <h1 className="text-xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-zinc-500">Add an AI agent, SaaS plan, API, or service before starting checkout.</p>
          <Button asChild className="mt-5">
            <Link href={productSlug ? `/marketplace/${productSlug}` : "/marketplace"}>Return to marketplace</Link>
          </Button>
        </div>
      </div>
    )
  }

  // ── Success redirect (shouldn't render, but just in case) ──────────────────
  if (state.phase === "SUCCESS") {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-emerald-400">
          <ShieldCheck className="h-8 w-8" />
          <p className="text-lg font-bold">Payment verified!</p>
          <p className="text-sm text-zinc-400">Redirecting to confirmation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">NexusAI Commerce</Link>
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <LockKeyhole className="h-4 w-4" />
            Razorpay secured checkout
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1fr_420px]">
        <section className="space-y-5">
          {/* Step indicator */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { id: "review" as const, label: "Cart" },
                { id: "billing" as const, label: "Billing" },
                { id: "payment" as const, label: "Payment" },
                { id: "processing" as const, label: "Provision" },
              ].map(({ id, label }) => {
                const isActive = currentStep === id || (id === "processing" && isLoading)
                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (!isLoading && id !== "processing") setState({ phase: "IDLE", step: id as "review" | "billing" | "payment" })
                    }}
                    className={`rounded-md px-3 py-2 font-semibold transition-colors ${
                      isActive ? "bg-white text-zinc-950" : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error / Dismiss banner */}
          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <div className="flex-1">
                  <p className="text-sm text-red-200">{errorMessage}</p>
                  {canRetry && (
                    <Button variant="outline" size="sm" onClick={handleRetry} className="mt-3 border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/20">
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Retry payment
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Phase: Loading SDK */}
          {state.phase === "LOADING_SDK" && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
              <h2 className="mt-4 text-xl font-bold">Loading payment gateway</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Initializing Razorpay Checkout. This should only take a moment...
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                If this takes too long, please check your internet connection or disable ad blockers.
              </p>
            </div>
          )}

          {/* Phase: Creating Order */}
          {state.phase === "CREATING_ORDER" && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
              <h2 className="mt-4 text-xl font-bold">Creating secure order</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Validating pricing, inventory, and preparing your checkout session.
              </p>
            </div>
          )}

          {/* Phase: Verifying */}
          {state.phase === "VERIFYING" && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
              <h2 className="mt-4 text-xl font-bold">Verifying payment</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Confirming your payment signature. This usually takes a few seconds.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Do not close this page. If verification takes too long, the webhook will reconcile your payment automatically.
              </p>
            </div>
          )}

          {/* Phase: Payment Pending (Razorpay popup is open) */}
          {state.phase === "REDIRECTING" && (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <div>
                <h2 className="text-xl font-bold">Redirecting to payment gateway</h2>
                <p className="text-sm text-zinc-400 mt-2">
                  Please wait while we transfer you securely. Do not close this window.
                </p>
              </div>
            </div>
          )}

          {state.phase === "PAYMENT_PENDING" && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
              <h2 className="mt-4 text-xl font-bold">Complete your payment</h2>
              <p className="mt-2 text-sm text-zinc-400">
                The Razorpay Checkout popup is open. Pay with cards, UPI, QR, wallets, or net banking.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Order: <span className="font-mono text-zinc-300">{state.orderNumber}</span>
              </p>
              <p className="mt-3 text-xs text-zinc-600">
                If the popup doesn't appear, check your browser's popup blocker settings.
              </p>
            </div>
          )}

          {/* Phase: Manual UPI Verification */}
          {state.phase === "MANUAL_UPI" && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-8">
              {/* Gateway Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 mb-4">
                  <WalletCards className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">
                    {state.gateway === "PAYTM" ? "Paytm Direct UPI" : "PhonePe Direct UPI"}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">Scan & Pay</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Open your{" "}
                  <strong className="text-white">
                    {state.gateway === "PAYTM" ? "Paytm" : "PhonePe"}
                  </strong>{" "}
                  app and scan the QR code below to complete your payment.
                </p>
              </div>

              {/* QR Code */}
              <div className="mx-auto overflow-hidden rounded-xl bg-white p-3 shadow-xl" style={{ width: "fit-content" }}>
                <img src={state.qrDataUrl} alt="UPI QR Code" className="h-56 w-56" />
              </div>

              {/* UPI Handle & Order Info */}
              <div className="mt-4 text-center space-y-1">
                <p className="text-sm font-mono font-semibold text-emerald-400">
                  UPI ID: {state.upiId}
                </p>
                <p className="text-xs text-zinc-500">
                  Pay exactly{" "}
                  <span className="font-semibold text-white">
                    ₹{Number(state.amount).toFixed(2)}
                  </span>{" "}
                  · Order <span className="font-mono text-zinc-300">{state.orderNumber}</span>
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Add <span className="text-zinc-400 font-mono">{state.orderNumber}</span> as the payment note/description for faster verification.
                </p>
              </div>

              {/* Divider */}
              <div className="my-6 border-t border-white/10" />

              {/* UTR Submission */}
              <div className="space-y-4 max-w-sm mx-auto">
                <h3 className="text-sm font-semibold text-white">Submit Payment Proof</h3>
                <p className="text-xs text-zinc-400">
                  After completing the payment, enter the <strong className="text-white">12-digit UTR</strong> (transaction reference number) from your UPI app and upload a screenshot as proof.
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">UTR / Transaction Reference Number</label>
                  <Input
                    placeholder="e.g. 312345678901"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    maxLength={22}
                    className="border-white/20 bg-zinc-900 font-mono text-base tracking-widest"
                  />
                  {utrNumber.length > 0 && utrNumber.length < 12 && (
                    <p className="text-xs text-amber-400">{12 - utrNumber.length} more digits needed</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">Claimed Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={claimedAmount}
                    onChange={(e) => setClaimedAmount(e.target.value)}
                    placeholder={state.amount.toFixed(2)}
                    className="border-white/20 bg-zinc-900 font-mono text-base tracking-widest"
                  />
                  <p className="text-xs text-zinc-500">
                    This amount is saved as an unverified claim and validated by the backend.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">Payment Screenshot</label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="border-white/20 bg-zinc-900 w-full justify-start"
                      onClick={() => document.getElementById("screenshot-upload")?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {screenshot ? screenshot.name : "Upload screenshot"}
                    </Button>
                    <input
                      id="screenshot-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">Screenshot is optional but can help the admin verify faster.</p>
                  {screenshot && (
                    <p className="text-xs text-emerald-400">✓ Screenshot ready to submit</p>
                  )}
                </div>

                <Button
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  disabled={submittingUtr || utrNumber.length < 12 || !claimedAmount}
                  onClick={() => submitUtr(state.orderId, state.amount)}
                >
                  {submittingUtr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {submittingUtr ? "Submitting for verification..." : "Submit Payment Proof"}
                </Button>

                <p className="text-xs text-center text-zinc-500">
                  Your order will be activated within minutes after an admin verifies your payment.
                </p>
              </div>
            </div>
          )}

          {/* Phase: Dismissed */}
          {state.phase === "DISMISSED" && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-6 text-center">
              <X className="mx-auto h-8 w-8 text-amber-400" />
              <h2 className="mt-3 text-xl font-bold text-amber-200">Payment not completed</h2>
              <p className="mt-2 text-sm text-zinc-400">
                You closed the payment popup. Your order <span className="font-mono text-white">{state.orderNumber}</span> is still pending — no duplicate charges will be made.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setState({ phase: "IDLE", step: "payment" })} className="border-white/10 bg-transparent">
                  Back to payment
                </Button>
                <Button onClick={handleRetry}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry payment
                </Button>
              </div>
            </div>
          )}

          {/* Phase: Failed */}
          {state.phase === "FAILED" && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
              <h2 className="mt-3 text-xl font-bold text-red-300">Payment failed</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Your payment could not be processed. Your cart and order details are preserved.
              </p>
              {state.orderId && (
                <p className="mt-1 text-xs text-zinc-500">
                  Order reference: <span className="font-mono text-zinc-300">{state.orderId.slice(0, 12)}</span>
                </p>
              )}
              <div className="mt-5 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setState({ phase: "IDLE", step: "payment" })} className="border-white/10 bg-transparent">
                  Back to payment
                </Button>
                {state.canRetry && (
                  <Button onClick={handleRetry}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry payment
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step: Review */}
          {(state.phase === "IDLE" && state.step === "review") && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Review order</h1>
                  <p className="text-sm text-zinc-500">Validated pricing, tax, subscription and AI quota snapshots.</p>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">Live cart</Badge>
              </div>

              <div className="space-y-3">
                {summary.items.map((item) => (
                  <div key={item.id} className="grid gap-4 rounded-lg border border-white/10 bg-zinc-950/60 p-4 sm:grid-cols-[56px_1fr_auto]">
                    <div className="h-14 w-14 overflow-hidden rounded-md bg-zinc-900">
                      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ShoppingCart className="h-5 w-5 text-zinc-500" /></div>}
                    </div>
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-zinc-500">{item.tier} {intervalLabels[item.interval] ?? ""} · {item.type.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-zinc-600">Qty {item.quantity} · instant provisioning after verified webhook</p>
                    </div>
                    <p className="font-bold">{formatMoney(item.price * item.quantity, summary.currency)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <Button onClick={() => setState({ phase: "IDLE", step: "billing" })}>Continue</Button>
              </div>
            </div>
          )}

          {/* Step: Billing */}
          {(state.phase === "IDLE" && state.step === "billing") && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-xl font-bold">Billing details</h2>
              <p className="mt-1 text-sm text-zinc-500">Used for invoices, tax records, and subscription renewal notices.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-500">Billing email</span>
                  <Input value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="billing@company.com" className="border-white/10 bg-zinc-950" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-500">Company</span>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className="border-white/10 bg-zinc-950" />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs font-semibold text-zinc-500">GSTIN / tax ID</span>
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="Optional" className="border-white/10 bg-zinc-950" />
                </label>
              </div>
              <div className="mt-5 flex justify-between">
                <Button variant="outline" onClick={() => setState({ phase: "IDLE", step: "review" })} className="border-white/10 bg-transparent">Back</Button>
                <Button onClick={() => setState({ phase: "IDLE", step: "payment" })}>Continue to payment</Button>
              </div>
            </div>
          )}

          {/* Step: Payment */}
          {(state.phase === "IDLE" && state.step === "payment") && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-xl font-bold">Secure payment</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Choose your payment method. Paytm and PhonePe use Direct UPI — you will scan a QR code and submit the UTR reference for instant admin verification.
              </p>

              <div className="mt-5 space-y-3">
                <div 
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${selectedGateway === "RAZORPAY" ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                  onClick={() => setSelectedGateway("RAZORPAY")}
                >
                  <div className="flex items-start gap-3">
                    <ShieldCheck className={`mt-0.5 h-5 w-5 shrink-0 ${selectedGateway === "RAZORPAY" ? "text-emerald-400" : "text-zinc-500"}`} />
                    <div className="text-sm">
                      <p className={`font-semibold ${selectedGateway === "RAZORPAY" ? "text-white" : "text-zinc-400"}`}>Razorpay Standard Checkout</p>
                      <p className="mt-1 text-zinc-500">Cards, UPI, net banking, wallets, and EMI.</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${selectedGateway === "PHONEPE" ? "border-indigo-500/50 bg-indigo-500/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                  onClick={() => setSelectedGateway("PHONEPE")}
                >
                  <div className="flex items-start gap-3">
                    <WalletCards className={`mt-0.5 h-5 w-5 shrink-0 ${selectedGateway === "PHONEPE" ? "text-indigo-400" : "text-zinc-500"}`} />
                    <div className="text-sm">
                      <p className={`font-semibold ${selectedGateway === "PHONEPE" ? "text-white" : "text-zinc-400"}`}>PhonePe (Direct UPI)</p>
                      <p className="mt-1 text-zinc-500">Scan QR code via PhonePe · UTR verification.</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${selectedGateway === "PAYTM" ? "border-sky-500/50 bg-sky-500/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                  onClick={() => setSelectedGateway("PAYTM")}
                >
                  <div className="flex items-start gap-3">
                    <WalletCards className={`mt-0.5 h-5 w-5 shrink-0 ${selectedGateway === "PAYTM" ? "text-sky-400" : "text-zinc-500"}`} />
                    <div className="text-sm">
                      <p className={`font-semibold ${selectedGateway === "PAYTM" ? "text-white" : "text-zinc-400"}`}>Paytm (Direct UPI)</p>
                      <p className="mt-1 text-zinc-500">Scan QR code via Paytm · UTR verification.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-between">
                <Button variant="outline" onClick={() => setState({ phase: "IDLE", step: "billing" })} className="border-white/10 bg-transparent">Back</Button>
                <Button onClick={initiatePayment} size="lg" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pay {formatMoney(summary.total, summary.currency)}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar: Order summary */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-zinc-400" />
              <h2 className="font-bold">Order summary</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-zinc-400"><span>Subtotal</span><span>{formatMoney(summary.subtotal, summary.currency)}</span></div>
              {summary.discount > 0 && (
                <div className="flex justify-between text-emerald-400"><span>Discount</span><span>-{formatMoney(summary.discount, summary.currency)}</span></div>
              )}
              <div className="flex justify-between text-zinc-400"><span>Tax</span><span>{formatMoney(summary.tax, summary.currency)}</span></div>
              <div className="border-t border-white/10 pt-3 flex justify-between text-lg font-black"><span>Total</span><span>{formatMoney(summary.total, summary.currency)}</span></div>
            </div>

            {!initialBuyNow && (
              <div className="mt-5">
                <div className="flex gap-2">
                  <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="border-white/10 bg-zinc-950" />
                  <Button variant="outline" disabled={couponLoading} onClick={applyCoupon} className="border-white/10 bg-transparent shrink-0">
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                  </Button>
                </div>
                {couponError && <p className="mt-2 text-xs text-red-400">{couponError}</p>}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <div className="grid gap-3 text-sm text-zinc-400">
              {trustSignals.map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-emerald-300" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
