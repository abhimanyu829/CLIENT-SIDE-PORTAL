import { Worker, QueueEvents } from "bullmq"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { db } from "@/lib/db"
import { emailQueue, invoiceQueue, notifQueue, paymentQueue, subscriptionQueue, INVOICE_JOBS, SUBSCRIPTION_JOBS, PAYMENT_JOBS, EMAIL_JOBS } from "@/lib/queue"
import { expireOverdueSubscriptions, markSubscriptionPastDue } from "@/lib/services/subscription-service"
import { generateInvoiceArtifact, sendInvoiceEmail } from "@/lib/services/invoice-service"
import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/resend"
import WelcomeEmail from "@/emails/WelcomeEmail"
import VerificationEmail from "@/emails/VerificationEmail"
import PasswordResetEmail from "@/emails/PasswordResetEmail"
import SubscriptionRenewalEmail from "@/emails/SubscriptionRenewalEmail"
import PaymentFailedEmail from "@/emails/PaymentFailedEmail"
import InvoiceEmail from "@/emails/InvoiceEmail"

const connection = { url: env.REDIS_URL }

function startWorker(name: string, processor: ConstructorParameters<typeof Worker>[1], concurrency = 5) {
  const worker = new Worker(name, processor, { connection, concurrency })
  const events = new QueueEvents(name, { connection })

  worker.on("failed", (job, error) =>
    logger.error({ queue: name, jobId: job?.id, error }, "Worker job failed")
  )
  worker.on("completed", (job) =>
    logger.debug({ queue: name, jobId: job?.id }, "Worker job completed")
  )
  events.on("failed", ({ jobId, failedReason }) =>
    logger.error({ queue: name, jobId, failedReason }, "Queue event failed")
  )
  return worker
}

export async function scheduleRecurringJobs() {
  await subscriptionQueue.add(SUBSCRIPTION_JOBS.EXPIRE_OVERDUE, {}, {
    jobId: "subscription-expiry-5m",
    repeat: { pattern: "*/5 * * * *" },
  })
  await subscriptionQueue.add(SUBSCRIPTION_JOBS.RECONCILE, {}, {
    jobId: "subscription-reconcile-hourly",
    repeat: { pattern: "0 * * * *" },
  })
  await paymentQueue.add(PAYMENT_JOBS.RECONCILE, {}, {
    jobId: "payment-reconcile-hourly",
    repeat: { pattern: "5 * * * *" },
  })
}

