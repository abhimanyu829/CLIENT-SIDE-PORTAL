import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { handleSubscriptionWebhook } from "@/lib/services/razorpay-subscription-webhook"
import { RazorpayBillingError, subscriptionWebhookSecret } from "@/lib/services/razorpay-billing"

/**
 * POST /api/webhooks/razorpay/subscriptions
 *
 * Dedicated endpoint for verified Razorpay recurring SUBSCRIPTION events.
 * The existing one-time payment webhook route (
 * /api/payments/razorpay/webhook) is intentionally untouched.
 *
 * Safety:
 *  - raw body bytes are verified with HMAC-SHA256 before ANY parsing
 *  - unconfigured secret → 503 (fail closed, never accept unsigned events)
 *  - invalid/missing signature → 400
 *  - processing failure before durable acceptance → 500 (provider retries)
 *  - duplicates are idempotent (200)
 */
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-razorpay-signature") ?? ""

  const secret = subscriptionWebhookSecret()
  if (!secret) {
    logger.error("RAZORPAY_SUBSCRIPTIONS_WEBHOOK_SECRET not configured — refusing subscription webhook")
    return NextResponse.json({ received: false, error: "webhook not configured" }, { status: 503 })
  }

  try {
    const result = await handleSubscriptionWebhook(rawBody, signature, secret)
    return NextResponse.json({ ...result, received: true })
  } catch (err) {
    if (err instanceof RazorpayBillingError) {
      const status =
        err.code === "WEBHOOK_SIGNATURE_INVALID" || err.code === "WEBHOOK_PAYLOAD_INVALID" ? 400 : 500
      logger.warn({ code: err.code, status }, "razorpay subscription webhook rejected")
      if (err.code === "WEBHOOK_SIGNATURE_INVALID") {
        return NextResponse.json({ received: false, error: "invalid signature" }, { status })
      }
      if (err.code === "WEBHOOK_PAYLOAD_INVALID") {
        return NextResponse.json({ received: false, error: "invalid payload" }, { status })
      }
    }
    logger.error({ err }, "razorpay subscription webhook processing failed (retryable)")
    return NextResponse.json({ received: false, error: "processing failed" }, { status: 500 })
  }
}
