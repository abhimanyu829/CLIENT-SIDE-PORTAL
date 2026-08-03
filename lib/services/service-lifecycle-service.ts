import { db } from "@/lib/db"
import { encrypt, decrypt } from "@/lib/encryption"
import { createNotification } from "@/lib/notifications"
import { getPusherServer } from "@/lib/pusher"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import type {
  PurchasedServiceStatus,
  ServiceDeploymentStatus,
  Prisma,
} from "@prisma/client"

// ── Customer Service Management Platform — lifecycle engine ──────────────────
// Single source of truth for every purchased-service state change.
// Customer workspaces and admin panels only READ state produced here.

export const DEPLOYMENT_STEPS: ServiceDeploymentStatus[] = [
  "PENDING",
  "PREPARING",
  "DEPLOYING",
  "DATABASE_CONFIG",
  "GENERATING_CREDENTIALS",
  "QUALITY_CHECK",
  "COMPLETED",
]

export const TIMELINE = {
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  DEPLOYMENT_QUEUED: "DEPLOYMENT_QUEUED",
  DEPLOYMENT_STARTED: "DEPLOYMENT_STARTED",
  DEPLOYMENT_STATUS: "DEPLOYMENT_STATUS",
  DEPLOYMENT_COMPLETED: "DEPLOYMENT_COMPLETED",
  DEPLOYMENT_FAILED: "DEPLOYMENT_FAILED",
  CREDENTIALS_GENERATED: "CREDENTIALS_GENERATED",
  SERVICE_ACTIVATED: "SERVICE_ACTIVATED",
  CONFIG_UPDATED: "CONFIG_UPDATED",
  LIFECYCLE_ACTION: "LIFECYCLE_ACTION",
  UPGRADE_PURCHASED: "UPGRADE_PURCHASED",
  UPGRADE_APPLIED: "UPGRADE_APPLIED",
  RENEWAL_COMPLETED: "RENEWAL_COMPLETED",
  RENEWAL_REQUESTED: "RENEWAL_REQUESTED",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  RENEWAL_REMINDER: "RENEWAL_REMINDER",
  SUPPORT_REQUEST: "SUPPORT_REQUEST",
  SERVICE_TRANSFERRED: "SERVICE_TRANSFERRED",
  SERVICE_CLONED: "SERVICE_CLONED",
} as const

const SENSITIVE_CONFIG_KEYS = ["password", "temporaryPassword", "dbPassword"] as const

// ── Config encryption helpers ────────────────────────────────────────────────

function encryptConfig(config: Record<string, any>): Record<string, any> {
  const out = { ...config }
  for (const key of SENSITIVE_CONFIG_KEYS) {
    const value = out[key]
    if (typeof value === "string" && value.length > 0 && !value.startsWith("enc:")) {
      out[key] = `enc:${encrypt(value)}`
    }
  }
  return out
}

export function decryptConfig(config: any): Record<string, any> {
  if (!config || typeof config !== "object") return {}
  const out: Record<string, any> = { ...config }
  for (const key of SENSITIVE_CONFIG_KEYS) {
    const value = out[key]
    if (typeof value === "string" && value.startsWith("enc:")) {
      try {
        out[key] = decrypt(value.slice(4))
      } catch {
        out[key] = ""
      }
    }
  }
  return out
}

// ── Timeline + realtime primitives ───────────────────────────────────────────

export async function addTimelineEvent(
  purchasedServiceId: string,
  type: string,
  message: string,
  metadata: Record<string, any> = {},
  actorId?: string,
) {
  await db.serviceTimelineEvent.create({
    data: { purchasedServiceId, type, message, metadata, actorId },
  })
}

async function pushServiceUpdate(userId: string, purchasedServiceId: string, payload: Record<string, any>) {
  try {
    const pusher = await getPusherServer()
    await pusher.trigger(`private-user-${userId}`, "service-update", {
      purchasedServiceId,
      ...payload,
    })
  } catch {
    // Pusher unconfigured — clients fall back to polling
  }
}

function queueEmail(job: string, data: Record<string, any>) {
  // Fire-and-forget; queue no-ops when REDIS_URL is unset
  emailQueue.add(job, data).catch(() => {})
}

async function notifyCustomer(
  userId: string,
  title: string,
  body: string,
  actionUrl?: string,
  metadata?: Record<string, any>,
) {
  await createNotification({ userId, title, body, type: "SUBSCRIPTION", actionUrl, metadata }).catch(() => {})
}

