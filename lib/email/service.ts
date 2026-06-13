import { randomUUID } from "crypto"
import { Prisma, type Role, type EmailCampaignStatus, type EmailAudienceType, type SuppressionReason, type EmailStatus, type EmailProviderName, type DeliveryState } from "@prisma/client"
import { db } from "@/lib/db"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { createNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { sendEmail } from "@/lib/resend"
import { renderEmailTemplate } from "@/lib/email/template-registry"

export type EmailWorkflow =
  | "ACCOUNT_REGISTRATION"
  | "EMAIL_VERIFICATION"
  | "LOGIN_ALERT"
  | "SUSPICIOUS_LOGIN"
  | "PASSWORD_RESET"
  | "PASSWORD_CHANGE_CONFIRMATION"
  | "MFA_SETUP"
  | "MFA_RECOVERY"
  | "ACCOUNT_LOCK"
  | "ACCOUNT_SUSPENSION"
  | "ACCOUNT_REACTIVATION"
  | "ACCOUNT_DELETION"
  | "PROFILE_UPDATE"
  | "ROLE_CHANGE"
  | "ADMIN_PRIVILEGE_CHANGE"
  | "PRODUCT_PURCHASE_CONFIRMATION"
  | "PAYMENT_VERIFICATION_REQUEST"
  | "PAYMENT_APPROVED"
  | "PAYMENT_REJECTED"
  | "SUBSCRIPTION_ACTIVATION"
  | "SUBSCRIPTION_RENEWAL"
  | "SUBSCRIPTION_CANCELLATION"
  | "SUBSCRIPTION_EXPIRY_WARNING"
  | "SUBSCRIPTION_EXPIRED"
  | "REFUND_REQUESTED"
  | "REFUND_APPROVED"
  | "REFUND_REJECTED"
  | "PRODUCT_OWNERSHIP_ASSIGNED"
  | "PRODUCT_CREDENTIALS_DELIVERED"
  | "CREDENTIALS_UPDATED"
  | "PRODUCT_REPUBLISHED"
  | "INVENTORY_OUT_OF_STOCK"
  | "PRODUCT_CANCELLATION"
  | "ORDER_CREATED"
  | "ORDER_FAILURE"
  | "ORDER_COMPLETION"
  | "INVOICE_GENERATION"
  | "RECEIPT_DELIVERY"
  | "SUPPORT_TICKET_CREATED"
  | "SUPPORT_TICKET_UPDATE"
  | "SUPPORT_TICKET_RESOLUTION"
  | "SECURITY_NOTIFICATION"
  | "POLICY_UPDATE"
  | "MAINTENANCE_NOTIFICATION"
  | "NEW_PRODUCT_LAUNCH"
  | "PRODUCT_RECOMMENDATION"
  | "PROMOTIONAL_CAMPAIGN"
  | "NEWSLETTER_CAMPAIGN"
  | "FEATURE_ANNOUNCEMENT"
  | "PLATFORM_UPDATE"
  | "AUDIT_NOTIFICATION"
  | "ADMIN_BROADCAST"

const TRANSACTIONAL_EMAIL_TYPES = new Set<EmailWorkflow>([
  "ACCOUNT_REGISTRATION",
  "EMAIL_VERIFICATION",
  "LOGIN_ALERT",
  "SUSPICIOUS_LOGIN",
  "PASSWORD_RESET",
  "PASSWORD_CHANGE_CONFIRMATION",
  "MFA_SETUP",
  "MFA_RECOVERY",
  "ACCOUNT_LOCK",
  "ACCOUNT_SUSPENSION",
  "ACCOUNT_REACTIVATION",
  "ACCOUNT_DELETION",
  "PROFILE_UPDATE",
  "ROLE_CHANGE",
  "ADMIN_PRIVILEGE_CHANGE",
  "PRODUCT_PURCHASE_CONFIRMATION",
  "PAYMENT_VERIFICATION_REQUEST",
  "PAYMENT_APPROVED",
  "PAYMENT_REJECTED",
  "SUBSCRIPTION_ACTIVATION",
  "SUBSCRIPTION_RENEWAL",
  "SUBSCRIPTION_CANCELLATION",
  "SUBSCRIPTION_EXPIRY_WARNING",
  "SUBSCRIPTION_EXPIRED",
  "REFUND_REQUESTED",
  "REFUND_APPROVED",
  "REFUND_REJECTED",
  "PRODUCT_OWNERSHIP_ASSIGNED",
  "PRODUCT_CREDENTIALS_DELIVERED",
  "CREDENTIALS_UPDATED",
  "PRODUCT_REPUBLISHED",
  "INVENTORY_OUT_OF_STOCK",
  "PRODUCT_CANCELLATION",
  "ORDER_CREATED",
  "ORDER_FAILURE",
  "ORDER_COMPLETION",
  "INVOICE_GENERATION",
  "RECEIPT_DELIVERY",
  "SUPPORT_TICKET_CREATED",
  "SUPPORT_TICKET_UPDATE",
  "SUPPORT_TICKET_RESOLUTION",
  "SECURITY_NOTIFICATION",
  "POLICY_UPDATE",
  "MAINTENANCE_NOTIFICATION",
  "AUDIT_NOTIFICATION",
  "ADMIN_BROADCAST",
])

const PREFERENCE_KEY_MAP: Partial<Record<EmailWorkflow, keyof import("@prisma/client").EmailPreference>> = {
  PROMOTIONAL_CAMPAIGN: "marketing",
  NEWSLETTER_CAMPAIGN: "newsletter",
  NEW_PRODUCT_LAUNCH: "productUpdates",
  PRODUCT_RECOMMENDATION: "productUpdates",
  FEATURE_ANNOUNCEMENT: "productUpdates",
  PLATFORM_UPDATE: "productUpdates",
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  return JSON.parse(JSON.stringify(payload ?? {})) as T
}

export function isTransactionalEmail(emailType: EmailWorkflow) {
  return TRANSACTIONAL_EMAIL_TYPES.has(emailType)
}

export async function ensureEmailPreference(userId: string) {
  return db.emailPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      unsubscribeToken: randomUUID(),
    },
  })
}

