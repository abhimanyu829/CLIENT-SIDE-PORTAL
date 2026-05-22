/**
 * lib/services/event-bus.ts
 *
 * Centralized typed event bus for the SaaS platform.
 * Every major action MUST emit an event through this bus.
 *
 * On emit:
 *  1. Triggers a Pusher real-time update to `admin-dashboard` channel
 *  2. Invalidates related Redis cache keys
 *  3. Logs to structured logger
 */

import { pusherServer } from "@/lib/pusher"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"
import { CACHE_KEYS } from "@/lib/services/cache-service"

// ── Event type constants ───────────────────────────────────────────────────────

export const EVENTS = {
  USER_CREATED:             "USER_CREATED",
  USER_BANNED:              "USER_BANNED",
  USER_UNBANNED:            "USER_UNBANNED",
  USER_ROLE_CHANGED:        "USER_ROLE_CHANGED",
  USER_DELETED:             "USER_DELETED",

  SUBSCRIPTION_ACTIVATED:   "SUBSCRIPTION_ACTIVATED",
  SUBSCRIPTION_CANCELLED:   "SUBSCRIPTION_CANCELLED",
  SUBSCRIPTION_PAUSED:      "SUBSCRIPTION_PAUSED",
  SUBSCRIPTION_REACTIVATED: "SUBSCRIPTION_REACTIVATED",
  PLAN_CHANGED:             "PLAN_CHANGED",

  PAYMENT_SUCCESS:          "PAYMENT_SUCCESS",
  PAYMENT_FAILED:           "PAYMENT_FAILED",
  REFUND_PROCESSED:         "REFUND_PROCESSED",

  COUPON_CREATED:           "COUPON_CREATED",
  COUPON_APPLIED:           "COUPON_APPLIED",
  COUPON_DEACTIVATED:       "COUPON_DEACTIVATED",

  CAMPAIGN_STARTED:         "CAMPAIGN_STARTED",
  CAMPAIGN_STOPPED:         "CAMPAIGN_STOPPED",

  AI_USAGE_RECORDED:        "AI_USAGE_RECORDED",
  QUOTA_EXCEEDED:           "QUOTA_EXCEEDED",
  QUOTA_OVERRIDDEN:         "QUOTA_OVERRIDDEN",

  FRAUD_FLAGGED:            "FRAUD_FLAGGED",

  FEATURE_FLAG_TOGGLED:     "FEATURE_FLAG_TOGGLED",

  WEBHOOK_RECEIVED:         "WEBHOOK_RECEIVED",
  WEBHOOK_REPLAYED:         "WEBHOOK_REPLAYED",
  WEBHOOK_DEAD:             "WEBHOOK_DEAD",

  PRODUCT_CREATED:          "PRODUCT_CREATED",
  PRODUCT_UPDATED:          "PRODUCT_UPDATED",
  TIER_PRICE_CHANGED:       "TIER_PRICE_CHANGED",

  VENDOR_CREATED:           "VENDOR_CREATED",
  VENDOR_VERIFIED:          "VENDOR_VERIFIED",
  CART_UPDATED:             "CART_UPDATED",
  ORDER_CREATED:            "ORDER_CREATED",
  ORDER_PAID:               "ORDER_PAID",
  ENTITLEMENT_GRANTED:      "ENTITLEMENT_GRANTED",
  SERVICE_ENGAGEMENT_CREATED: "SERVICE_ENGAGEMENT_CREATED",
  AGENT_DEPLOYED:           "AGENT_DEPLOYED",
} as const

export type EventType = (typeof EVENTS)[keyof typeof EVENTS]

export interface PlatformEvent {
  type: EventType
  timestamp: string
  payload: Record<string, unknown>
  actorId?: string  // adminId or userId who triggered the event
}

