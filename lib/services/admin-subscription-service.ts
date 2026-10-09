/**
 * lib/services/admin-subscription-service.ts
 *
 * Phase 8 — SUPER_ADMIN subscription governance read/query layer.
 * Read-only builders over trusted Phases 1-7 records. No mutations here;
 * mutations happen only through the existing domain services in the routes.
 * Never returns provider secrets or raw webhook payloads.
 */

import { db } from "@/lib/db"

const SEARCH_LIKE_NAMES = ["Subscription", "UserSubscription", "PlanVersion", "Entitlement", "TrialEnrollment", "FreeEnrollment"]
const SEARCH_LIKE_PREFIXES = ["SUBSCRIPTION", "TRIAL", "FREE", "PLAN", "ENTITLEMENT", "RAZORPAY", "PROVISIONING"]

export interface GovernanceMetrics {
  paidActive: number
  pendingActivation: number
  pastDue: number
  paused: number
  expired: number
  scheduledCancellations: number
  activeTrials: number
  trialsExpiringSoon: number
  freeEnrollments: number
  provisioningFailures: number
  chargeFailures: number
  webhookFailures: number
  totalSubscriptions: number
}

export async function getGovernanceMetrics(): Promise<GovernanceMetrics> {
  const now = new Date()
  const soon = new Date(now.getTime() + 7 * 86400_000)
  const [paidActive, pendingActivation, pastDue, paused, expired, scheduled, trialsActive, trialsSoon, free, provFail, chargeFail, webhookFail, total] =
    await Promise.all([
      db.userSubscription.count({ where: { status: "ACTIVE" } }),
      db.userSubscription.count({ where: { status: { in: ["TRIALING", "UNPAID"] } } }),
      db.userSubscription.count({ where: { status: "PAST_DUE" } }),
      db.userSubscription.count({ where: { status: "PAUSED" } }),
      db.userSubscription.count({ where: { status: "EXPIRED" } }),
      db.userSubscription.count({ where: { cancelAtPeriodEnd: true, status: { in: ["ACTIVE", "TRIALING", "UNPAID", "PAST_DUE", "PAUSED"] } } }),
      db.trialEnrollment.count({ where: { status: "ACTIVE" } }),
      db.trialEnrollment.count({ where: { status: "ACTIVE", expiresAt: { lte: soon } } }),
      db.freeEnrollment.count({ where: { status: "ACTIVE" } }),
      db.subscriptionProvisioning.count({ where: { status: { in: ["FAILED_RETRYABLE", "FAILED_PERMANENT"] } } }),
      db.subscriptionCharge.count({ where: { chargeStatus: "FAILED" } }),
      db.webhookEvent.count({ where: { source: "RAZORPAY", status: "FAILED" } }),
      db.userSubscription.count(),
    ])
  return {
    paidActive,
    pendingActivation,
    pastDue,
    paused,
    expired,
    scheduledCancellations: scheduled,
    activeTrials: trialsActive,
    trialsExpiringSoon: trialsSoon,
    freeEnrollments: free,
    provisioningFailures: provFail,
    chargeFailures: chargeFail,
    webhookFailures: webhookFail,
    totalSubscriptions: total,
  }
}

export interface AdminSubscriptionRow {
  id: string
  status: string
  planId: string
  planName: string | null
  planType: string | null
  planVersionId: string | null
  billingIntervalMonths: number | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  razorpaySubscriptionId: string | null
  userId: string
  customerName: string | null
  customerEmail: string | null
  createdAt: string
}

const SORT_FIELDS = new Set(["createdAt", "currentPeriodEnd", "status"])

export interface AdminSubscriptionsQuery {
  page: number
  pageSize: number
  status?: string
  planType?: string
  search?: string
  sortField: keyof AdminSubscriptionRow
  sortDir: "asc" | "desc"
}

