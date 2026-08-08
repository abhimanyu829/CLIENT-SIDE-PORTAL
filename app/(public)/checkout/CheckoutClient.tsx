"use client"

import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react"
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

const EmailOtpVerifier = lazy(() => import("@/components/checkout/EmailOtpVerifier"))
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
// Keep cold development compilation from aborting a valid server checkout.
const ORDER_CREATE_TIMEOUT_MS = 60_000

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
  // Billing fields
  const [billingEmail, setBillingEmail] = useState("")
  const [billingName, setBillingName] = useState("")
  const [mobile, setMobile] = useState("")
  const [company, setCompany] = useState("")
  const [gstin, setGstin] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [city, setCity] = useState("")
  const [billingState, setBillingState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("IN")
  // Email OTP gate
  const [emailVerified, setEmailVerified] = useState(false)
  const [selectedGateway, setSelectedGateway] = useState<"RAZORPAY" | "PHONEPE" | "PAYTM">("RAZORPAY")
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const checkoutSessionId = useRef(generateCheckoutSessionId())
  const retryCountRef = useRef(0)

  // Manual UPI form state
  const [utrNumber, setUtrNumber] = useState("")
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
          billingAddress: {
            billingEmail,
            billingName,
            mobile,
            company,
            gstin,
            addressLine1,
            city,
            state: billingState,
            postalCode,
            country,
            emailVerified,
          },
          checkoutSessionId: checkoutSessionId.current,
        }),
      })
      clearTimeout(timeout)

      const json = await res.json()

      if (!res.ok || !json.success) {
        const checkoutError = json.error?.message ?? json.error?.code
        if (
          json.error?.code === "ORDER_ALREADY_COMPLETED" ||
          checkoutError === "CART_ALREADY_CHECKED_OUT"
        ) {
          const redirectUrl = json.data?.redirectUrl ?? "/dashboard/my-products"
          setState({ phase: "SUCCESS", redirectUrl })
          router.push(redirectUrl)
          return
        }
        const errorMsg = json.error?.message ?? json.error?.code ?? "Unable to start secure checkout."
        const msg = typeof errorMsg === "string" ? errorMsg : "Unable to start secure checkout. Please try again."
        throw new Error(msg)
      }

      const data = json.data

      if (data?.alreadyCompleted) {
        const redirectUrl = data.redirectUrl ?? "/dashboard/my-products"
        setState({ phase: "SUCCESS", redirectUrl })
        router.push(redirectUrl)
        return
      }

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
      } else if (message.includes("CART_UNAVAILABLE")) {
        userMessage = "This cart is no longer available for checkout. Please refresh your cart and try again."
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
    setState({ phase: "IDLE", step: "payment" })
  }, [])

  // ── Submit UTR ──────────────────────────────────────────────────────────────
  const submitUtr = useCallback(async (orderId: string) => {
    if (!utrNumber || utrNumber.length < 12 || !screenshot) {
      alert("Please provide a valid 12-digit UTR and upload the payment screenshot.")
      return
    }
    setSubmittingUtr(true)
    try {
      const reader = new FileReader()
      reader.readAsDataURL(screenshot)
      const base64Screenshot = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
      })

      const res = await fetch("/api/payments/submit-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, utrNumber, claimedAmount: state.phase === "MANUAL_UPI" ? state.amount : undefined, screenshot: base64Screenshot }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || "Failed to submit verification.")

      setState({ phase: "SUCCESS", redirectUrl: `/checkout/success?orderId=${orderId}` })
      router.push(`/checkout/success?orderId=${orderId}`)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmittingUtr(false)
    }
  }, [utrNumber, screenshot, router, state])

  // ── Derived UI state ────────────────────────────────────────────────────────
  const isLoading = state.phase === "LOADING_CART" || state.phase === "LOADING_SDK" || state.phase === "CREATING_ORDER" || state.phase === "VERIFYING"
  const errorMessage = state.phase === "FAILED" ? state.error : state.phase === "DISMISSED" ? "Payment was not completed. You can retry safely — duplicate orders are prevented." : null
  const canRetry = state.phase === "FAILED" ? state.canRetry : state.phase === "DISMISSED"
  const currentStep = state.phase === "IDLE" ? state.step : state.phase === "LOADING_CART" ? "review" : state.phase === "FAILED" || state.phase === "DISMISSED" ? "payment" : "payment"

  // ── Loading state ────────────────────────────────────────────────────────────
  if (state.phase === "LOADING_CART") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-foreground/70">
        <div className="flex items-center gap-3 bg-muted/60 backdrop-blur-xl border border-border px-6 py-4 rounded-2xl shadow-lg animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          <span className="text-sm font-semibold">Loading secure checkout…</span>
        </div>
      </div>
    )
  }

  // ── Empty cart ──────────────────────────────────────────────────────────────
  if (!initialBuyNow && summary.items.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center px-4">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 shadow-inner">
            <ShoppingCart className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add an AI agent, SaaS plan, API, or service before starting checkout.</p>
          <Button asChild className="mt-6 w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold py-6 shadow-md transition-all">
            <Link href={productSlug ? `/marketplace/${productSlug}` : "/marketplace"}>Return to marketplace</Link>
          </Button>
        </div>
      </div>
    )
  }

  // ── Success redirect (shouldn't render, but just in case) ──────────────────
  if (state.phase === "SUCCESS") {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-emerald-600 dark:text-emerald-400 bg-card border border-border p-8 rounded-3xl shadow-xl">
          <ShieldCheck className="h-10 w-10 animate-bounce" />
          <p className="text-xl font-extrabold text-foreground">Payment Verified!</p>
          <p className="text-sm text-muted-foreground">Redirecting to confirmation…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto bg-white dark:bg-zinc-950 pb-16 text-foreground">
      {/* Top Header Bar */}
      <div className="border-b border-border bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-40 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/marketplace" className="text-sm font-bold text-foreground hover:text-amber-600 transition-colors flex items-center gap-2">
            <span className="brand-gradient text-lg font-black">⬡ ABHIBHIDEVELOPERS</span>
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider hidden sm:inline">• Commerce</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full shadow-xs">
            <LockKeyhole className="h-3.5 w-3.5" />
            <span>256-bit SSL Razorpay Secured</span>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 pb-24 sm:px-6 lg:grid-cols-[1fr_400px]">
        <section className="space-y-6">
          {/* Visual Step Indicator */}
          <div className="rounded-3xl border border-border bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3 text-xs">
              {[
                { id: "review" as const, num: "1", label: "Cart" },
                { id: "billing" as const, num: "2", label: "Billing" },
                { id: "payment" as const, num: "3", label: "Payment" },
                { id: "processing" as const, num: "4", label: "Provision" },
              ].map(({ id, num, label }) => {
                const isActive = currentStep === id || (id === "processing" && isLoading)
                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (!isLoading && id !== "processing") setState({ phase: "IDLE", step: id as "review" | "billing" | "payment" })
                    }}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-2xl px-2 py-2.5 sm:px-4 sm:py-3 font-bold transition-all ${
                      isActive
                        ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className={`h-5 w-5 rounded-full text-[11px] font-black flex items-center justify-center ${isActive ? "bg-white text-amber-600" : "bg-border text-muted-foreground"}`}>
                      {num}
                    </span>
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error / Dismiss banner */}
          {errorMessage && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-600 dark:text-red-300">{errorMessage}</p>
                  {canRetry && (
                    <Button variant="outline" size="sm" onClick={handleRetry} className="mt-3 rounded-xl border-red-500/30 bg-transparent text-red-600 dark:text-red-200 hover:bg-red-500/20">
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Retry Payment
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Phase: Loading SDK */}
          {state.phase === "LOADING_SDK" && (
            <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-amber-600" />
              <h2 className="mt-4 text-xl font-black tracking-tight">Loading Payment Gateway</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Initializing Razorpay Checkout. This should only take a moment…
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground/70">
                If this takes too long, please check your internet connection or disable ad blockers.
              </p>
            </div>
          )}

          {/* Phase: Creating Order */}
          {state.phase === "CREATING_ORDER" && (
            <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-amber-600" />
              <h2 className="mt-4 text-xl font-black tracking-tight">Creating Secure Order</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Validating pricing, inventory, and preparing your checkout session.
              </p>
            </div>
          )}

          {/* Phase: Verifying */}
          {state.phase === "VERIFYING" && (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center shadow-sm">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-600" />
              <h2 className="mt-4 text-xl font-black tracking-tight text-foreground">Verifying Payment</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Confirming your payment signature. This usually takes a few seconds.
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Do not close this page. Webhook will reconcile your payment automatically.
              </p>
            </div>
          )}

          {/* Phase: Payment Pending (Razorpay popup is open) */}
          {state.phase === "REDIRECTING" && (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
              <Loader2 className="h-9 w-9 animate-spin text-amber-600" />
              <div>
                <h2 className="text-xl font-black tracking-tight">Redirecting to Payment Gateway</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Please wait while we transfer you securely. Do not close this window.
                </p>
              </div>
            </div>
          )}

          {state.phase === "PAYMENT_PENDING" && (
            <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm space-y-3">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-amber-600" />
              <h2 className="text-xl font-black tracking-tight">Complete Your Payment</h2>
              <p className="text-sm text-muted-foreground">
                The Razorpay Checkout popup is open. Pay with cards, UPI, QR, wallets, or net banking.
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                Order: <span className="font-bold text-foreground">{state.orderNumber}</span>
              </p>
              <p className="text-xs text-muted-foreground/80 pt-2">
                If the popup doesn't appear, check your browser's popup blocker settings.
              </p>
            </div>
          )}

          {/* Phase: Manual UPI Verification */}
          {state.phase === "MANUAL_UPI" && (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8 shadow-md">
              {/* Gateway Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 mb-3">
                  <WalletCards className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {state.gateway === "PAYTM" ? "Paytm Direct UPI" : "PhonePe Direct UPI"}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">Scan & Pay</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open your <strong className="text-foreground">{state.gateway === "PAYTM" ? "Paytm" : "PhonePe"}</strong> app and scan the QR code below to complete your payment.
                </p>
              </div>

              {/* QR Code */}
              <div className="mx-auto overflow-hidden rounded-2xl bg-white p-4 shadow-xl border border-emerald-500/20" style={{ width: "fit-content" }}>
                <img src={state.qrDataUrl} alt="UPI QR Code" className="h-56 w-56 object-contain" />
              </div>

              {/* UPI Handle & Order Info */}
              <div className="mt-5 text-center space-y-1.5">
                <p className="text-sm font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                  UPI ID: {state.upiId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pay exactly <span className="font-bold text-foreground">{formatMoney(state.amount, "INR")}</span> • Order <span className="font-mono font-bold text-foreground">{state.orderNumber}</span>
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Add <span className="font-mono font-semibold text-foreground">{state.orderNumber}</span> as the payment note/description for faster verification.
                </p>
              </div>

              {/* Divider */}
              <div className="my-6 border-t border-emerald-500/20" />

              {/* UTR Submission */}
              <div className="space-y-4 max-w-sm mx-auto">
                <h3 className="text-sm font-extrabold text-foreground">Submit Payment Proof</h3>
                <p className="text-xs text-muted-foreground">
                  After completing the payment, enter the <strong className="text-foreground">12-digit UTR</strong> (transaction reference number) from your UPI app and upload a screenshot as proof.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">UTR / Transaction Reference Number</label>
                  <Input
                    placeholder="e.g. 312345678901"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    maxLength={12}
                    className="rounded-xl border-border bg-card font-mono text-base tracking-widest text-foreground focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {utrNumber.length > 0 && utrNumber.length < 12 && (
                    <p className="text-xs text-amber-600 font-semibold">{12 - utrNumber.length} more digits needed</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Payment Screenshot</label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-xl border-border bg-card w-full justify-start font-medium text-foreground hover:bg-muted"
                      onClick={() => document.getElementById("screenshot-upload")?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4 text-emerald-600" />
                      <span className="truncate">{screenshot ? screenshot.name : "Upload screenshot"}</span>
                    </Button>
                    <input
                      id="screenshot-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    />
                  </div>
                  {screenshot && (
                    <p className="text-xs text-emerald-600 font-bold">✓ Screenshot ready to submit</p>
                  )}
                </div>

                <Button
                  className="w-full mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-6 shadow-md"
                  disabled={submittingUtr || utrNumber.length < 12 || !screenshot}
                  onClick={() => submitUtr(state.orderId)}
                >
                  {submittingUtr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {submittingUtr ? "Submitting for verification..." : "Submit Payment Proof"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Your order will be activated within minutes after an admin verifies your payment.
                </p>
              </div>
            </div>
          )}

          {/* Phase: Dismissed */}
          {state.phase === "DISMISSED" && (
            <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 text-center shadow-sm">
              <X className="mx-auto h-9 w-9 text-amber-600" />
              <h2 className="mt-3 text-xl font-black text-foreground">Payment Not Completed</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You closed the payment popup. Your order <span className="font-mono font-bold text-foreground">{state.orderNumber}</span> is still pending — no duplicate charges will be made.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setState({ phase: "IDLE", step: "payment" })} className="rounded-xl border-border bg-card hover:bg-muted font-bold">
                  Back to Payment
                </Button>
                <Button onClick={handleRetry} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Payment
                </Button>
              </div>
            </div>
          )}

          {/* Phase: Failed */}
          {state.phase === "FAILED" && (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center shadow-sm">
              <AlertTriangle className="mx-auto h-9 w-9 text-red-500" />
              <h2 className="mt-3 text-xl font-black text-red-600 dark:text-red-300">Payment Failed</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your payment could not be processed. Your cart and order details are preserved.
              </p>
              {state.orderId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Order reference: <span className="font-mono font-bold text-foreground">{state.orderId.slice(0, 12)}</span>
                </p>
              )}
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setState({ phase: "IDLE", step: "payment" })} className="rounded-xl border-border bg-card hover:bg-muted font-bold">
                  Back to Payment
                </Button>
                {state.canRetry && (
                  <Button onClick={handleRetry} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Payment
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Review */}
          {(state.phase === "IDLE" && state.step === "review") && (
            <div className="rounded-3xl border border-border bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight">Review Order</h1>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Validated pricing, tax, subscription and AI quota snapshots.</p>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-3 py-1 rounded-full">
                  Live Cart
                </Badge>
              </div>

              <div className="space-y-4">
                {summary.items.map((item) => (
                  <div key={item.id} className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 sm:grid-cols-[64px_1fr_auto] items-center">
                    <div className="h-16 w-16 overflow-hidden rounded-xl bg-card border border-border shrink-0">
                      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><ShoppingCart className="h-6 w-6" /></div>}
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">{item.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-md bg-card border border-border font-medium text-foreground">
                          {item.tier} {intervalLabels[item.interval] ?? ""}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{item.type.replaceAll("_", " ")}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pt-0.5">Qty {item.quantity} • Instant provisioning after verified webhook</p>
                    </div>
                    <p className="text-base font-extrabold text-foreground sm:text-right">{formatMoney(item.price * item.quantity, summary.currency)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end border-t border-border pt-5">
                <Button onClick={() => setState({ phase: "IDLE", step: "billing" })} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-8 py-6 shadow-md">
                  Continue to Billing →
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Billing */}
          {(state.phase === "IDLE" && state.step === "billing") && (
            <div className="rounded-3xl border border-border bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-border pb-5">
                <h2 className="text-2xl font-extrabold tracking-tight">Billing Details</h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Used for invoices, tax records, and subscription renewal notices.</p>
              </div>

              {/* Contact Information */}
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name <span className="text-red-500">*</span></span>
                  <Input
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    placeholder="Jane Smith"
                    className="rounded-xl border-border bg-white dark:bg-zinc-800 text-sm font-medium text-foreground focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Billing Email <span className="text-red-500">*</span></span>
                  <Input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="billing@company.com"
                    className="rounded-xl border-border bg-white dark:bg-zinc-800 text-sm font-medium text-foreground focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Company <span className="text-xs font-normal text-muted-foreground">(optional)</span></span>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className="rounded-xl border-border bg-white dark:bg-zinc-800 text-sm font-medium text-foreground focus:ring-2 focus:ring-amber-500/30" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">GSTIN / Tax ID <span className="text-xs font-normal text-muted-foreground">(optional)</span></span>
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" className="rounded-xl border-border bg-white dark:bg-zinc-800 text-sm font-mono text-foreground focus:ring-2 focus:ring-amber-500/30" />
                </label>
              </div>

              {/* Address Fields */}
              <div className="pt-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Billing Address</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">Street / Flat / Building <span className="text-red-500">*</span></span>
                    <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="123 Main St, Suite 4" className="rounded-xl border-border bg-white dark:bg-zinc-800 text-sm font-medium text-foreground focus:ring-2 focus:ring-amber-500/30" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">City <span className="text-red-500">*</span></span>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" className="rounded-xl border-border bg-white dark:bg-zinc-800 text-sm font-medium text-foreground focus:ring-2 focus:ring-amber-500/30" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">State / Province <span className="text-red-500">*</span></span>
                    <Input value={billingState} onChange={(e) => setBillingState(e.target.value)} placeholder="Maharashtra" className="rounded-xl border-border bg-white dark:bg-zinc-800 text-sm font-medium text-foreground focus:ring-2 focus:ring-amber-500/30" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Postal Code <span className="text-red-500">*</span></span>
                    <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="400001" className="rounded-xl border-border bg-white dark:bg-zinc-800 text-sm font-medium text-foreground focus:ring-2 focus:ring-amber-500/30" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Country</span>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-xl border border-border bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    >
                      <option value="IN">India</option>
                      <option value="US">United States</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="CA">Canada</option>
                      <option value="SG">Singapore</option>
                      <option value="AE">UAE</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Email OTP Verification Box */}
              <div className="pt-2">
                <Suspense fallback={
                  <div className="rounded-2xl border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">Loading verifier…</div>
                }>
                  <EmailOtpVerifier
                    email={billingEmail}
                    customerName={billingName || undefined}
                    checkoutSessionId={checkoutSessionId.current}
                    onVerified={() => setEmailVerified(true)}
                    onReset={() => setEmailVerified(false)}
                  />
                </Suspense>
              </div>

              <div className="flex justify-between pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setState({ phase: "IDLE", step: "review" })} className="rounded-xl border-border bg-card hover:bg-muted font-bold">
                  Back
                </Button>
                <Button
                  onClick={() => setState({ phase: "IDLE", step: "payment" })}
                  disabled={!billingName.trim() || !billingEmail.trim() || !addressLine1.trim() || !city.trim() || !billingState.trim() || !postalCode.trim() || !emailVerified}
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-8 py-6 shadow-md"
                >
                  Continue to Payment →
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {(state.phase === "IDLE" && state.step === "payment") && (
            <div className="rounded-3xl border border-border bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-border pb-5">
                <h2 className="text-2xl font-extrabold tracking-tight">Secure Payment</h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Choose your payment method. Paytm and PhonePe use Direct UPI — scan a QR code and submit the UTR reference for instant admin verification.
                </p>
              </div>

              {/* Gateway Cards */}
              <div className="space-y-4">
                <div 
                  className={`cursor-pointer rounded-2xl border p-5 transition-all ${selectedGateway === "RAZORPAY" ? "border-amber-500 bg-amber-500/5 shadow-sm ring-1 ring-amber-500/20" : "border-border bg-card hover:border-border/80 hover:bg-muted/30"}`}
                  onClick={() => setSelectedGateway("RAZORPAY")}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selectedGateway === "RAZORPAY" ? "border-amber-600 bg-amber-600 text-white" : "border-muted-foreground/30"}`}>
                      {selectedGateway === "RAZORPAY" && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-foreground text-base">Razorpay Standard Checkout</p>
                        <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Instant Activation</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Cards, UPI, Net Banking, Wallets, and EMI.</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`cursor-pointer rounded-2xl border p-5 transition-all ${selectedGateway === "PHONEPE" ? "border-indigo-500 bg-indigo-500/5 shadow-sm ring-1 ring-indigo-500/20" : "border-border bg-card hover:border-border/80 hover:bg-muted/30"}`}
                  onClick={() => setSelectedGateway("PHONEPE")}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selectedGateway === "PHONEPE" ? "border-indigo-600 bg-indigo-600 text-white" : "border-muted-foreground/30"}`}>
                      {selectedGateway === "PHONEPE" && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-foreground text-base">PhonePe (Direct UPI)</p>
                        <Badge variant="outline" className="text-xs font-semibold">UTR Verification</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Scan QR code via PhonePe • Instant UTR submission.</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`cursor-pointer rounded-2xl border p-5 transition-all ${selectedGateway === "PAYTM" ? "border-sky-500 bg-sky-500/5 shadow-sm ring-1 ring-sky-500/20" : "border-border bg-card hover:border-border/80 hover:bg-muted/30"}`}
                  onClick={() => setSelectedGateway("PAYTM")}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selectedGateway === "PAYTM" ? "border-sky-600 bg-sky-600 text-white" : "border-muted-foreground/30"}`}>
                      {selectedGateway === "PAYTM" && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-foreground text-base">Paytm (Direct UPI)</p>
                        <Badge variant="outline" className="text-xs font-semibold">UTR Verification</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Scan QR code via Paytm • Instant UTR submission.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setState({ phase: "IDLE", step: "billing" })} className="rounded-xl border-border bg-card hover:bg-muted font-bold">
                  Back
                </Button>
                <Button onClick={initiatePayment} size="lg" className="rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold px-8 py-6 shadow-md gap-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Pay {formatMoney(summary.total, summary.currency)}</span>
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar: Order Summary & Trust Signals */}
        <aside className="space-y-6">
          <div className="rounded-3xl border border-border bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <FileText className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-extrabold tracking-tight">Order Summary</h2>
            </div>
            
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">{formatMoney(summary.subtotal, summary.currency)}</span>
              </div>
              {summary.discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-semibold">-{formatMoney(summary.discount, summary.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Estimated Tax</span>
                <span className="font-semibold text-foreground">{formatMoney(summary.tax, summary.currency)}</span>
              </div>
              <div className="border-t border-border pt-4 flex justify-between items-baseline">
                <span className="text-base font-extrabold text-foreground">Total</span>
                <span className="text-2xl font-black text-foreground bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 bg-clip-text text-transparent">
                  {formatMoney(summary.total, summary.currency)}
                </span>
              </div>
            </div>

            {!initialBuyNow && (
              <div className="pt-2">
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="rounded-xl border-border bg-white dark:bg-zinc-800 font-mono uppercase tracking-wider text-sm focus:ring-2 focus:ring-amber-500/30"
                  />
                  <Button variant="outline" disabled={couponLoading} onClick={applyCoupon} className="rounded-xl border-border hover:bg-muted font-bold shrink-0 px-4">
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                  </Button>
                </div>
                {couponError && <p className="mt-2 text-xs font-semibold text-red-500">{couponError}</p>}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <div className="grid gap-3.5 text-xs text-muted-foreground font-medium">
              {trustSignals.map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
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