// Cache keys that should be invalidated per event type
const EVENT_CACHE_INVALIDATION: Partial<Record<EventType, string[]>> = {
  USER_CREATED:             [CACHE_KEYS.ADMIN_REVENUE_DASHBOARD, CACHE_KEYS.ADMIN_ANALYTICS],
  USER_BANNED:              [CACHE_KEYS.ADMIN_USERS, CACHE_KEYS.ADMIN_ANALYTICS],
  USER_UNBANNED:            [CACHE_KEYS.ADMIN_USERS],
  USER_ROLE_CHANGED:        [CACHE_KEYS.ADMIN_USERS],
  SUBSCRIPTION_ACTIVATED:   [CACHE_KEYS.ADMIN_REVENUE_DASHBOARD, CACHE_KEYS.ADMIN_SUBSCRIPTIONS],
  SUBSCRIPTION_CANCELLED:   [CACHE_KEYS.ADMIN_REVENUE_DASHBOARD, CACHE_KEYS.ADMIN_SUBSCRIPTIONS],
  SUBSCRIPTION_PAUSED:      [CACHE_KEYS.ADMIN_SUBSCRIPTIONS],
  SUBSCRIPTION_REACTIVATED: [CACHE_KEYS.ADMIN_SUBSCRIPTIONS, CACHE_KEYS.ADMIN_REVENUE_DASHBOARD],
  PLAN_CHANGED:             [CACHE_KEYS.ADMIN_SUBSCRIPTIONS, CACHE_KEYS.ADMIN_REVENUE_DASHBOARD],
  PAYMENT_SUCCESS:          [CACHE_KEYS.ADMIN_REVENUE_DASHBOARD, CACHE_KEYS.ADMIN_ORDERS],
  PAYMENT_FAILED:           [CACHE_KEYS.ADMIN_ORDERS],
  REFUND_PROCESSED:         [CACHE_KEYS.ADMIN_REVENUE_DASHBOARD, CACHE_KEYS.ADMIN_ORDERS],
  COUPON_CREATED:           [CACHE_KEYS.ADMIN_COUPONS],
  COUPON_APPLIED:           [CACHE_KEYS.ADMIN_REVENUE_DASHBOARD, CACHE_KEYS.ADMIN_COUPONS],
  COUPON_DEACTIVATED:       [CACHE_KEYS.ADMIN_COUPONS],
  CAMPAIGN_STARTED:         [CACHE_KEYS.ADMIN_COUPONS],
  CAMPAIGN_STOPPED:         [CACHE_KEYS.ADMIN_COUPONS],
  AI_USAGE_RECORDED:        [CACHE_KEYS.ADMIN_AI_MONITORING],
  QUOTA_EXCEEDED:           [CACHE_KEYS.ADMIN_AI_MONITORING],
  FEATURE_FLAG_TOGGLED:     [CACHE_KEYS.FEATURE_FLAGS],
  PRODUCT_CREATED:          [CACHE_KEYS.ADMIN_PRODUCTS],
  PRODUCT_UPDATED:          [CACHE_KEYS.ADMIN_PRODUCTS],
  TIER_PRICE_CHANGED:       [CACHE_KEYS.ADMIN_PRODUCTS, CACHE_KEYS.ADMIN_REVENUE_DASHBOARD],
  WEBHOOK_RECEIVED:         [CACHE_KEYS.ADMIN_WEBHOOKS],
  WEBHOOK_REPLAYED:         [CACHE_KEYS.ADMIN_WEBHOOKS],
  WEBHOOK_DEAD:             [CACHE_KEYS.ADMIN_WEBHOOKS],
}

/**
 * Emit a platform event.
 * This triggers real-time Pusher update + Redis cache invalidation +
 * Phase 7: activity feed push to Redis ZSET for live website activity ticker.
 * Never throws — failures are logged but do not break the caller.
 */
