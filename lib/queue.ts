import { Queue } from "bullmq"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

const connection = { url: env.REDIS_URL }

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
}

// ── Email queue ───────────────────────────────────────────────────────────────
export const emailQueue = new Queue("email", { connection, defaultJobOptions })

// ── AI / inference queue ──────────────────────────────────────────────────────
// Used for long-running AI tasks that shouldn't block the request cycle
export const aiQueue = new Queue("ai", { connection, defaultJobOptions })

// ── Payment / webhook queue ───────────────────────────────────────────────────
// Processes Stripe/Razorpay webhooks with retry safety
export const paymentQueue = new Queue("payment", {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5, // higher retry count for financial operations
  },
})

// ── Notification queue ────────────────────────────────────────────────────────
export const notifQueue = new Queue("notifications", { connection, defaultJobOptions })

// ── Invoice / PDF generation queue ───────────────────────────────────────────
export const invoiceQueue = new Queue("invoice", { connection, defaultJobOptions })

// ── Audit log queue ───────────────────────────────────────────────────────────
export const auditQueue = new Queue("audit", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    removeOnComplete: { count: 200 },
    removeOnFail: false, // keep all audit failures for inspection
  },
})

// Job name constants to avoid string typos
export const EMAIL_JOBS = {
  SEND_WELCOME: "send-welcome",
  SEND_INVOICE: "send-invoice",
  SEND_RESET: "send-password-reset",
  SEND_RENEWAL: "send-subscription-renewal",
  SEND_PAYMENT_FAILED: "send-payment-failed",
  SEND_TICKET_REPLY: "send-ticket-reply",
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

logger.info("✅ BullMQ queues initialized: email, ai, payment, notifications, audit")