// ── Queue position (dynamic: deployments ahead of this one) ─────────────────

export async function getQueuePosition(deployment: { status: ServiceDeploymentStatus; createdAt: Date }) {
  if (deployment.status === "COMPLETED" || deployment.status === "FAILED") return 0
  return db.serviceDeployment.count({
    where: {
      status: { notIn: ["COMPLETED", "FAILED"] },
      createdAt: { lt: deployment.createdAt },
    },
  })
}

// ── Creation: hook point after payment ───────────────────────────────────────

export async function createPurchasedServicesForOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { tier: true } }, purchasedServices: true },
  })
  if (!order) return

  const existingItemIds = new Set(order.purchasedServices.map((s) => s.orderItemId))

  for (const item of order.items) {
    if (existingItemIds.has(item.id)) continue // idempotent

    const interval = item.tier?.interval
    const expiryDate = computeExpiry(interval)

    const service = await db.purchasedService.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        orderItemId: item.id,
        productId: item.productId,
        tierId: item.tierId,
        status: "PENDING_DEPLOYMENT",
        expiryDate,
        renewalDate: expiryDate,
        deployment: { create: { status: "PENDING", statusHistory: [{ status: "PENDING", at: new Date().toISOString() }] } },
        timeline: {
          create: [
            { type: TIMELINE.PAYMENT_RECEIVED, message: `Payment received for ${item.name}`, metadata: { orderId: order.id, orderNumber: order.orderNumber } },
            { type: TIMELINE.DEPLOYMENT_QUEUED, message: "Deployment request queued", metadata: {} },
          ],
        },
      },
      include: { deployment: true },
    })

    await notifyCustomer(
      order.userId,
      "Service purchased",
      `${item.name} has been purchased. Our deployment team is preparing your service.`,
      `/dashboard/services/${service.id}`,
      { purchasedServiceId: service.id },
    )
    await pushServiceUpdate(order.userId, service.id, { status: service.status, deploymentStatus: "PENDING" })
  }
}

function computeExpiry(interval?: string | null): Date | null {
  const now = new Date()
  switch (interval) {
    case "WEEKLY":
      return new Date(now.getTime() + 7 * 86400000)
    case "MONTHLY":
      return new Date(now.getTime() + 30 * 86400000)
    case "QUARTERLY":
      return new Date(now.getTime() + 90 * 86400000)
    case "SEMI_ANNUAL":
      return new Date(now.getTime() + 182 * 86400000)
    case "YEARLY":
      return new Date(now.getTime() + 365 * 86400000)
    default:
      return null // ONE_TIME / LIFETIME / unknown — no expiry
  }
}

// ── Deployment workflow (admin) ──────────────────────────────────────────────

