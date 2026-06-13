import { Worker, QueueEvents } from "bullmq"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { db } from "@/lib/db"
import {
  emailQueue, invoiceQueue, notifQueue, paymentQueue, subscriptionQueue,
  previewQueue,
  INVOICE_JOBS, SUBSCRIPTION_JOBS, PAYMENT_JOBS, EMAIL_JOBS, PREVIEW_JOBS,
} from "@/lib/queue"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { expireOverdueSubscriptions, markSubscriptionPastDue } from "@/lib/services/subscription-service"
import { generateInvoiceArtifact, sendInvoiceEmail } from "@/lib/services/invoice-service"
import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/resend"
import { processEmailQueue, scheduleEmailCampaign } from "@/lib/email/service"
import WelcomeEmail from "@/emails/WelcomeEmail"
import VerificationEmail from "@/emails/VerificationEmail"
import PasswordResetEmail from "@/emails/PasswordResetEmail"
import SubscriptionRenewalEmail from "@/emails/SubscriptionRenewalEmail"
import PaymentFailedEmail from "@/emails/PaymentFailedEmail"
import InvoiceEmail from "@/emails/InvoiceEmail"
import ProductDeliveryEmail from "@/emails/ProductDeliveryEmail"
import PreviewStartedEmail from "@/emails/PreviewStartedEmail"
import PreviewExpiredEmail from "@/emails/PreviewExpiredEmail"
import SubscriptionExpiryWarningEmail from "@/emails/SubscriptionExpiryWarningEmail"
import SubscriptionExpiredEmail from "@/emails/SubscriptionExpiredEmail"
import RefundConfirmationEmail from "@/emails/RefundConfirmationEmail"
import RefundRequestedAdminEmail from "@/emails/RefundRequestedAdminEmail"
import LoginAlertEmail from "@/emails/LoginAlertEmail"
import InvoiceReadyEmail from "@/emails/InvoiceReadyEmail"

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

      if (jobName === EMAIL_JOBS.PROCESS_QUEUE) {
        const { queueId } = data as { queueId?: string }
        if (!queueId) throw new Error("queueId is required")
        await processEmailQueue(queueId)
        return
      }

      if (jobName === EMAIL_JOBS.PROCESS_CAMPAIGN) {
        const { campaignId } = data as { campaignId?: string }
        if (!campaignId) throw new Error("campaignId is required")
        await scheduleEmailCampaign(campaignId)
        return
      }

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
        return
      }

      // ── Enterprise email jobs ────────────────────────────────────────────────

      if (jobName === EMAIL_JOBS.SEND_PRODUCT_DELIVERY) {
        const user = data.userId
          ? await db.user.findUnique({ where: { id: data.userId }, select: { email: true, name: true } })
          : null
        const to = data.to ?? user?.email
        if (to) {
          await sendEmail({
            to,
            subject: `Your ${data.productName ?? "NexusAI"} access is ready`,
            react: ProductDeliveryEmail({
              name: user?.name ?? data.name ?? "there",
              productName: data.productName ?? "Your Product",
              saasUrl: data.saasUrl,
              username: data.username,
              password: data.password,
              apiKeys: data.apiKeys,
              onboardingInstructions: data.onboardingInstructions,
              accessDocUrl: data.accessDocUrl,
              subscriptionDuration: data.subscriptionDuration,
              renewalDate: data.renewalDate,
              supportUrl: data.supportUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tickets`,
            }),
          })
          logger.info({ to, productName: data.productName }, "Product delivery email sent")
        }
        return
      }

      if (jobName === EMAIL_JOBS.SEND_PREVIEW_STARTED) {
        const user = data.userId
          ? await db.user.findUnique({ where: { id: data.userId }, select: { email: true, name: true } })
          : null
        const to = data.to ?? user?.email
        if (to) {
          await sendEmail({
            to,
            subject: `Your ${data.productName ?? "product"} preview is now active`,
            react: PreviewStartedEmail({
              name: user?.name ?? data.name ?? "there",
              productName: data.productName ?? "Your Product",
              previewUrl: data.previewUrl,
              expiresAt: data.expiresAt ?? new Date().toISOString(),
              durationMinutes: data.durationMinutes ?? 10,
            }),
          })
        }
        return
      }

      if (jobName === EMAIL_JOBS.SEND_PREVIEW_EXPIRED) {
        const to = data.to
        if (to) {
          await sendEmail({
            to,
            subject: `Your ${data.productName ?? "product"} preview has ended`,
            react: PreviewExpiredEmail({
              name: data.name ?? "there",
              productName: data.productName ?? "Your Product",
              productSlug: data.productSlug ?? "",
              appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://nexusai.com",
            }),
          })
        }
        return
      }

      if (jobName === EMAIL_JOBS.SEND_EXPIRY_WARNING) {
        const user = data.userId
          ? await db.user.findUnique({ where: { id: data.userId }, select: { email: true, name: true } })
          : null
        const to = data.to ?? user?.email
        if (to) {
          await sendEmail({
            to,
            subject: `Your ${data.productName ?? "subscription"} expires in ${data.daysUntilExpiry ?? "7"} day(s)`,
            react: SubscriptionExpiryWarningEmail({
              name: user?.name ?? data.name ?? "there",
              productName: data.productName ?? "Your Subscription",
              daysUntilExpiry: data.daysUntilExpiry ?? 7,
              expiryDate: data.expiryDate ?? "",
              renewUrl: data.renewUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions`,
              amount: data.amount,
              currency: data.currency ?? "USD",
            }),
          })
        }
        return
      }

      if (jobName === EMAIL_JOBS.SEND_SUBSCRIPTION_EXPIRED) {
        const user = data.userId
          ? await db.user.findUnique({ where: { id: data.userId }, select: { email: true, name: true } })
          : null
        const to = data.to ?? user?.email
        if (to) {
          await sendEmail({
            to,
            subject: `Your ${data.productName ?? "NexusAI"} subscription has ended`,
            react: SubscriptionExpiredEmail({
              name: user?.name ?? data.name ?? "there",
              productName: data.productName ?? "Your Subscription",
              expiredAt: data.expiredAt ?? new Date().toISOString(),
              renewUrl: data.renewUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions`,
            }),
          })
        }
        return
      }

      if (jobName === EMAIL_JOBS.SEND_REFUND_CONFIRMATION) {
        const user = data.userId
          ? await db.user.findUnique({ where: { id: data.userId }, select: { email: true, name: true } })
          : null
        const to = data.to ?? user?.email
        if (to) {
          await sendEmail({
            to,
            subject: `Refund of ${data.currency ?? ""} ${data.refundAmount ?? ""} confirmed`,
            react: RefundConfirmationEmail({
              name: user?.name ?? data.name ?? "there",
              productName: data.productName ?? "Your Product",
              refundAmount: String(data.refundAmount ?? "0"),
              currency: data.currency ?? "USD",
              gateway: data.gateway ?? "Payment Gateway",
              gatewayRefundId: data.gatewayRefundId,
              estimatedDays: data.estimatedDays ?? "5-7",
            }),
          })
        }
        return
      }

      if (jobName === EMAIL_JOBS.SEND_ADMIN_REFUND_ALERT) {
        const adminEmail = data.adminEmail ?? process.env.ADMIN_EMAIL ?? "admin@nexusai.com"
        await sendEmail({
          to: adminEmail,
          subject: `[Action Required] Refund Request from ${data.userEmail ?? "a user"}`,
          react: RefundRequestedAdminEmail({
            adminEmail,
            userName: data.userName ?? "User",
            userEmail: data.userEmail ?? "",
            productName: data.productName ?? "Unknown Product",
            reason: data.reason ?? "No reason provided",
            refundAmount: String(data.refundAmount ?? "0"),
            currency: data.currency ?? "USD",
            refundRequestId: data.refundRequestId ?? "",
            adminUrl: data.adminUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/admin/payments`,
          }),
        })
        return
      }

      if (jobName === EMAIL_JOBS.SEND_LOGIN_ALERT) {
        const user = data.userId
          ? await db.user.findUnique({ where: { id: data.userId }, select: { email: true, name: true } })
          : null
        const to = data.to ?? user?.email
        if (to) {
          await sendEmail({
            to,
            subject: "New sign-in to your NexusAI account",
            react: LoginAlertEmail({
              name: user?.name ?? data.name ?? "there",
              ipAddress: data.ipAddress,
              userAgent: data.userAgent,
              location: data.location,
              loginAt: data.loginAt ?? new Date().toISOString(),
              securityUrl: data.securityUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/security`,
            }),
          })
        }
        return
      }

      if (jobName === EMAIL_JOBS.SEND_INVOICE_READY) {
        const user = data.userId
          ? await db.user.findUnique({ where: { id: data.userId }, select: { email: true, name: true } })
          : null
        const to = data.to ?? user?.email
        if (to) {
          await sendEmail({
            to,
            subject: `Invoice ${data.invoiceNumber ?? ""} is ready`,
            react: InvoiceReadyEmail({
              name: user?.name ?? data.name ?? "there",
              invoiceNumber: data.invoiceNumber ?? "",
              productName: data.productName ?? "NexusAI",
              amount: String(data.amount ?? "0"),
              currency: data.currency ?? "USD",
              issuedAt: data.issuedAt ?? new Date().toISOString(),
              invoiceUrl: data.invoiceUrl,
              dashboardUrl: data.dashboardUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
            }),
          })
        }
        return
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

    // ── Preview session expiry worker ────────────────────────────────────────
    startWorker("preview", async (job) => {
      if (job.name === PREVIEW_JOBS.EXPIRE_SESSION) {
        const { sessionId, userId, productId, productName, expiresAt } = job.data as {
          sessionId: string
          userId: string
          productId: string
          productName?: string
          expiresAt?: string
        }

        // Mark session as expired in DB
        const session = await db.demoSession.update({
          where: { id: sessionId },
          data: { isExpired: true },
        }).catch(() => null)

        if (!session) {
          logger.warn({ sessionId }, "Preview expiry: session not found")
          return
        }

        // Blacklist token in Redis
        const { revokePreviewToken } = await import("@/lib/preview-token")
        const expiry = expiresAt ? new Date(expiresAt) : new Date()
        await revokePreviewToken(sessionId, expiry, "expired")

        // Fetch user and send expiry email
        if (userId) {
          const user = await db.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
          })
          if (user) {
            await emailQueue.add(EMAIL_JOBS.SEND_PREVIEW_EXPIRED, {
              to: user.email,
              name: user.name,
              productName: productName ?? "your product",
              productSlug: productId,
            })
          }
        }

        // Audit trail
        await db.auditLog.create({
          data: {
            userId,
            action: "PREVIEW_EXPIRED",
            entity: "DemoSession",
            entityId: sessionId,
            afterJson: { productId, expiredAt: new Date().toISOString() },
          },
        }).catch(() => {})

        // Emit event to Pusher (preview channel + admin + user channel)
        await emitEvent({
          type: EVENTS.PREVIEW_EXPIRED,
          timestamp: new Date().toISOString(),
          actorId: userId,
          payload: { sessionId, productId, userId, productName },
        })

        logger.info({ sessionId, userId, productId }, "Preview session expired via BullMQ")
      }
    }, 10),
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
