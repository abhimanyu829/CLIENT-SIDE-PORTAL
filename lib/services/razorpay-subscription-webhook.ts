/**
 * lib/services/razorpay-subscription-webhook.ts
 *
 * Phase 4 — Verified, durable, idempotent processing of Razorpay SUBSCRIPTION
 * webhook events. Handles billing lifecycle ONLY (no entitlement granting —
 * that is Phase 5).
 *
 * Flow per event:
 *   raw body → signature verify → schema validate → durable dedupe →
 *   persist PENDING → guarded state transition / charge record → emit
 *   internal domain event → mark PROCESSED.
 *
 * Failures before durable acceptance are rethrown (provider retries). A
 * re-delivered accepted event is a no-op (idempotent). Out-of-order events
 * cannot overwrite newer internal state (CAS + transition guards).
 */

import crypto from "crypto"
import { WebhookStatus } from "@prisma/client"
import { z } from "zod"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import {
  RazorpayBillingError,
  applyProviderStatus,
  audit,
  invalidateAdminBillingCaches,
  mapProviderStatus,
} from "@/lib/services/razorpay-billing"

// ── Signature verification (raw body, constant-time) ─────────────────────────

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!rawBody || !signature || !secret) return false
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))
  } catch {
    return false
  }
}

// ── Payload schema (minimal, strict) ──────────────────────────────────────────

const eventSchema = z.object({
  entity: z.literal("event"),
  id: z.string().min(1),
  event: z.string().min(1),
  contains: z.array(z.string()).optional(),
  created_at: z.number().optional(),
  payload: z.object({
    subscription: z.object({
      entity: z
        .object({
          id: z.string().min(1),
          status: z.string().min(1).optional(),
          current_start: z.number().nullable().optional(),
          current_end: z.number().nullable().optional(),
          plan_id: z.string().optional(),
          amount: z.number().optional(),
          currency: z.string().optional(),
        })
        .passthrough(),
    }),
    payment: z
      .object({
        entity: z
          .object({
            id: z.string().min(1).optional(),
            status: z.string().optional(),
            amount: z.number().optional(),
            currency: z.string().optional(),
            invoice_id: z.string().optional(),
          })
          .passthrough(),
      })
      .optional(),
  }),
})

export type SubscriptionWebhookEvent = z.infer<typeof eventSchema>

const SUPPORTED_EVENTS = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.completed",
  "subscription.updated",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.paused",
  "subscription.resumed",
])

// ── Charge recording (idempotent) ─────────────────────────────────────────────

async function recordCharge(subscriptionId: string, razorpaySubscriptionId: string, event: SubscriptionWebhookEvent, providerEventId: string): Promise<"created" | "skipped"> {
  const payment = event.payload.payment?.entity
  if (!payment?.id) return "skipped"

  const existing = await db.subscriptionCharge.findUnique({ where: { razorpayPaymentId: payment.id } })
  if (existing) return "skipped" // idempotent — never duplicate a charge

  const amountSubunits = payment.amount ?? 0
  const chargeStatus =
    payment.status === "captured"
      ? "SUCCEEDED"
      : payment.status === "failed"
        ? "FAILED"
        : "PENDING"

  await db.subscriptionCharge.create({
    data: {
      subscriptionId,
      razorpaySubscriptionId,
      razorpayPaymentId: payment.id,
      razorpayInvoiceId: payment.invoice_id ?? null,
      amountSubunits,
      currency: payment.currency ?? "INR",
      chargeStatus: chargeStatus as never,
      providerEventId,
      ...(event.payload.subscription.entity.current_start
        ? { billingPeriodStart: new Date(event.payload.subscription.entity.current_start * 1000) }
        : {}),
      ...(event.payload.subscription.entity.current_end
        ? { billingPeriodEnd: new Date(event.payload.subscription.entity.current_end * 1000) }
        : {}),
      metadata: { providerEvent: event.event, capturedAt: event.created_at ?? null },
    },
  })

  await emitEvent({
    type: chargeStatus === "SUCCEEDED" ? EVENTS.SUBSCRIPTION_CHARGE_SUCCEEDED : chargeStatus === "FAILED" ? EVENTS.SUBSCRIPTION_CHARGE_FAILED : EVENTS.SUBSCRIPTION_STATE_CHANGED,
    timestamp: new Date().toISOString(),
    actorId: "razorpay",
    payload: { subscriptionId, razorpayPaymentId: payment.id, amountSubunits },
  })
  return "created"
}