export async function emitEvent(event: PlatformEvent): Promise<void> {
  const { type, timestamp, payload, actorId } = event

  // 1. Pusher real-time broadcast to admin channel
  try {
    await pusherServer.trigger("admin-dashboard", type, {
      type,
      timestamp,
      payload,
      actorId,
    })
  } catch (err) {
    logger.warn({ err, type }, "emitEvent: Pusher trigger failed (non-fatal)")
  }

  // 2. Redis cache invalidation (admin caches)
  const keysToInvalidate = EVENT_CACHE_INVALIDATION[type] ?? []
  if (redis && keysToInvalidate.length > 0) {
    try {
      await Promise.all(keysToInvalidate.map((key) => redis!.del(key)))
      logger.debug({ type, keys: keysToInvalidate }, "emitEvent: Cache invalidated")
    } catch (err) {
      logger.warn({ err, type }, "emitEvent: Cache invalidation failed (non-fatal)")
    }
  }

  // 3. Push to public activity feed ZSET (Phase 7 — Real-Time Infrastructure)
  // Events: SUBSCRIPTION_ACTIVATED, PRODUCT_CREATED, COUPON_APPLIED, CAMPAIGN_STARTED
  const ACTIVITY_ZSET = "platform:activity"
  const activityMessage = buildActivityMessage(type, payload)
  if (redis && activityMessage) {
    try {
      const score = Date.now()
      const member = JSON.stringify({ type, message: activityMessage, timestamp, payload })
      await redis.zadd(ACTIVITY_ZSET, { score, member })
      // Trim to last 50 entries (keep feed lean)
      await redis.zremrangebyrank(ACTIVITY_ZSET, 0, -51)
      // Remove entries older than 24h
      await redis.zremrangebyscore(ACTIVITY_ZSET, 0, Date.now() - 86_400_000)
    } catch (err) {
      logger.warn({ err, type }, "emitEvent: Activity feed push failed (non-fatal)")
    }
  }

  // 4. Structured log
  logger.info({ type, actorId, payload }, `Platform event: ${type}`)
}

// ── Activity message builder ───────────────────────────────────────────────────

const ACTIVITY_EMOJIS: Partial<Record<EventType, string>> = {
  SUBSCRIPTION_ACTIVATED: "🚀",
  PRODUCT_CREATED:        "✨",
  COUPON_APPLIED:         "🎟️",
  CAMPAIGN_STARTED:       "🔥",
  PAYMENT_SUCCESS:        "💳",
  USER_CREATED:           "👋",
  PLAN_CHANGED:           "⬆️",
  CART_UPDATED:           "Cart",
  ORDER_CREATED:          "Order",
  ORDER_PAID:             "Paid",
  VENDOR_CREATED:         "Vendor",
  SERVICE_ENGAGEMENT_CREATED: "Service",
  AGENT_DEPLOYED:         "Agent",
}

function buildActivityMessage(type: EventType, payload: Record<string, unknown>): string | null {
  const emoji = ACTIVITY_EMOJIS[type]
  if (!emoji) return null

  switch (type) {
    case "SUBSCRIPTION_ACTIVATED": {
      const product = (payload.productName as string) || "a product"
      const plan    = (payload.planName    as string) || "Pro"
      return `${emoji} Someone just subscribed to ${product} — ${plan} Plan`
    }
    case "PRODUCT_CREATED": {
      const name = (payload.productName as string) || "New Product"
      return `${emoji} New product launched: ${name}`
    }
    case "COUPON_APPLIED": {
      const code = (payload.couponCode as string) || "a coupon"
      return `${emoji} Coupon ${code} applied — great deal claimed!`
    }
    case "CAMPAIGN_STARTED": {
      const name = (payload.campaignName as string) || "Sale"
      return `${emoji} ${name} is now live — limited time!`
    }
    case "PAYMENT_SUCCESS": {
      const amount = (payload.amount as number) || 0
      return `${emoji} New payment of $${amount} received`
    }
    case "USER_CREATED": {
      return `${emoji} A new member just joined NexusAI`
    }
    case "PLAN_CHANGED": {
      const plan = (payload.newPlan as string) || "new plan"
      return `${emoji} Someone upgraded to ${plan}`
    }
    case "CART_UPDATED": {
      const product = (payload.productName as string) || "a product"
      return `${emoji} ${product} was added to a marketplace cart`
    }
    case "ORDER_CREATED": {
      const orderNumber = (payload.orderNumber as string) || "a new order"
      return `${emoji} ${orderNumber} started checkout`
    }
    case "ORDER_PAID": {
      const orderNumber = (payload.orderNumber as string) || "an order"
      return `${emoji} ${orderNumber} was paid and fulfilled`
    }
    case "VENDOR_CREATED": {
      const vendorName = (payload.vendorName as string) || "A vendor"
      return `${emoji} ${vendorName} joined the seller ecosystem`
    }
    case "SERVICE_ENGAGEMENT_CREATED": {
      const title = (payload.title as string) || "Enterprise service engagement"
      return `${emoji} ${title} entered the delivery pipeline`
    }
    case "AGENT_DEPLOYED": {
      const productName = (payload.productName as string) || "An AI agent"
      return `${emoji} ${productName} deployment is live`
    }
    default:
      return null
  }
}