export async function advanceDeploymentStatus(
  purchasedServiceId: string,
  status: ServiceDeploymentStatus,
  adminId: string,
  notes?: string,
) {
  const service = await db.purchasedService.findUnique({
    where: { id: purchasedServiceId },
    include: { deployment: true, orderItem: { select: { name: true } } },
  })
  if (!service?.deployment) throw new Error("Service or deployment not found")

  const current = service.deployment.status
  if (current === "COMPLETED" || current === "FAILED") throw new Error("Deployment already finalized")

  if (status !== "FAILED") {
    const currentIdx = DEPLOYMENT_STEPS.indexOf(current)
    const nextIdx = DEPLOYMENT_STEPS.indexOf(status)
    if (nextIdx <= currentIdx) throw new Error(`Cannot move deployment from ${current} back to ${status}`)
  }

  const history = Array.isArray(service.deployment.statusHistory) ? (service.deployment.statusHistory as any[]) : []
  history.push({ status, at: new Date().toISOString(), by: adminId })

  const isStart = current === "PENDING"
  const serviceStatus: PurchasedServiceStatus = status === "COMPLETED" ? "ACTIVE" : status === "FAILED" ? "PENDING_DEPLOYMENT" : "DEPLOYING"

  await db.$transaction(
    async (tx) => {
      await tx.serviceDeployment.update({
        where: { id: service.deployment.id },
        data: {
          status,
          statusHistory: history,
          startedAt: service.deployment.startedAt ?? (isStart ? new Date() : undefined),
          completedAt: status === "COMPLETED" || status === "FAILED" ? new Date() : undefined,
          adminNotes: notes ?? undefined,
        },
      })
      await tx.purchasedService.update({
        where: { id: purchasedServiceId },
        data: {
          status: serviceStatus,
          activationDate: status === "COMPLETED" ? new Date() : undefined,
        },
      })
    },
    { timeout: 30_000 },
  )

  const stepLabel = status.replace(/_/g, " ").toLowerCase()
  await addTimelineEvent(
    purchasedServiceId,
    isStart ? TIMELINE.DEPLOYMENT_STARTED : status === "COMPLETED" ? TIMELINE.DEPLOYMENT_COMPLETED : status === "FAILED" ? TIMELINE.DEPLOYMENT_FAILED : TIMELINE.DEPLOYMENT_STATUS,
    status === "COMPLETED" ? "Deployment completed" : status === "FAILED" ? "Deployment failed" : `Deployment status: ${stepLabel}`,
    { status, notes },
    adminId,
  )

  if (isStart) {
    queueEmail(EMAIL_JOBS.SEND_DEPLOYMENT_STARTED, { userId: service.userId, serviceName: service.orderItem.name, purchasedServiceId })
    await notifyCustomer(service.userId, "Deployment started", `Deployment of ${service.orderItem.name} has started.`, `/dashboard/services/${purchasedServiceId}`)
  }

  await pushServiceUpdate(service.userId, purchasedServiceId, { status: serviceStatus, deploymentStatus: status })
}

export async function completeDeployment(
  purchasedServiceId: string,
  config: Record<string, any>,
  adminId: string,
  notes?: string,
) {
  await updateServiceConfig(purchasedServiceId, config, adminId, false)
  await advanceDeploymentStatus(purchasedServiceId, "COMPLETED", adminId, notes)

  const service = await db.purchasedService.findUnique({
    where: { id: purchasedServiceId },
    include: { orderItem: { select: { name: true } } },
  })
  if (!service) return

  await addTimelineEvent(purchasedServiceId, TIMELINE.CREDENTIALS_GENERATED, "Service credentials generated", {}, adminId)
  await addTimelineEvent(purchasedServiceId, TIMELINE.SERVICE_ACTIVATED, "Service activated", {}, adminId)

  queueEmail(EMAIL_JOBS.SEND_DEPLOYMENT_COMPLETED, { userId: service.userId, serviceName: service.orderItem.name, purchasedServiceId })
  queueEmail(EMAIL_JOBS.SEND_SERVICE_ACTIVATED, { userId: service.userId, serviceName: service.orderItem.name, purchasedServiceId })
  await notifyCustomer(
    service.userId,
    "Service is live",
    `${service.orderItem.name} has been deployed and activated. View your credentials in the workspace.`,
    `/dashboard/services/${purchasedServiceId}`,
  )
}

// ── Configuration panel (admin) ──────────────────────────────────────────────

export async function updateServiceConfig(
  purchasedServiceId: string,
  config: Record<string, any>,
  adminId: string,
  logEvent = true,
) {
  const service = await db.purchasedService.findUnique({ where: { id: purchasedServiceId } })
  if (!service) throw new Error("Service not found")

  const existing = (service.config as Record<string, any>) ?? {}
  const merged = encryptConfig({ ...existing, ...config })

  const data: Prisma.PurchasedServiceUpdateInput = { config: merged }
  if (typeof config.expiryDate === "string" && config.expiryDate) data.expiryDate = new Date(config.expiryDate)
  if (typeof config.renewalDate === "string" && config.renewalDate) data.renewalDate = new Date(config.renewalDate)

  await db.purchasedService.update({ where: { id: purchasedServiceId }, data })

  if (logEvent) {
    await addTimelineEvent(purchasedServiceId, TIMELINE.CONFIG_UPDATED, "Service configuration updated", { keys: Object.keys(config) }, adminId)
  }
  await pushServiceUpdate(service.userId, purchasedServiceId, { status: service.status, configUpdated: true })
}

// ── Lifecycle control panel (admin) ──────────────────────────────────────────

export type LifecycleAction =
  | "START" | "STOP" | "PAUSE" | "RESUME" | "RESTART"
  | "SUSPEND" | "ACTIVATE" | "DEACTIVATE" | "CONTINUE"
  | "DELETE" | "ARCHIVE" | "TRANSFER" | "CLONE"
  | "RENEW" | "EXTEND"