export async function validateEmailRecipient(recipient: string) {
  const normalized = recipient.trim().toLowerCase()
  if (!normalized || !normalized.includes("@")) {
    throw new Error("INVALID_EMAIL_ADDRESS")
  }
  return normalized
}

export async function isSuppressed(recipient: string, emailType: EmailWorkflow) {
  const suppression = await db.emailSuppression.findUnique({ where: { email: recipient.toLowerCase() } })
  if (!suppression) return false
  if (suppression.emailTypes.length === 0) return true
  return suppression.emailTypes.includes(emailType)
}

async function checkRateLimit(bucketKey: string, windowSecs = 3600, maxTokens = 10) {
  const now = new Date()
  const state = await db.rateLimit.findUnique({ where: { bucketKey } })
  if (!state) {
    await db.rateLimit.create({ data: { bucketKey, tokens: Math.max(0, maxTokens - 1), windowStart: now, windowSecs, maxTokens } })
    return
  }

  const elapsedSeconds = (now.getTime() - state.windowStart.getTime()) / 1000
  const reset = elapsedSeconds >= state.windowSecs
  const tokens = reset ? maxTokens : state.tokens
  if (tokens <= 0) {
    throw new Error("EMAIL_RATE_LIMITED")
  }

  await db.rateLimit.update({
    where: { bucketKey },
    data: {
      tokens: reset ? Math.max(0, maxTokens - 1) : tokens - 1,
      windowStart: reset ? now : state.windowStart,
      windowSecs,
      maxTokens,
    },
  })
}

export async function resolveSuperAdminEmail() {
  const primary = await db.user.findFirst({
    where: { email: env.ADMIN_EMAIL ?? "luckypal5002@gmail.com" },
    select: { id: true, email: true, name: true },
  })
  if (primary) return primary

  return db.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  })
}

async function resolveEmailReact(templateName: string, payload: Record<string, unknown>) {
  return renderEmailTemplate(templateName, payload)
}

export interface EnqueueEmailInput {
  emailType: EmailWorkflow
  recipient: string
  subject: string
  templateName: string
  payload: Record<string, unknown>
  priority?: number
  maxAttempts?: number
  userId?: string | null
  orderId?: string | null
  subscriptionId?: string | null
  productId?: string | null
  campaignId?: string | null
  sender?: string
  queueNow?: boolean
}