export async function listAdminSubscriptions(q: AdminSubscriptionsQuery): Promise<{ items: AdminSubscriptionRow[]; total: number }> {
  const page = Math.max(1, q.page)
  const pageSize = Math.min(50, Math.max(1, q.pageSize))
  const where: Record<string, unknown> = {}
  if (q.status) where.status = q.status
  if (q.planType) where.plan = { planType: q.planType }
  if (q.search) {
    where.OR = [
      { id: { contains: q.search, mode: "insensitive" } },
      { razorpaySubscriptionId: { contains: q.search, mode: "insensitive" } },
      { user: { name: { contains: q.search, mode: "insensitive" } } },
      { user: { email: { contains: q.search, mode: "insensitive" } } },
    ]
  }
  const sortField = SORT_FIELDS.has(q.sortField) ? q.sortField : "createdAt"
  const sortDir = q.sortDir === "asc" ? "asc" : "desc"

  const [rows, total] = await Promise.all([
    db.userSubscription.findMany({
      where: where as never,
      include: { plan: { select: { id: true, name: true, planType: true, billingIntervalMonths: true } }, user: { select: { name: true, email: true } } },
      orderBy: [{ [sortField]: sortDir } as never],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.userSubscription.count({ where: where as never }),
  ])

  const items: AdminSubscriptionRow[] = rows.map((s) => ({
    id: s.id,
    status: s.status,
    planId: s.planId,
    planName: s.plan?.name ?? null,
    planType: s.plan?.planType ?? null,
    planVersionId: s.planVersionId,
    billingIntervalMonths: s.plan?.billingIntervalMonths ?? null,
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    razorpaySubscriptionId: s.razorpaySubscriptionId,
    userId: s.userId,
    customerName: s.user?.name ?? null,
    customerEmail: s.user?.email ?? null,
    createdAt: s.createdAt.toISOString(),
  }))
  return { items, total }
}

export async function getAdminSubscriptionDetail(id: string) {
  const sub = await db.userSubscription.findUnique({
    where: { id },
    include: {
      plan: { select: { id: true, name: true, planType: true, currency: true, billingIntervalMonths: true } },
      user: { select: { id: true, name: true, email: true, isBanned: true } },
      charges: { orderBy: { createdAt: "desc" }, take: 10 },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  })
  if (!sub) return null

  const [grants, provisionings, audits] = await Promise.all([
    db.entitlementGrant.findMany({
      where: { subjectType: "USER", subjectUserId: sub.userId, sourceType: "SUBSCRIPTION", sourceReference: sub.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.subscriptionProvisioning.findMany({ where: { subscriptionId: sub.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.auditLog.findMany({
      where: { OR: [{ entityId: sub.id }, { action: { contains: "SUBSCRIPTION" } }] },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  return {
    subscription: {
      id: sub.id,
      status: sub.status,
      planId: sub.planId,
      planName: sub.plan?.name ?? null,
      planType: sub.plan?.planType ?? null,
      planVersionId: sub.planVersionId,
      environment: sub.environment,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      razorpaySubscriptionId: sub.razorpaySubscriptionId,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    },
    customer: {
      id: sub.user?.id ?? null,
      name: sub.user?.name ?? null,
      email: sub.user?.email ?? null,
      isBanned: sub.user?.isBanned ?? null,
    },
    charges: sub.charges.map((c) => ({ id: c.id, paymentId: c.razorpayPaymentId, amount: c.amountSubunits, status: c.chargeStatus, createdAt: c.createdAt.toISOString() })),
    invoices: sub.invoices.map((i) => ({ id: i.id, number: i.invoiceNumber, status: i.status, createdAt: i.createdAt.toISOString() })),
    payments: sub.payments.map((p) => ({ id: p.id, paymentId: p.gatewayTransactionId, status: p.status, createdAt: p.createdAt.toISOString() })),
    grants: grants.map((g) => ({
      id: g.id,
      entitlementKey: g.entitlementKey,
      sourceType: g.sourceType,
      sourceReference: g.sourceReference,
      status: g.status,
      startsAt: g.startsAt.toISOString(),
      expiresAt: g.expiresAt?.toISOString() ?? null,
      limitValue: g.limitValue === null ? null : Number(g.limitValue),
      limitUnit: g.limitUnit,
    })),
    provisionings: provisionings.map((p) => ({
      id: p.id,
      operation: p.operation,
      status: p.status,
      errorCode: p.errorCode,
      errorMessage: p.errorMessage,
      attemptCount: p.attemptCount,
      createdAt: p.createdAt.toISOString(),
    })),
    audits: audits.map((a) => ({
      actorId: a.userId,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      createdAt: a.createdAt.toISOString(),
      after: sanitizeJson(a.afterJson),
    })),
  }
}

function sanitizeJson(v: unknown): unknown {
  if (!v || typeof v !== "object") return v
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (/secret|signature|password|token/i.test(k)) continue
    out[k] = val
  }
  return out
}

export interface EnrollmentRow {
  id: string
  userId: string
  customerName: string | null
  customerEmail: string | null
  planId: string
  planVersionId: string
  status: string
  startedAt: string | null
  expiresAt: string | null
  environment: string | null
  createdAt: string
}

export async function listEnrollments(type: "trial" | "free", limit = 100): Promise<EnrollmentRow[]> {
  if (type === "trial") {
    const rows = await db.trialEnrollment.findMany({
      where: {},
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, limit),
    })
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      customerName: r.user?.name ?? null,
      customerEmail: r.user?.email ?? null,
      planId: r.planId,
      planVersionId: r.planVersionId,
      status: r.status,
      startedAt: r.startedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      environment: r.environment,
      createdAt: r.createdAt.toISOString(),
    }))
  }
  const rows = await db.freeEnrollment.findMany({
    where: {},
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, limit),
  })
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    customerName: r.user?.name ?? null,
    customerEmail: r.user?.email ?? null,
    planId: r.planId,
    planVersionId: r.planVersionId,
    status: r.status,
    startedAt: null,
    expiresAt: null,
    environment: r.environment,
    createdAt: r.createdAt.toISOString(),
  }))
}

export interface IssueRow {
  id: string
  kind: "PROVISIONING" | "CHARGE" | "WEBHOOK"
  reference: string
  status: string
  error?: string | null
  createdAt: string
}

export async function listOperationalIssues(limit = 50): Promise<IssueRow[]> {
  const [provFail, chargeFail, webhookFail] = await Promise.all([
    db.subscriptionProvisioning.findMany({
      where: { status: { in: ["FAILED_RETRYABLE", "FAILED_PERMANENT"] } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.subscriptionCharge.findMany({
      where: { chargeStatus: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.webhookEvent.findMany({
      where: { source: "RAZORPAY", status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ])
  return [
    ...provFail.map((p) => ({ id: p.id, kind: "PROVISIONING" as const, reference: p.subscriptionId, status: p.status, error: p.errorMessage, createdAt: p.createdAt.toISOString() })),
    ...chargeFail.map((c) => ({ id: c.id, kind: "CHARGE" as const, reference: c.razorpaySubscriptionId, status: c.chargeStatus, error: null, createdAt: c.createdAt.toISOString() })),
    ...webhookFail.map((w) => ({ id: w.id, kind: "WEBHOOK" as const, reference: w.eventId, status: w.status, error: w.errorMessage, createdAt: w.createdAt.toISOString() })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export interface AuditRow {
  id: string
  actorId: string | null
  action: string
  entity: string | null
  entityId: string | null
  createdAt: string
  after: unknown
}

export async function listAdminAudit(page = 1, pageSize = 50): Promise<{ items: AuditRow[]; total: number }> {
  const p = Math.max(1, page)
  const size = Math.min(100, Math.max(1, pageSize))
  const where = {
    OR: [
      { entity: { in: SEARCH_LIKE_NAMES } },
      { action: { contains: "SUBSCRIPTION", mode: "insensitive" } },
      ...SEARCH_LIKE_PREFIXES.map((pfx) => ({ action: { startsWith: pfx } })),
    ],
  }
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where: where as never, orderBy: { createdAt: "desc" }, skip: (p - 1) * size, take: size }),
    db.auditLog.count({ where: where as never }),
  ])
  return {
    items: rows.map((a) => ({
      id: a.id,
      actorId: a.userId,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      createdAt: a.createdAt.toISOString(),
      after: sanitizeJson(a.afterJson),
    })),
    total,
  }
}