export function startWorkers() {
  const workers = [
    startWorker("subscription", async (job) => {
      if (job.name === SUBSCRIPTION_JOBS.EXPIRE_OVERDUE || job.name === SUBSCRIPTION_JOBS.RECONCILE) {
        return expireOverdueSubscriptions()
      }
      if (job.name === SUBSCRIPTION_JOBS.DUNNING_STEP) {
        const { subscriptionId, userId, attempt = 1 } = job.data as { subscriptionId: string; userId: string; attempt?: number }
        await markSubscriptionPastDue(subscriptionId, userId, `Dunning attempt ${attempt}`)
        await createNotification({
          userId,
          type: "PAYMENT",
          title: "Payment action required",
          body: "Your renewal payment failed. Please update your payment method to keep access active.",
          actionUrl: "/dashboard/subscriptions",
        })
        if (attempt < 3) {
          await subscriptionQueue.add(SUBSCRIPTION_JOBS.DUNNING_STEP, { subscriptionId, userId, attempt: attempt + 1 }, { delay: attempt * 24 * 60 * 60 * 1000 })
        }
      }
    }, 3),

    startWorker("invoice", async (job) => {
      const { paymentId } = job.data as { paymentId?: string }
      if (!paymentId) throw new Error("paymentId is required")
      if (job.name === INVOICE_JOBS.SEND || job.name === "generate.invoice") return sendInvoiceEmail(paymentId)
      return generateInvoiceArtifact(paymentId)
    }, 5),

    startWorker("notifications", async (job) => {
      if (job.name === "dunning.start") {
        const { subscriptionId, userId } = job.data as { subscriptionId: string; userId: string }
        await subscriptionQueue.add(SUBSCRIPTION_JOBS.DUNNING_STEP, { subscriptionId, userId, attempt: 1 })
      }
    }, 10),

    startWorker("email", async (job) => {
      const jobName = job.name
      const data = job.data as Record<string, any>

      logger.info({ jobName, data }, "Email worker processing job")

      if (
        jobName === EMAIL_JOBS.SEND_WELCOME ||
        jobName === "send-email" ||
        jobName === "send.welcome"
      ) {
        const type = data.type ?? "registration"
        const to = data.to
        const name = data.name ?? "there"

        if (!to) {
          logger.warn({ jobName }, "Email job missing recipient — skipping")
          return
        }

        if (type === "verification" && data.verificationUrl) {
          await sendEmail({
            to,
            subject: "Verify your NexusAI account",
            react: VerificationEmail({
              name,
              verificationUrl: data.verificationUrl,
              expiryMinutes: data.expiryMinutes ?? 60,
            }),
          })
          logger.info({ to }, "Verification email sent via worker")
        } else {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
          await sendEmail({
            to,
            subject: "Welcome to NexusAI!",
            react: WelcomeEmail({
              name,
              email: to,
              dashboardUrl: `${appUrl}/dashboard`,
            }),
          })
          logger.info({ to }, "Welcome email sent via worker")
        }
        return
      }

      if (
        jobName === EMAIL_JOBS.SEND_RESET ||
        jobName === "send.password-reset"
      ) {
        if (data.to && data.resetUrl) {
          await sendEmail({
            to: data.to,
            subject: "Reset your NexusAI password",
            react: PasswordResetEmail({
              name: data.name ?? "there",
              resetLink: data.resetUrl,
              expiresInHours: data.expiresInHours ?? 1,
            }),
          })
          logger.info({ to: data.to }, "Password reset email sent via worker")
        }
        return
      }

      if (jobName === EMAIL_JOBS.SEND_RENEWAL || jobName === "send.renewal") {
        const { email, invoiceUrl, planName, renewalDate, amount } = data
        if (email) {
          await sendEmail({
            to: email,
            subject: "Your NexusAI subscription renewed",
            react: SubscriptionRenewalEmail({
              name: data.name ?? "there",
              planName: planName ?? "NexusAI",
              renewalDate: renewalDate ?? new Date().toDateString(),
              amount: amount ?? "",
              currency: data.currency ?? "USD",
              manageUrl: invoiceUrl ?? "",
            }),
          })
        }
        return
      }

      if (
        jobName === EMAIL_JOBS.SEND_PAYMENT_FAILED ||
        jobName === "send.payment-failed"
      ) {
        if (data.to) {
          await sendEmail({
            to: data.to,
            subject: "Payment failed — NexusAI",
            react: PaymentFailedEmail({
              name: data.name ?? "there",
              planName: data.planName ?? "NexusAI",
              amount: data.amount ?? "",
              failedAt: data.failedAt ?? new Date().toISOString(),
              retryDate: data.retryDate ?? new Date().toDateString(),
            }),
          })
        }
      }
    }, 10),

    startWorker("payment", async (job) => {
      if (job.name === PAYMENT_JOBS.PROCESS_WEBHOOK) {
        const { webhookEventId } = job.data as { webhookEventId?: string }
        if (!webhookEventId) throw new Error("webhookEventId is required")
        await db.webhookEvent.update({
          where: { id: webhookEventId },
          data: { status: "PENDING", lastAttemptAt: new Date(), attempts: { increment: 1 } },
        })
      }
    }, 3),
  ]

  return workers
}

if (require.main === module) {
  scheduleRecurringJobs()
    .then(() => startWorkers())
    .then(() => logger.info("NexusAI workers started"))
    .catch((error) => {
      logger.error({ error }, "Worker bootstrap failed")
      process.exit(1)
    })
}
