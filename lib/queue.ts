import { Queue, type QueueOptions } from "bullmq"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

const REDIS_URL = env.REDIS_URL
const REDIS_AVAILABLE = !!REDIS_URL

const connection = REDIS_URL ? { url: REDIS_URL } : undefined

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
}

function createLazyQueue(name: string, options: Partial<QueueOptions> = {}) {
  let queue: Queue | null = null

  const getQueue = () => {
    if (!REDIS_AVAILABLE || !connection) return null
    if (!queue) {
      queue = new Queue(name, {
        ...options,
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          ...options.defaultJobOptions,
        },
      })
      logger.debug({ queue: name }, "BullMQ queue initialized")
    }
    return queue
  }

  // Return a Proxy that gracefully no-ops when Redis is unavailable
  return new Proxy({} as Queue, {
    get(_target, prop, receiver) {
      const q = getQueue()
      if (!q) {
        // Return no-op functions for all method calls when Redis is unavailable
        if (typeof prop === "string") {
          return async (..._args: unknown[]) => {
            // Silently skip — the caller should handle this gracefully
          }
        }
        return undefined
      }
      const value = Reflect.get(q, prop, receiver)
      return typeof value === "function" ? value.bind(q) : value
    },
  })
}

// Queues are lazy so Next dev/build can compile route modules without opening Redis clients.
// When Redis is unavailable, all queue operations silently no-op.
export const emailQueue = createLazyQueue("email")

// Used for long-running AI tasks that should not block the request cycle.
export const aiQueue = createLazyQueue("ai")

// Processes Stripe/Razorpay webhooks with retry safety.
export const paymentQueue = createLazyQueue("payment", {
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5,
  },
})

export const notifQueue = createLazyQueue("notifications")
export const invoiceQueue = createLazyQueue("invoice")
export const subscriptionQueue = createLazyQueue("subscription", {
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5,
  },
})
export const analyticsQueue = createLazyQueue("analytics")
export const previewQueue   = createLazyQueue("preview")

export const auditQueue = createLazyQueue("audit", {
  defaultJobOptions: {
    attempts: 5,
    removeOnComplete: { count: 200 },
    removeOnFail: false,
  },
})

export const EMAIL_JOBS = {
  PROCESS_QUEUE:             "email.process-queue",
  PROCESS_CAMPAIGN:          "email.process-campaign",
  SEND_TEST:                 "email.send-test",
  SEND_WELCOME:              "send-welcome",
  SEND_INVOICE:              "send-invoice",
  SEND_RESET:                "send-password-reset",
  SEND_RENEWAL:              "send-subscription-renewal",
  SEND_PAYMENT_FAILED:       "send-payment-failed",
  SEND_TICKET_REPLY:         "send-ticket-reply",
  // Enterprise additions
  SEND_PRODUCT_DELIVERY:     "send-product-delivery",
  SEND_PREVIEW_STARTED:      "send-preview-started",
  SEND_PREVIEW_EXPIRED:      "send-preview-expired",
  SEND_EXPIRY_WARNING:       "send-subscription-expiry-warning",
  SEND_SUBSCRIPTION_EXPIRED: "send-subscription-expired",
  SEND_REFUND_CONFIRMATION:  "send-refund-confirmation",
  SEND_ADMIN_REFUND_ALERT:   "send-admin-refund-alert",
  SEND_LOGIN_ALERT:          "send-login-alert",
  SEND_SUSPICIOUS_ACTIVITY:  "send-suspicious-activity",
  SEND_INVOICE_READY:        "send-invoice-ready",
} as const

export const PREVIEW_JOBS = {
  EXPIRE_SESSION:   "preview.expire-session",
  NOTIFY_EXPIRY:    "preview.notify-expiry",
  RECORD_ANALYTICS: "preview.record-analytics",
} as const

export const AI_JOBS = {
  GENERATE_SUMMARY: "generate-summary",
  CLASSIFY_TICKET: "classify-ticket",
  ANALYZE_LEAD: "analyze-lead",
} as const

export const PAYMENT_JOBS = {
  PROCESS_WEBHOOK: "process-webhook",
  RETRY_CHARGE: "retry-charge",
  RECONCILE: "reconcile",
} as const

export const INVOICE_JOBS = {
  GENERATE: "generate.invoice",
  SEND: "send.invoice",
  REGENERATE: "regenerate.invoice",
} as const

export const SUBSCRIPTION_JOBS = {
  EXPIRE_OVERDUE:      "subscription.expire-overdue",
  RECONCILE:           "subscription.reconcile",
  DUNNING_STEP:        "dunning.step",
  SEND_EXPIRY_WARNING: "subscription.send-expiry-warning",
  REVOKE_ENTITLEMENTS: "subscription.revoke-entitlements",
  FULFILL_ORDER:       "subscription.fulfill-order",
} as const