const ACTION_STATUS: Partial<Record<LifecycleAction, PurchasedServiceStatus>> = {
  START: "ACTIVE",
  RESUME: "ACTIVE",
  ACTIVATE: "ACTIVE",
  CONTINUE: "ACTIVE",
  RESTART: "ACTIVE",
  STOP: "PAUSED",
  PAUSE: "PAUSED",
  SUSPEND: "SUSPENDED",
  DEACTIVATE: "SUSPENDED",
  DELETE: "DELETED",
  ARCHIVE: "ARCHIVED",
}

export async function runLifecycleAction(
  purchasedServiceId: string,
  action: LifecycleAction,
  adminId: string,
  options: { newUserId?: string; days?: number; reason?: string } = {},
) {
  const service = await db.purchasedService.findUnique({
    where: { id: purchasedServiceId },
    include: { orderItem: { select: { name: true } }, deployment: true },
  })
  if (!service) throw new Error("Service not found")

  const label = action.charAt(0) + action.slice(1).toLowerCase()

  if (action === "TRANSFER") {
    if (!options.newUserId) throw new Error("newUserId required for transfer")
    const target = await db.user.findUnique({ where: { id: options.newUserId }, select: { id: true } })
    if (!target) throw new Error("Target user not found")
    await db.purchasedService.update({ where: { id: purchasedServiceId }, data: { userId: options.newUserId } })
    await addTimelineEvent(purchasedServiceId, TIMELINE.SERVICE_TRANSFERRED, `Service transferred to another account`, { fromUserId: service.userId, toUserId: options.newUserId }, adminId)
    await pushServiceUpdate(service.userId, purchasedServiceId, { status: service.status, transferred: true })
    await pushServiceUpdate(options.newUserId, purchasedServiceId, { status: service.status, transferred: true })
    return
  }

  if (action === "CLONE") {
    const clone = await db.purchasedService.create({
      data: {
        userId: service.userId,
        orderId: service.orderId,
        orderItemId: service.orderItemId,
        productId: service.productId,
        tierId: service.tierId,
        status: "PENDING_DEPLOYMENT",
        expiryDate: service.expiryDate,
        renewalDate: service.renewalDate,
        config: service.config ?? {},
        deployment: { create: { status: "PENDING", statusHistory: [{ status: "PENDING", at: new Date().toISOString() }] } },
        timeline: { create: [{ type: TIMELINE.SERVICE_CLONED, message: `Cloned from service ${service.id}`, metadata: { sourceId: service.id }, actorId: adminId }] },
      },
    })
    await addTimelineEvent(purchasedServiceId, TIMELINE.SERVICE_CLONED, `Service cloned (new instance ${clone.id})`, { cloneId: clone.id }, adminId)
    await pushServiceUpdate(service.userId, clone.id, { status: "PENDING_DEPLOYMENT", deploymentStatus: "PENDING" })
    return { cloneId: clone.id }
  }

  if (action === "RENEW" || action === "EXTEND") {
    const days = options.days ?? 30
    const base = service.expiryDate && service.expiryDate > new Date() ? service.expiryDate : new Date()
    const newExpiry = new Date(base.getTime() + days * 86400000)
    await db.purchasedService.update({
      where: { id: purchasedServiceId },
      data: { expiryDate: newExpiry, renewalDate: newExpiry, status: service.status === "EXPIRED" || service.status === "PAUSED" ? "ACTIVE" : service.status, renewalReminderSentAt: null },
    })
    await addTimelineEvent(purchasedServiceId, TIMELINE.RENEWAL_COMPLETED, `Subscription ${action === "RENEW" ? "renewed" : "extended"} by ${days} days`, { days, newExpiry: newExpiry.toISOString(), reason: options.reason }, adminId)
    await notifyCustomer(service.userId, "Subscription renewed", `${service.orderItem.name} now runs until ${newExpiry.toDateString()}.`, `/dashboard/services/${purchasedServiceId}`)
    await pushServiceUpdate(service.userId, purchasedServiceId, { status: "ACTIVE", expiryDate: newExpiry.toISOString() })
    return { newExpiry }
  }

  const nextStatus = ACTION_STATUS[action]
  if (!nextStatus) throw new Error(`Unsupported action ${action}`)

  await db.purchasedService.update({ where: { id: purchasedServiceId }, data: { status: nextStatus } })
  await addTimelineEvent(purchasedServiceId, TIMELINE.LIFECYCLE_ACTION, `Service ${label.toLowerCase()}d by admin`, { action, previousStatus: service.status, reason: options.reason }, adminId)

  if (action === "SUSPEND" || action === "DEACTIVATE") {
    queueEmail(EMAIL_JOBS.SEND_SERVICE_SUSPENDED, { userId: service.userId, serviceName: service.orderItem.name, purchasedServiceId, reason: options.reason })
    await notifyCustomer(service.userId, "Service suspended", `${service.orderItem.name} has been suspended. Contact support for details.`, `/dashboard/services/${purchasedServiceId}`)
  }
  if ((action === "RESUME" || action === "ACTIVATE" || action === "START") && service.status === "SUSPENDED") {
    queueEmail(EMAIL_JOBS.SEND_SERVICE_REACTIVATED, { userId: service.userId, serviceName: service.orderItem.name, purchasedServiceId })
    await notifyCustomer(service.userId, "Service reactivated", `${service.orderItem.name} is active again.`, `/dashboard/services/${purchasedServiceId}`)
  }

  await pushServiceUpdate(service.userId, purchasedServiceId, { status: nextStatus })
}

