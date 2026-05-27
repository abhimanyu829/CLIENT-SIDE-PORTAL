"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
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
  WalletCards,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

declare global {
  interface Window {
    Razorpay?: any
  }
}

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

type CheckoutStep = "review" | "billing" | "payment" | "processing" | "success" | "failed"

export default function CheckoutClient({
  initialBuyNow,
  productSlug,
}: {
  initialBuyNow: InitialBuyNow
  productSlug?: string
}) {
  const router = useRouter()
  const [cart, setCart] = useState<Cart | null>(null)
  const [step, setStep] = useState<CheckoutStep>("review")
  const [couponCode, setCouponCode] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [company, setCompany] = useState("")
  const [gstin, setGstin] = useState("")
  const [loading, setLoading] = useState(!initialBuyNow)
  const [couponLoading, setCouponLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Load cart if not buy-now
  useEffect(() => {
    if (initialBuyNow) return
    let mounted = true
    fetch("/api/cart")
      .then((res) => res.json())
      .then((json) => {
        if (mounted) setCart(json.data)
      })
      .catch(() => setError("Unable to load your cart. Please refresh and try again."))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [initialBuyNow])

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

  const applyCoupon = async () => {
    if (!couponCode.trim() || initialBuyNow) return
    setCouponLoading(true)
    setError(null)
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
      setError((err as Error).message)
    } finally {
      setCouponLoading(false)
    }
  }

  // ── Core: Create Razorpay order then open Standard Checkout ────────────────
  // Razorpay Standard Checkout natively supports UPI, QR, cards, wallets,
  // net banking, and EMI. No manual QR generation or payment links needed.
  const initiatePayment = async () => {
    setStep("processing")
    setError(null)

    try {
      // 1. Create order on our backend
      console.log("[CHECKOUT] Creating Razorpay order...")
      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: initialBuyNow ? "buy_now" : "cart",
          productId: initialBuyNow?.productId,
          tierId: initialBuyNow?.tierId,
          couponCode: couponCode || cart?.couponCode || undefined,
          billingAddress: { billingEmail, company, gstin },
        }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        const errorMsg = json.error?.message ?? json.error?.code ?? "Unable to start secure checkout."
        throw new Error(typeof errorMsg === "string" ? errorMsg : "Unable to start secure checkout. Please try again.")
      }

      const data = json.data
      if (!data?.razorpayOrder?.id) {
        throw new Error("No Razorpay order ID received. Please try again.")
      }

      console.log(`[CHECKOUT] ✅ Order created: ${data.order.orderNumber}, Razorpay ID: ${data.razorpayOrder.id}`)

      // 2. Load Razorpay Checkout script
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        throw new Error("Razorpay Checkout could not be loaded. Please check your internet connection and try again.")
      }

      // 3. Open Razorpay Standard Checkout
      // This popup handles ALL payment methods: UPI, QR, cards, wallets, net banking, EMI
      console.log(`[CHECKOUT] Opening Razorpay Standard Checkout for order: ${data.order.orderNumber}`)

      const rzpOptions: any = {
        key: data.keyId,
        amount: data.razorpayOrder.amount,
        currency: data.razorpayOrder.currency,
        name: "NexusAI",
        description: `Order ${data.order.orderNumber}`,
        order_id: data.razorpayOrder.id,
        prefill: {
          email: billingEmail || undefined,
          name: undefined,
        },
        notes: {
          orderId: data.order.id,
        },
        theme: {
          color: "#111827",
        },
        modal: {
          ondismiss: () => {
            console.log("[CHECKOUT] Razorpay modal dismissed by user")
            setStep("payment")
            setError("Payment was not completed. You can retry safely — duplicate orders are prevented.")
          },
        },
        handler: async (response: any) => {
          // Razorpay calls this on successful payment
          try {
            console.log("[CHECKOUT] Payment captured, verifying signature...")
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

            if (!verify.ok || !verified.success) {
              console.error("[CHECKOUT] ❌ Payment verification failed:", verified.error)
              // Payment went through but verification failed — still redirect, webhook will reconcile
              setStep("payment")
              setError(`Payment was processed but verification is pending. Your order ${data.order.orderNumber} is being confirmed. You'll receive a confirmation shortly.`)
              return
            }

            console.log("[CHECKOUT] ✅ Payment verified, redirecting to success page")
            router.push(verified.data.redirectUrl)
          } catch (verifyError) {
            console.error("[CHECKOUT] ❌ Verification request error:", verifyError)
            // Network error during verification — redirect to success page anyway
            // The webhook will reconcile the payment state
            setStep("payment")
            setError(`Payment was processed but we couldn't confirm it immediately. Your order ${data.order.orderNumber} is being verified. Please check your dashboard.`)
          }
        },
      }

      const rzp = new window.Razorpay!(rzpOptions)

      rzp.on("payment.failed", (response: any) => {
        console.error("[CHECKOUT] ❌ Razorpay payment.failed:", response.error)
        setStep("failed")
        setError(`Payment failed: ${response.error?.description ?? "Unknown error"}. Please try a different payment method.`)
      })

      rzp.open()
    } catch (err) {
      console.error("[CHECKOUT] ❌ Checkout flow error:", err)
      const message = (err as Error).message

      // Map backend error codes to user-friendly messages
      if (message.includes("UNAUTHORIZED") || message.includes("sign in")) {
        setError("Please sign in to continue checkout.")
      } else if (message.includes("ACCOUNT_RESTRICTED") || message.includes("Verify your email")) {
        setError("Please verify your email before checkout.")
      } else if (message.includes("EMPTY_CART")) {
        setError("Your cart is empty. Add items before checking out.")
      } else if (message.includes("RAZORPAY_NOT_CONFIGURED") || message.includes("Payment gateway")) {
        setError("Payment gateway is temporarily unavailable. Please try again later.")
      } else if (message.includes("PRODUCT_NOT_FOUND") || message.includes("TIER_NOT_FOUND")) {
        setError("This product is no longer available. Please refresh and try again.")
      } else if (message.includes("PRODUCT_UNAVAILABLE")) {
        setError("This product is not available for purchase at this time.")
      } else if (message.includes("ZERO_TOTAL")) {
        setError("This checkout has no payable amount.")
      } else if (message.includes("could not be loaded")) {
        setError(message)
      } else {
        setError(message)
      }

      setStep("payment")
    }
  }

  const handleRetry = () => {
    setRetryCount((c) => c + 1)
    setError(null)
    setStep("payment")
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && !cart && !initialBuyNow) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading secure checkout
        </div>
      </div>
    )
  }

  // ── Empty cart state ───────────────────────────────────────────────────────
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
                { id: "review" as CheckoutStep, label: "Cart" },
                { id: "billing" as CheckoutStep, label: "Billing" },
                { id: "payment" as CheckoutStep, label: "Payment" },
                { id: "processing" as CheckoutStep, label: "Provision" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setStep(id)}
                  className={`rounded-md px-3 py-2 font-semibold transition-colors ${
                    step === id ? "bg-white text-zinc-950" : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-200">{error}</p>
              {(step === "payment" || step === "failed") && (
                <Button variant="outline" size="sm" onClick={handleRetry} className="mt-3 border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/20">
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry payment
                </Button>
              )}
            </div>
          )}

          {/* Step: Review */}
          {step === "review" && (
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
                <Button onClick={() => setStep("billing")}>Continue</Button>
              </div>
            </div>
          )}

          {/* Step: Billing */}
          {step === "billing" && (
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
                <Button variant="outline" onClick={() => setStep("review")} className="border-white/10 bg-transparent">Back</Button>
                <Button onClick={() => setStep("payment")}>Continue to payment</Button>
              </div>
            </div>
          )}

          {/* Step: Payment — Razorpay Standard Checkout */}
          {step === "payment" && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-xl font-bold">Secure payment</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Click Pay Now to open Razorpay Checkout. It supports cards, UPI, QR, net banking, wallets, and EMI — all in one popup.
              </p>

              <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div className="text-sm text-zinc-300">
                    <p className="font-semibold text-white">Razorpay Standard Checkout</p>
                    <p className="mt-1 text-zinc-400">
                      All payment methods are handled securely by Razorpay. Your card details never touch our servers.
                      UPI, QR, wallets, net banking, and EMI are all available inside the checkout popup.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-between">
                <Button variant="outline" onClick={() => setStep("billing")} className="border-white/10 bg-transparent">Back</Button>
                <Button disabled={loading} onClick={initiatePayment} size="lg" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pay {formatMoney(summary.total, summary.currency)}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Processing */}
          {step === "processing" && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
              <h2 className="mt-4 text-xl font-bold">Opening secure checkout</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Razorpay Checkout is loading. You can pay with cards, UPI, QR, wallets, or net banking.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                If the popup doesn't appear, check your browser's popup blocker settings.
              </p>
            </div>
          )}

          {/* Step: Failed */}
          {step === "failed" && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center">
              <h2 className="text-xl font-bold text-red-300">Payment failed</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Your payment could not be processed. Your cart and order details are preserved.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Button variant="outline" onClick={() => setStep("payment")} className="border-white/10 bg-transparent">Back to payment</Button>
                <Button onClick={handleRetry}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry payment
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
              <div className="flex justify-between text-zinc-400"><span>Discount</span><span>-{formatMoney(summary.discount, summary.currency)}</span></div>
              <div className="flex justify-between text-zinc-400"><span>Tax</span><span>{formatMoney(summary.tax, summary.currency)}</span></div>
              <div className="border-t border-white/10 pt-3 flex justify-between text-lg font-black"><span>Total</span><span>{formatMoney(summary.total, summary.currency)}</span></div>
            </div>

            {!initialBuyNow && (
              <div className="mt-5 flex gap-2">
                <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="border-white/10 bg-zinc-950" />
                <Button variant="outline" disabled={couponLoading} onClick={applyCoupon} className="border-white/10 bg-transparent">
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                </Button>
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