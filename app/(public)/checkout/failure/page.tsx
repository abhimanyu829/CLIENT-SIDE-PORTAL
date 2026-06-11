"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, CreditCard, RefreshCw, ShoppingBag, Wifi, WifiOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const ERROR_MESSAGES: Record<string, { title: string; description: string; icon: typeof AlertTriangle }> = {
  PAYMENT_FAILED: {
    title: "Payment failed",
    description: "The payment could not be processed. Your bank may have declined the transaction, or there may be insufficient funds.",
    icon: AlertTriangle,
  },
  PAYMENT_CANCELLED: {
    title: "Payment cancelled",
    description: "You cancelled the payment. No charges were made — you can retry safely.",
    icon: X,
  },
  PAYMENT_DISMISSED: {
    title: "Payment not completed",
    description: "You closed the payment popup. No charges were made — you can retry safely.",
    icon: X,
  },
  VERIFICATION_FAILED: {
    title: "Verification pending",
    description: "Your payment was processed but verification is still pending. We're confirming your order — check your dashboard shortly.",
    icon: RefreshCw,
  },
  NETWORK_ERROR: {
    title: "Connection issue",
    description: "A network error occurred during checkout. Please check your internet connection and try again.",
    icon: WifiOff,
  },
  GATEWAY_ERROR: {
    title: "Payment gateway issue",
    description: "The payment gateway is temporarily unavailable. Please try again in a few minutes.",
    icon: Wifi,
  },
  SOLD_OUT: {
    title: "Product sold out",
    description: "This product is no longer available for purchase. Please check back later or browse other products.",
    icon: AlertTriangle,
  },
  SESSION_EXPIRED: {
    title: "Session expired",
    description: "Your checkout session has expired. Please start a new checkout.",
    icon: AlertTriangle,
  },
}

function FailureContent() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get("error") ?? "PAYMENT_FAILED"
  const errorMessage = searchParams.get("message") ?? ""
  const orderId = searchParams.get("orderId") ?? ""
  const productSlug = searchParams.get("productSlug") ?? ""

  const errorInfo = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.PAYMENT_FAILED
  const Icon = errorInfo.icon
  const canRetry = !["SOLD_OUT", "SESSION_EXPIRED"].includes(errorCode)

  const retryHref = productSlug ? `/marketplace/${productSlug}` : "/checkout"

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
          <Icon className="mb-4 h-10 w-10 text-red-300" />
          <h1 className="text-3xl font-black">{errorInfo.title}</h1>
          <p className="mt-2 text-zinc-300">{errorInfo.description}</p>
          {errorMessage && (
            <p className="mt-2 text-sm text-red-300/80 bg-red-500/10 rounded-md px-3 py-2 border border-red-500/20">
              {errorMessage}
            </p>
          )}
          {orderId && (
            <p className="mt-2 text-xs text-zinc-500">
              Order reference: <span className="font-mono text-zinc-400">{orderId.slice(0, 16)}</span>
            </p>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-bold mb-3">What you can do</h2>
          <ul className="space-y-3 text-sm text-zinc-400">
            {canRetry && (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">1.</span>
                  Retry with the same or a different payment method (card, UPI, netbanking, wallet).
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">2.</span>
                  Check your card details, UPI app, or bank account for any issues.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">3.</span>
                  Contact your bank if the amount was debited but not confirmed.
                </li>
              </>
            )}
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">{canRetry ? "4" : "1"}.</span>
              Reach out to our support team for assistance.
            </li>
          </ul>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {canRetry && (
            <Button asChild>
              <Link href={retryHref}>
                <CreditCard className="mr-2 h-4 w-4" />
                Try again
              </Link>
            </Button>
          )}
          <Button asChild variant={canRetry ? "outline" : "default"} className={!canRetry ? "" : "border-white/10 bg-transparent"}>
            <Link href="/marketplace">
              <ShoppingBag className="mr-2 h-4 w-4" />
              Browse marketplace
            </Link>
          </Button>
          {orderId && (
            <Button asChild variant="outline" className="border-white/10 bg-transparent">
              <Link href="/dashboard/subscriptions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                View orders
              </Link>
            </Button>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Need help?{" "}
          <Link href="/contact-sales" className="text-indigo-400 hover:underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function CheckoutFailurePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <AlertTriangle className="h-5 w-5" />
          Loading...
        </div>
      </div>
    }>
      <FailureContent />
    </Suspense>
  )
}