export async function enqueueEmail(input: EnqueueEmailInput) {
  const recipient = await validateEmailRecipient(input.recipient)
  const sender = input.sender ?? "noreply@nexusai.com"
  const payload = sanitizePayload(input.payload)

  if (await isSuppressed(recipient, input.emailType)) {
    const queue = await db.emailQueue.create({
      data: {
        emailType: input.emailType,
        recipient,
        sender,
        subject: input.subject,
        templateName: input.templateName,
        payload: payload as Prisma.InputJsonValue,
        status: "SUPPRESSED",
        priority: input.priority ?? 5,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 5,
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        productId: input.productId ?? null,
        campaignId: input.campaignId ?? null,
        lastError: "Recipient is suppressed",
      },
    })
    await db.emailLog.create({
      data: {
        queueId: queue.id,
        emailType: input.emailType,
        recipient,
        sender,
        provider: "RESEND",
        status: "SUPPRESSED",
        deliveryState: "DROPPED",
        failureReason: "Recipient is suppressed",
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        productId: input.productId ?? null,
      },
    })
    return queue
  }

  const bucketKey = `${input.userId ?? recipient}:${input.emailType}`
  await checkRateLimit(bucketKey, 3600, isTransactionalEmail(input.emailType) ? 20 : 10)

  const queue = await db.$transaction(async (tx) => {
    const created = await tx.emailQueue.create({
      data: {
        emailType: input.emailType,
        recipient,
        sender,
        subject: input.subject,
        templateName: input.templateName,
        payload: payload as Prisma.InputJsonValue,
        status: "PENDING",
        priority: input.priority ?? 5,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 5,
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        productId: input.productId ?? null,
        campaignId: input.campaignId ?? null,
      },
    })

    await tx.emailLog.create({
      data: {
        queueId: created.id,
        emailType: input.emailType,
        recipient,
        sender,
        provider: "RESEND",
        status: "PENDING",
        deliveryState: "QUEUED",
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        productId: input.productId ?? null,
      },
    })

    return created
  })

  await auditLog({
    userId: input.userId ?? undefined,
    action: "EMAIL_QUEUED",
    entity: "EmailQueue",
    entityId: queue.id,
    after: {
      emailType: input.emailType,
      recipient,
      subject: input.subject,
      campaignId: input.campaignId,
      orderId: input.orderId,
      subscriptionId: input.subscriptionId,
      productId: input.productId,
    },
  })

  if (input.queueNow === true) {
    await processEmailQueue(queue.id)
    return queue
  }

  await emailQueue.add(EMAIL_JOBS.PROCESS_QUEUE, { queueId: queue.id }, {
    jobId: `email-${queue.id}`,
    priority: input.priority ?? 5,
  }).catch((error) => {
    logger.warn({ error, queueId: queue.id }, "Email queue job could not be enqueued")
  })

  return queue
}