// ── Process one verified event ────────────────────────────────────────────────

async function processEvent(event: SubscriptionWebhookEvent): Promise<void> {
  if (!SUPPORTED_EVENTS.has(event.event)) {
    throw new RazorpayBillingError("WEBHOOK_PAYLOAD_INVALID", `Unsupported subscription event: ${event.event}`)
  }

  const razorpaySubscriptionId = event.payload.subscription.entity.id
  const internal = await db.userSubscription.findUnique({
    where: { razorpaySubscriptionId },
    select: { id: true, status: true, planVersionId: true },
  })
  if (!internal) {
    // Out-of-band event (created before our record or test noise): durable
    // acceptance without mutation — never fabricate a subscription.
    logger.warn({ razorpaySubscriptionId, event: event.event }, "subscription webhook received for unknown internal record")
    return
  }
  const subscriptionId = internal.id

  switch (event.event) {
    case "subscription.authenticated":
    case "subscription.created":
      // Checkout completed; billing not yet active. No status change.
      break
    case "subscription.activated": {
      await applyProviderStatus(subscriptionId, "active", {
        periodStart: event.payload.subscription.entity.current_start,
        periodEnd: event.payload.subscription.entity.current_end,
      })
      await emitEvent({ type: EVENTS.SUBSCRIPTION_ACTIVATED, timestamp: new Date().toISOString(), actorId: "razorpay", payload: { subscriptionId, razorpaySubscriptionId } })
      break
    }
    case "subscription.charged": {
      await recordCharge(subscriptionId, razorpaySubscriptionId, event, event.id)
      await applyProviderStatus(subscriptionId, event.payload.subscription.entity.status ?? "active", {
        periodStart: event.payload.subscription.entity.current_start,
        periodEnd: event.payload.subscription.entity.current_end,
      })
      break
    }
    case "subscription.pending": {
      await recordCharge(subscriptionId, razorpaySubscriptionId, event, event.id)
      await applyProviderStatus(subscriptionId, "pending", { periodStart: null, periodEnd: null })
      break
    }
    case "subscription.halted": {
      await applyProviderStatus(subscriptionId, "halted", { periodStart: null, periodEnd: null })
      await emitEvent({ type: EVENTS.SUBSCRIPTION_HALTED, timestamp: new Date().toISOString(), actorId: "razorpay", payload: { subscriptionId, razorpaySubscriptionId } })
      break
    }
    case "subscription.cancelled": {
      await applyProviderStatus(subscriptionId, "cancelled", { periodStart: null, periodEnd: null })
      await emitEvent({ type: EVENTS.SUBSCRIPTION_CANCELLED, timestamp: new Date().toISOString(), actorId: "razorpay", payload: { subscriptionId, razorpaySubscriptionId } })
      break
    }
    case "subscription.paused": {
      await applyProviderStatus(subscriptionId, "paused", { periodStart: event.payload.subscription.entity.current_start, periodEnd: null })
      await emitEvent({ type: EVENTS.SUBSCRIPTION_PAUSED, timestamp: new Date().toISOString(), actorId: "razorpay", payload: { subscriptionId, razorpaySubscriptionId } })
      break
    }
    case "subscription.resumed": {
      await applyProviderStatus(subscriptionId, "active", {
        periodStart: event.payload.subscription.entity.current_start,
        periodEnd: event.payload.subscription.entity.current_end,
      })
      await emitEvent({ type: EVENTS.SUBSCRIPTION_REACTIVATED, timestamp: new Date().toISOString(), actorId: "razorpay", payload: { subscriptionId, razorpaySubscriptionId } })
      break
    }
    case "subscription.completed": {
      await applyProviderStatus(subscriptionId, "completed", { periodStart: null, periodEnd: null })
      await emitEvent({ type: EVENTS.SUBSCRIPTION_STATE_CHANGED, timestamp: new Date().toISOString(), actorId: "razorpay", payload: { subscriptionId, razorpaySubscriptionId, status: "completed" } })
      break
    }
    case "subscription.updated": {
      const providerStatus = event.payload.subscription.entity.status
      if (providerStatus) {
        await applyProviderStatus(subscriptionId, providerStatus, {
          periodStart: event.payload.subscription.entity.current_start,
          periodEnd: event.payload.subscription.entity.current_end,
        })
      }
      await emitEvent({ type: EVENTS.SUBSCRIPTION_STATE_CHANGED, timestamp: new Date().toISOString(), actorId: "razorpay", payload: { subscriptionId, razorpaySubscriptionId, status: providerStatus } })
      break
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export interface WebhookResult {
  received: boolean
  eventId: string
  eventType: string
  duplicate: boolean
  processed: boolean
}

/**
 * Verifies and durably processes one subscription webhook delivery.
 * Throws RazorpayBillingError on signature/payload failure (route → 4xx) and
 * on processing failure BEFORE durable acceptance (route → 5xx, provider retries).
 */
export async function handleSubscriptionWebhook(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<WebhookResult> {
  if (!secret) {
    throw new RazorpayBillingError("WEBHOOK_SIGNATURE_INVALID", "Subscription webhook secret is not configured")
  }
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    throw new RazorpayBillingError("WEBHOOK_SIGNATURE_INVALID", "Webhook signature verification failed")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new RazorpayBillingError("WEBHOOK_PAYLOAD_INVALID", "Webhook body is not valid JSON")
  }

  const validated = eventSchema.safeParse(parsed)
  if (!validated.success) {
    throw new RazorpayBillingError("WEBHOOK_PAYLOAD_INVALID", "Webhook payload does not match the subscription event schema")
  }
  const event = validated.data
  const eventId = event.id

  const existing = await db.webhookEvent.findUnique({ where: { eventId } })
  if (existing) {
    return { received: true, eventId, eventType: event.event, duplicate: true, processed: existing.status === WebhookStatus.PROCESSED }
  }

  // Durable acceptance BEFORE processing: any later failure leaves a FAILED
  // record and is retryable; re-delivery of this same event id is idempotent.
  try {
    await db.webhookEvent.create({
      data: {
        source: "RAZORPAY",
        eventType: event.event,
        eventId,
        payload: {
          type: event.event,
          subscription_id: event.payload.subscription.entity.id,
          status: event.payload.subscription.entity.status ?? null,
          payment_id: event.payload.payment?.entity?.id ?? null,
          created_at: event.created_at ?? null,
        } as never,
        status: WebhookStatus.PENDING,
      },
    })
  } catch (err) {
    // Unique conflict = concurrent duplicate delivery — idempotent accept.
    if (err instanceof Error && /Unique constraint/i.test(err.message)) {
      return { received: true, eventId, eventType: event.event, duplicate: true, processed: false }
    }
    throw new RazorpayBillingError("WEBHOOK_PAYLOAD_INVALID", "Could not persist webhook event")
  }

  try {
    await processEvent(event)
  } catch (err) {
    await db.webhookEvent
      .update({
        where: { eventId },
        data: { status: WebhookStatus.FAILED, errorMessage: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500), attempts: { increment: 1 }, lastAttemptAt: new Date() },
      })
      .catch(() => undefined)
    throw err
  }

  await db.webhookEvent.update({
    where: { eventId },
    data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
  })
  await audit("razorpay", "SUBSCRIPTION_WEBHOOK_PROCESSED", eventId, { type: event.event })
  await invalidateAdminBillingCaches()
  return { received: true, eventId, eventType: event.event, duplicate: false, processed: true }
}

export { mapProviderStatus }