// ── Upgrades ─────────────────────────────────────────────────────────────────

export async function applyUpgrade(upgradeId: string, adminId: string) {
  const upgrade = await db.serviceUpgrade.findUnique({
    where: { id: upgradeId },
    include: { purchasedService: { include: { orderItem: { select: { name: true } } } }, user: { select: { id: true } } },
  })
  if (!upgrade) throw new Error("Upgrade not found")
  if (upgrade.status === "APPLIED") return

  await db.serviceUpgrade.update({
    where: { id: upgradeId },
    data: { status: "APPLIED", appliedAt: new Date(), appliedBy: adminId },
  })

  const snapshot = (upgrade.snapshot as Record<string, any>) ?? {}
  const service = upgrade.purchasedService
  const config = (service.config as Record<string, any>) ?? {}
  const applied = Array.isArray(config.appliedUpgrades) ? (config.appliedUpgrades as any[]) : []
  applied.push({ addonId: upgrade.addonId, name: snapshot.name, specs: snapshot.specs ?? {}, appliedAt: new Date().toISOString() })
  await db.purchasedService.update({
    where: { id: service.id },
    data: { config: { ...config, appliedUpgrades: applied } },
  })

  await addTimelineEvent(service.id, TIMELINE.UPGRADE_APPLIED, `Upgrade applied: ${snapshot.name ?? "add-on"}`, { upgradeId, addonId: upgrade.addonId }, adminId)
  queueEmail(EMAIL_JOBS.SEND_UPGRADE_APPLIED, { userId: upgrade.userId, serviceName: service.orderItem.name, addonName: snapshot.name, purchasedServiceId: service.id })
  await notifyCustomer(upgrade.userId, "Upgrade applied", `${snapshot.name ?? "Your add-on"} is now active on ${service.orderItem.name}.`, `/dashboard/services/${service.id}`)
  await pushServiceUpdate(upgrade.userId, service.id, { status: service.status, upgradeApplied: upgrade.addonId })
}

// ── Expiry sweep (cron): expired services pause; data is never deleted ───────

export async function expireServices() {
  const expired = await db.purchasedService.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] }, expiryDate: { lt: new Date() } },
    include: { orderItem: { select: { name: true } } },
  })
  for (const service of expired) {
    await db.purchasedService.update({ where: { id: service.id }, data: { status: "EXPIRED" } })
    await addTimelineEvent(service.id, TIMELINE.SUBSCRIPTION_EXPIRED, "Subscription expired — service paused", {})
    queueEmail(EMAIL_JOBS.SEND_SERVICE_SUSPENDED, { userId: service.userId, serviceName: service.orderItem.name, purchasedServiceId: service.id, reason: "Subscription expired" })
    await notifyCustomer(service.userId, "Subscription expired", `${service.orderItem.name} has been paused. Renew to restore access.`, `/dashboard/services/${service.id}`)
    await pushServiceUpdate(service.userId, service.id, { status: "EXPIRED" })
  }
  return expired.length
}