export async function processEmailQueue(queueId: string) {
  const queue = await db.emailQueue.findUnique({ where: { id: queueId } })
  if (!queue) throw new Error("EMAIL_QUEUE_NOT_FOUND")

  if (queue.status === "SENT" || queue.status === "SUPPRESSED") {
    return queue
  }

  const normalizedRecipient = queue.recipient.toLowerCase().trim()
  if (await isSuppressed(normalizedRecipient, queue.emailType as EmailWorkflow)) {
    await db.emailQueue.update({
      where: { id: queue.id },
      data: { status: "SUPPRESSED", lastError: "Recipient suppressed by suppression list" },
    })
    await db.emailLog.update({
      where: { queueId: queue.id },
      data: {
        status: "SUPPRESSED",
        deliveryState: "DROPPED",
        failureReason: "Recipient suppressed by suppression list",
        failedAt: new Date(),
      },
    })
    return queue
  }

  const emailLog = await db.emailLog.findUnique({ where: { queueId: queue.id } })
  if (!emailLog) throw new Error("EMAIL_LOG_NOT_FOUND")

  await db.emailQueue.update({
    where: { id: queue.id },
    data: { status: "SENDING", attempts: { increment: 1 } },
  })

  const attemptCount = queue.attempts + 1

  try {
    const react = await resolveEmailReact(queue.templateName, {
      ...queue.payload as Record<string, unknown>,
      recipient: queue.recipient,
      unsubscribeUrl: asString((queue.payload as any)?.unsubscribeUrl, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/email/unsubscribe?token=${(queue.payload as any)?.unsubscribeToken ?? ""}`),
    })

    const result = await sendEmail({
      to: queue.recipient,
      subject: queue.subject,
      react,
      replyTo: asString((queue.payload as any)?.replyTo, ""),
      tags: [
        { name: "emailType", value: queue.emailType },
        { name: "queueId", value: queue.id },
      ],
    })

    if (result.error) {
      throw new Error(result.error)
    }

    await db.emailQueue.update({
      where: { id: queue.id },
      data: {
        status: "SENT",
        lastError: null,
      },
    })

    await db.emailLog.update({
      where: { queueId: queue.id },
      data: {
        status: "SENT",
        deliveryState: "DELIVERED",
        providerMsgId: result.id ?? null,
        providerResponse: { id: result.id ?? null },
        retries: attemptCount,
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    })

    if (queue.campaignId) {
      await db.emailCampaign.update({
        where: { id: queue.campaignId },
        data: { sentCount: { increment: 1 } as any },
      }).catch(() => {})
    }

    await auditLog({
      userId: queue.userId ?? undefined,
      action: "EMAIL_SENT",
      entity: "EmailQueue",
      entityId: queue.id,
      after: { queueId: queue.id, providerMsgId: result.id, emailType: queue.emailType },
    })

    return queue
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_EMAIL_FAILURE"
    const nextRetry = attemptCount < queue.maxAttempts ? new Date(Date.now() + Math.min(2 ** attemptCount, 60) * 1000) : null
    const failed = attemptCount >= queue.maxAttempts

    await db.emailQueue.update({
      where: { id: queue.id },
      data: {
        status: failed ? "FAILED" : "RETRYING",
        lastError: message,
        nextRetryAt: nextRetry,
      },
    })

    await db.emailLog.update({
      where: { queueId: queue.id },
      data: {
        status: failed ? "FAILED" : "RETRYING",
        deliveryState: failed ? "DROPPED" : "QUEUED",
        failureReason: message,
        retries: attemptCount,
        failedAt: failed ? new Date() : undefined,
      },
    })

    await auditLog({
      userId: queue.userId ?? undefined,
      action: failed ? "EMAIL_FAILED" : "EMAIL_RETRYING",
      entity: "EmailQueue",
      entityId: queue.id,
      after: { queueId: queue.id, error: message, attemptCount },
    })

    if (failed) {
      const admin = await resolveSuperAdminEmail()
      if (admin?.id) {
        await createNotification({
          userId: admin.id,
          type: "SYSTEM",
          title: "Email delivery failures exceeded threshold",
          body: `Email ${queue.emailType} to ${queue.recipient} failed after ${queue.maxAttempts} attempts.`,
          actionUrl: "/admin/emails",
          metadata: { queueId: queue.id, emailType: queue.emailType, failureReason: message },
        }).catch(() => {})
      }
    }

    return queue
  }
}

export async function scheduleEmailCampaign(campaignId: string) {
  const campaign = await db.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { createdByAdmin: true },
  })
  if (!campaign) throw new Error("EMAIL_CAMPAIGN_NOT_FOUND")

  const recipients = await resolveAudienceRecipients(campaign)
  const queues = await Promise.all(recipients.map((recipient) =>
    enqueueEmail({
      emailType: campaign.templateName as EmailWorkflow,
      recipient: recipient.email,
      subject: campaign.subject,
      templateName: campaign.templateName,
      payload: {
        ...(campaign.payload as Record<string, unknown>),
        name: recipient.name ?? "there",
        email: recipient.email,
        unsubscribeToken: recipient.unsubscribeToken,
      },
      userId: recipient.id,
      campaignId: campaign.id,
      priority: 5,
    })
  ))

  await db.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "SENDING",
      totalRecipients: queues.length,
      sentCount: 0,
    },
  })

  return { campaign, queues }
}

export async function sendEmailPreview(templateName: string, payload: Record<string, unknown>) {
  return resolveEmailReact(templateName, payload)
}

export async function resolveAudienceRecipients(campaign: {
  audienceType: EmailAudienceType
  audienceFilter?: unknown
}) {
  const filter = (campaign.audienceFilter as Record<string, any> | null) ?? {}
  const seen = new Map<string, { id: string; email: string; name: string | null; role: Role; unsubscribeToken: string }>()

  const pushUsers = async (users: Array<{ id: string; email: string; name: string | null; role: Role }>) => {
    const preferences = await Promise.all(users.map((user) => ensureEmailPreference(user.id).catch(() => null)))
    for (let i = 0; i < users.length; i += 1) {
      const user = users[i]
      const preference = preferences[i]
      if (!user.email) continue
      seen.set(user.email.toLowerCase(), {
        ...user,
        unsubscribeToken: preference?.unsubscribeToken ?? randomUUID(),
      })
    }
  }

  if (campaign.audienceType === "ALL_USERS") {
    await pushUsers(await db.user.findMany({ select: { id: true, email: true, name: true, role: true } }))
  }

  if (campaign.audienceType === "ACTIVE_SUBSCRIBERS") {
    const subscriptions = await db.subscription.findMany({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      select: { user: { select: { id: true, email: true, name: true, role: true } } },
      distinct: ["userId"],
    })
    await pushUsers(subscriptions.map((item) => item.user))
  }

  if (campaign.audienceType === "EXPIRED_SUBSCRIBERS") {
    const subscriptions = await db.subscription.findMany({
      where: { OR: [{ status: { not: "ACTIVE" } }, { currentPeriodEnd: { lte: new Date() } }] },
      select: { user: { select: { id: true, email: true, name: true, role: true } } },
      distinct: ["userId"],
    })
    await pushUsers(subscriptions.map((item) => item.user))
  }

  if (campaign.audienceType === "BY_PRODUCT") {
    const productIds = Array.isArray(filter.productIds) ? filter.productIds : []
    if (productIds.length > 0) {
      const subscriptions = await db.subscription.findMany({
        where: { productId: { in: productIds } },
        select: { user: { select: { id: true, email: true, name: true, role: true } } },
        distinct: ["userId"],
      })
      await pushUsers(subscriptions.map((item) => item.user))
    }
  }

  if (campaign.audienceType === "BY_PLAN") {
    const tierIds = Array.isArray(filter.tierIds) ? filter.tierIds : []
    const planTypes = Array.isArray(filter.planTypes) ? filter.planTypes : []
    const subscriptions = await db.subscription.findMany({
      where: {
        OR: [
          tierIds.length > 0 ? { tierId: { in: tierIds } } : undefined,
          planTypes.length > 0 ? { tier: { interval: { in: planTypes } } } : undefined,
        ].filter(Boolean) as any,
      },
      select: { user: { select: { id: true, email: true, name: true, role: true } } },
      distinct: ["userId"],
    })
    await pushUsers(subscriptions.map((item) => item.user))
  }

  if (campaign.audienceType === "BY_ROLE") {
    const roles = Array.isArray(filter.roles) ? filter.roles : []
    if (roles.length > 0) {
      await pushUsers(await db.user.findMany({
        where: { role: { in: roles } as any },
        select: { id: true, email: true, name: true, role: true },
      }))
    }
  }

  if (campaign.audienceType === "INDIVIDUAL") {
    const userIds = Array.isArray(filter.userIds) ? filter.userIds : []
    if (userIds.length > 0) {
      await pushUsers(await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true, role: true },
      }))
    }
  }

  return Array.from(seen.values())
}

export async function createEmailCampaign(data: {
  name: string
  subject: string
  templateName: string
  payload?: Record<string, unknown>
  audienceType: EmailAudienceType
  audienceFilter?: Record<string, unknown> | null
  scheduledAt?: Date | null
  status?: EmailCampaignStatus
  createdByAdminId: string
}) {
  const campaign = await db.emailCampaign.create({
    data: {
      name: data.name,
      subject: data.subject,
      templateName: data.templateName,
      // Prisma JSON fields need explicit JSON-safe typing
      payload: sanitizePayload(data.payload ?? {}) as Prisma.InputJsonValue,
      audienceType: data.audienceType,
      audienceFilter: (data.audienceFilter ?? undefined) as Prisma.InputJsonValue | undefined,
      scheduledAt: data.scheduledAt ?? null,
      status: data.status ?? "DRAFT",
      createdByAdminId: data.createdByAdminId,
    },
  })

  await auditLog({
    userId: data.createdByAdminId,
    action: "EMAIL_CAMPAIGN_CREATED",
    entity: "EmailCampaign",
    entityId: campaign.id,
    after: campaign,
  })

  return campaign
}

export async function updateEmailDeliveryState(params: {
  queueId: string
  provider?: EmailProviderName
  status?: EmailStatus
  deliveryState?: DeliveryState
  providerMsgId?: string | null
  providerResponse?: Record<string, unknown> | null
  failureReason?: string | null
  eventType?: "open" | "click" | "bounce" | "complaint" | "delivered"
}) {
  const queue = await db.emailQueue.findUnique({ where: { id: params.queueId } })
  if (!queue) return null

  const now = new Date()
  const update: Record<string, unknown> = {}

  if (params.status) update.status = params.status
  if (params.deliveryState) update.deliveryState = params.deliveryState
  if (params.providerMsgId !== undefined) update.providerMsgId = params.providerMsgId
  if (params.providerResponse !== undefined) update.providerResponse = params.providerResponse
  if (params.failureReason !== undefined) update.failureReason = params.failureReason

  if (params.eventType === "open") update.openedAt = now
  if (params.eventType === "click") update.clickedAt = now
  if (params.eventType === "delivered") update.deliveredAt = now
  if (params.eventType === "bounce" || params.eventType === "complaint") update.failedAt = now

  const [queueResult] = await Promise.all([
    db.emailLog.update({
      where: { queueId: params.queueId },
      data: {
        ...(params.provider ? { provider: params.provider } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.deliveryState ? { deliveryState: params.deliveryState } : {}),
        ...(params.providerMsgId !== undefined ? { providerMsgId: params.providerMsgId } : {}),
        ...(params.providerResponse !== undefined ? { providerResponse: params.providerResponse as any } : {}),
        ...(params.failureReason !== undefined ? { failureReason: params.failureReason } : {}),
        ...(params.eventType === "open" ? { openedAt: now } : {}),
        ...(params.eventType === "click" ? { clickedAt: now } : {}),
        ...(params.eventType === "delivered" ? { deliveredAt: now } : {}),
        ...(params.eventType === "bounce" || params.eventType === "complaint" ? { failedAt: now } : {}),
      },
    }).catch(() => null),
    db.emailQueue.update({
      where: { id: params.queueId },
      data: update,
    }),
  ])

  if (queue.campaignId) {
    const campaignUpdate: Record<string, unknown> = {}
    if (params.eventType === "delivered") campaignUpdate.deliveredCount = { increment: 1 }
    if (params.eventType === "open") campaignUpdate.openedCount = { increment: 1 }
    if (params.eventType === "click") campaignUpdate.clickedCount = { increment: 1 }
    if (params.eventType === "bounce") campaignUpdate.bouncedCount = { increment: 1 }
    if (params.eventType === "complaint") campaignUpdate.unsubscribeCount = { increment: 1 }

    if (Object.keys(campaignUpdate).length > 0) {
      await db.emailCampaign.update({
        where: { id: queue.campaignId },
        data: campaignUpdate as any,
      }).catch(() => {})
    }

    const campaign = await db.emailCampaign.findUnique({ where: { id: queue.campaignId } }).catch(() => null)
    if (campaign && campaign.totalRecipients > 0) {
      const completed = campaign.sentCount + campaign.bouncedCount >= campaign.totalRecipients
      if (completed && campaign.status !== "SENT") {
        await db.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: "SENT", sentAt: campaign.sentAt ?? new Date() },
        }).catch(() => {})
      }
    }
  }

  if ((params.eventType === "bounce" || params.eventType === "complaint") && queue.recipient) {
    await db.emailSuppression.upsert({
      where: { email: queue.recipient.toLowerCase() },
      create: {
        email: queue.recipient.toLowerCase(),
        reason: params.eventType === "bounce" ? "HARD_BOUNCE" : "SPAM_COMPLAINT",
        emailTypes: [],
        source: "resend-webhook",
      },
      update: {
        reason: params.eventType === "bounce" ? "HARD_BOUNCE" : "SPAM_COMPLAINT",
        emailTypes: [],
        source: "resend-webhook",
      },
    })
  }

  return queueResult
}
