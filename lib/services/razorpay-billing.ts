/**
 * lib/services/razorpay-billing.ts
 *
 * Phase 4 — Razorpay recurring billing engine.
 *
 * Connects the published plan catalog (Phase 2) to Razorpay Subscriptions
 * WITHOUT touching the standalone purchase system, the one-time Razorpay flow,
 * or Phase 1-3 domains. This phase handles BILLING; entitlement provisioning
 * is Phase 5 and is intentionally NOT implemented here.
 *
 * Scope:
 *  - internal PlanVersion ⇄ Razorpay Plan mapping (idempotent, env-scoped)
 *  - server-side recurring subscription creation on UserSubscription (Stack B)
 *  - subscription-specific checkout signature verification
 *  - cancel / pause / resume against the provider with truthful persistence
 *  - provider-state mapping onto SubscriptionStatus with guarded transitions
 *
 * Money invariants: price/currency/interval/count are ALWAYS resolved
 * server-side from the authorized published version; never from request
 * bodies; amounts converted to the currency's smallest unit with integers.
 */

import crypto from "crypto"
import {
  PlanMappingStatus,
  PlanStatus,
  PlanType,
  PlanVersionStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client"
import { db } from "@/lib/db"
import { getRazorpay } from "@/lib/razorpay"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { currentSubscriptionEnvironment } from "@/lib/services/subscription-state-machine"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { invalidateCache } from "@/lib/services/cache-service"

// ── Stable error model ─────────────────────────────────────────────────────────

export type RazorpayBillingErrorCode =
  | "INVALID_PLAN"
  | "PLAN_NOT_PUBLISHED"
  | "PLAN_NOT_BILLABLE"
  | "PLAN_MAPPING_MISSING"
  | "PLAN_MAPPING_UNAVAILABLE"
  | "SUBSCRIPTION_NOT_FOUND"
  | "SUBSCRIPTION_NOT_OWNED"
  | "SUBSCRIPTION_STATE_CONFLICT"
  | "PROVIDER_REQUEST_FAILED"
  | "PROVIDER_TIMEOUT"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "WEBHOOK_EVENT_DUPLICATE"
  | "WEBHOOK_PAYLOAD_INVALID"
  | "SUBSCRIPTION_PAYMENT_PENDING"
  | "SUBSCRIPTION_HALTED"
  | "SUBSCRIPTION_CANCEL_FAILED"
  | "SUBSCRIPTION_RESUME_FAILED"
  | "SUBSCRIPTION_PROVIDER_STATE_UNKNOWN"
  | "BILLING_RECONCILIATION_REQUIRED"

export class RazorpayBillingError extends Error {
  readonly code: RazorpayBillingErrorCode
  constructor(code: RazorpayBillingErrorCode, message: string) {
    super(message)
    this.name = "RazorpayBillingError"
    this.code = code
  }
}

// ── Supported commercial currencies (decimals = 2 → subunits = *100) ──────────

const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "CAD", "AUD"] as const
const SUPPORTED_BILLING_INTERVALS = [1, 3, 6, 12] as const

export function toAmountSubunits(amount: number, currency: string): number {
  if (!SUPPORTED_CURRENCIES.includes(currency as (typeof SUPPORTED_CURRENCIES)[number])) {
    throw new RazorpayBillingError("INVALID_PLAN", `Unsupported currency: ${currency}`)
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RazorpayBillingError("INVALID_PLAN", "Amount must be a positive finite number")
  }
  // INR and all supported currencies use a 2-decimal smallest unit (paise/cents).
  const subunits = Math.round(amount * 100)
  if (!Number.isInteger(subunits) || subunits <= 0 || subunits > 2_147_483_647) {
    throw new RazorpayBillingError("INVALID_PLAN", `Amount out of integer subunit range: ${amount}`)
  }
  return subunits
}

// ── Billing interval & cycle mapping ──────────────────────────────────────────

interface IntervalMapping {
  period: string
  interval: number
}

export function mapBillingInterval(billingIntervalMonths: number | null, planType: PlanType | null): IntervalMapping {
  if (planType === PlanType.FREE) {
    throw new RazorpayBillingError("PLAN_NOT_BILLABLE", "FREE plans are never mapped to recurring billing")
  }
  if (!billingIntervalMonths || !(SUPPORTED_BILLING_INTERVALS as readonly number[]).includes(billingIntervalMonths)) {
    throw new RazorpayBillingError(
      "INVALID_PLAN",
      `Unsupported billing interval: ${String(billingIntervalMonths)} (supported: 1, 3, 6, 12 months)`,
    )
  }
  // Razorpay period "monthly" with interval N charges once every N months.
  return { period: "monthly", interval: billingIntervalMonths }
}

/**
 * Finite-term derivation: durationMonths / billingIntervalMonths when the
 * published contract declares a finite term; NULL = renew until cancelled.
 * Non-integral terms are rejected — never silently guessed.
 */
export function computeTotalCount(planType: PlanType | null, durationMonths: number | null, billingIntervalMonths: number | null): number | null {
  if (planType === PlanType.FREE) return 0
  if (durationMonths === null || durationMonths === undefined) return null
  if (durationMonths === 0) return 0 // one-time-ish contract, not billable recurring
  if (!billingIntervalMonths) {
    throw new RazorpayBillingError(
      "PLAN_NOT_BILLABLE",
      "Finite-term plan is missing its billing interval — cannot derive cycles",
    )
  }
  if (durationMonths % billingIntervalMonths !== 0) {
    throw new RazorpayBillingError(
      "PLAN_NOT_BILLABLE",
      `Duration ${durationMonths} months is not an exact multiple of billing interval ${billingIntervalMonths} months`,
    )
  }
  return durationMonths / billingIntervalMonths
}

// ── Plan eligibility (server-side truth) ──────────────────────────────────────

interface PlanWithVersion {
  id: string
  status: PlanStatus
  planType: PlanType | null
  currency: string
  durationMonths: number | null
  billingIntervalMonths: number | null
  version: {
    id: string
    version: number
    status: PlanVersionStatus
    price: unknown
    durationMonths: number | null
    billingIntervalMonths: number | null
  }
}

async function loadPlanWithPublishedVersion(planVersionId: string): Promise<PlanWithVersion> {
  const version = await db.planVersion.findUnique({
    where: { id: planVersionId },
    include: {
      plan: {
        select: {
          id: true,
          status: true,
          planType: true,
          currency: true,
          durationMonths: true,
          billingIntervalMonths: true,
        },
      },
    },
  })
  if (!version) throw new RazorpayBillingError("INVALID_PLAN", `Unknown plan version: ${planVersionId}`)
  if (version.status !== PlanVersionStatus.PUBLISHED) {
    throw new RazorpayBillingError("PLAN_NOT_PUBLISHED", "Only published plan versions are billable")
  }
  const plan = version.plan
  if (plan.status !== PlanStatus.PUBLISHED) {
    throw new RazorpayBillingError("PLAN_NOT_PUBLISHED", `Plan is ${plan.status}, not PUBLISHED`)
  }
  return {
    id: plan.id,
    status: plan.status,
    planType: plan.planType,
    currency: plan.currency,
    durationMonths: plan.durationMonths,
    billingIntervalMonths: plan.billingIntervalMonths,
    version: {
      id: version.id,
      version: version.version,
      status: version.status,
      price: version.price,
      durationMonths: version.durationMonths ?? plan.durationMonths ?? null,
      billingIntervalMonths: version.billingIntervalMonths ?? plan.billingIntervalMonths ?? null,
    },
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (v && typeof v === "object" && "toNumber" in (v as object)) {
    const n = (v as { toNumber: () => number }).toNumber()
    return Number.isFinite(n) ? n : null
  }
  return null
}

function assertBillable(plan: PlanWithVersion): { subunits: number; period: string; interval: number; totalCount: number | null } {
  if (plan.planType === PlanType.FREE) {
    throw new RazorpayBillingError("PLAN_NOT_BILLABLE", "FREE plans cannot be mapped to recurring billing")
  }
  const price = toNumber(plan.version.price)
  if (price === null || price <= 0) {
    throw new RazorpayBillingError("PLAN_NOT_BILLABLE", "Plan version requires a positive price")
  }
  const subunits = toAmountSubunits(price, plan.currency)
  const iv = mapBillingInterval(plan.version.billingIntervalMonths, plan.planType)
  const totalCount = computeTotalCount(plan.planType, plan.version.durationMonths, plan.version.billingIntervalMonths)
  return { subunits, period: iv.period, interval: iv.interval, totalCount }
}

// ── Provider call helper (timeout-safe) ───────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new RazorpayBillingError("PROVIDER_TIMEOUT", `Razorpay request timed out after ${ms}ms`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(normalizeProviderError(e))
      },
    )
  })
}

function normalizeProviderError(err: unknown): RazorpayBillingError {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes("timed out") || message.includes("ETIMEDOUT")) {
    return new RazorpayBillingError("PROVIDER_TIMEOUT", message)
  }
  if (/4\d\d/.test(message) || /Authentication|unauthorized/i.test(message)) {
    return new RazorpayBillingError("PROVIDER_REQUEST_FAILED", "Razorpay rejected the request (4xx)")
  }
  return new RazorpayBillingError("PROVIDER_REQUEST_FAILED", "Razorpay request failed")
}

// ── Plan mapping ──────────────────────────────────────────────────────────────

export interface PlanMappingResult {
  planVersionId: string
  razorpayPlanId: string
  environment: string
  currency: string
  amountSubunits: number
  billingPeriod: string
  billingInterval: number
  totalCount: number | null
  mappingStatus: PlanMappingStatus
  existing: boolean
}

/**
 * Idempotent, environment-scoped mapping of a published PlanVersion to a
 * Razorpay Plan. Reuses an ACTIVE mapping; never duplicates; never mutates an
 * existing mapping for a changed version (create a new version instead).
 */
export async function ensureRazorpayPlanMapping(
  planVersionId: string,
  actorId?: string,
): Promise<PlanMappingResult> {
  const environment = currentSubscriptionEnvironment()
  const plan = await loadPlanWithPublishedVersion(planVersionId)
  const bill = assertBillable(plan)

  const existing = await db.razorpayPlanMapping.findUnique({
    where: { planVersionId_environment: { planVersionId, environment } },
  })
  if (existing) {
    if (existing.mappingStatus === PlanMappingStatus.NEEDS_RECONCILIATION) {
      throw new RazorpayBillingError(
        "BILLING_RECONCILIATION_REQUIRED",
        `Mapping for version ${planVersionId} needs reconciliation before use`,
      )
    }
    if (existing.mappingStatus === PlanMappingStatus.INACTIVE) {
      throw new RazorpayBillingError(
        "PLAN_MAPPING_UNAVAILABLE",
        `Mapping for version ${planVersionId} is inactive; create a new plan version`,
      )
    }
    return {
      planVersionId,
      razorpayPlanId: existing.razorpayPlanId,
      environment,
      currency: existing.currency,
      amountSubunits: existing.amountSubunits,
      billingPeriod: existing.billingPeriod,
      billingInterval: existing.billingInterval,
      totalCount: existing.totalCount,
      mappingStatus: existing.mappingStatus,
      existing: true,
    }
  }

  const client = getRazorpay()
  if (!client) throw new RazorpayBillingError("PROVIDER_REQUEST_FAILED", "Razorpay is not configured")

  const providerPlan = await withTimeout(
    (client.plans as unknown as {
      create(params: Record<string, unknown>): Promise<{ id: string }>
    }).create({
      period: bill.period,
      interval: bill.interval,
      item: {
        name: `Plan v${plan.version.version} (${plan.id})`,
        amount: bill.subunits,
        currency: plan.currency,
        description: `Published plan version ${planVersionId}`,
      },
      notes: { planVersionId, internalPlanId: plan.id, environment },
    }),
    15_000,
  )

  if (!providerPlan?.id || typeof providerPlan.id !== "string") {
    throw new RazorpayBillingError(
      "SUBSCRIPTION_PROVIDER_STATE_UNKNOWN",
      "Razorpay returned no plan id — mark for reconciliation",
    )
  }

  try {
    const mapping = await db.razorpayPlanMapping.create({
      data: {
        planVersionId,
        environment,
        provider: "RAZORPAY",
        razorpayPlanId: providerPlan.id,
        currency: plan.currency,
        amountSubunits: bill.subunits,
        billingPeriod: bill.period,
        billingInterval: bill.interval,
        totalCount: bill.totalCount,
        mappingStatus: PlanMappingStatus.ACTIVE,
      },
    })
    if (actorId) {
      await audit(actorId, "RAZORPAY_PLAN_MAPPED", mapping.id, {
        planVersionId,
        razorpayPlanId: providerPlan.id,
      })
    }
    return {
      planVersionId,
      razorpayPlanId: providerPlan.id,
      environment,
      currency: plan.currency,
      amountSubunits: bill.subunits,
      billingPeriod: bill.period,
      billingInterval: bill.interval,
      totalCount: bill.totalCount,
      mappingStatus: PlanMappingStatus.ACTIVE,
      existing: false,
    }
  } catch (err) {
    // Provider created the plan remotely but persistence failed — do NOT
    // create another remote plan. Record the need for reconciliation.
    logger.warn({ err, planVersionId }, "razorpay plan mapping persistence failed after remote create")
    throw new RazorpayBillingError(
      "BILLING_RECONCILIATION_REQUIRED",
      "Razorpay plan was created remotely but could not be persisted",
    )
  }
}

// ── Subscription creation ─────────────────────────────────────────────────────

export interface CreateRecurringSubscriptionInput {
  planVersionId: string
  quantity?: number
}

export interface CreateRecurringSubscriptionResult {
  internalSubscriptionId: string
  razorpaySubscriptionId: string
  planVersionId: string
  environment: string
  status: SubscriptionStatus
  existing: boolean
}

/**
 * Creates a recurring subscription for the AUTHENTICATED owner. `ownerUserId`
 * MUST come from the verified session; client-supplied owner fields are
 * ignored/forbidden by the calling contract.
 */
export async function createRecurringSubscription(
  input: CreateRecurringSubscriptionInput,
  ownerUserId: string,
): Promise<CreateRecurringSubscriptionResult> {
  if (!ownerUserId || typeof ownerUserId !== "string") {
    throw new RazorpayBillingError("INVALID_PLAN", "An authenticated owner is required")
  }
  const environment = currentSubscriptionEnvironment()

  const mapping = await ensureRazorpayPlanMapping(input.planVersionId)
  const plan = await loadPlanWithPublishedVersion(input.planVersionId)

  // Idempotency: an existing pending/active subscription for this user + plan
  // version is returned instead of creating a duplicate remote subscription.
  const existing = await db.userSubscription.findFirst({
    where: {
      userId: ownerUserId,
      planVersionId: input.planVersionId,
      razorpaySubscriptionId: { not: null },
      status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.UNPAID, SubscriptionStatus.PAUSED, SubscriptionStatus.PAST_DUE] },
    },
  })
  if (existing) {
    return {
      internalSubscriptionId: existing.id,
      razorpaySubscriptionId: existing.razorpaySubscriptionId as string,
      planVersionId: input.planVersionId,
      environment,
      status: existing.status,
      existing: true,
    }
  }

  const now = new Date()
  const intervalMonths = mapping.billingInterval
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + intervalMonths)

  // Reserve the internal record BEFORE the provider call (crash-safe: the
  // provider id is attached after; a failed provider call leaves a TRIALING
  // record with metadata for cleanup instead of a phantom remote subscription).
  const internal = await db.userSubscription.create({
    data: {
      subscriptionNumber: `RZP-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      userId: ownerUserId,
      planId: plan.id,
      planVersionId: input.planVersionId,
      environment,
      status: SubscriptionStatus.TRIALING,
      billingCycle: intervalMonths === 1 ? "MONTHLY" : intervalMonths === 3 ? "QUARTERLY" : intervalMonths === 6 ? "SEMI_ANNUAL" : "YEARLY",
      quantity: input.quantity ?? 1,
      unitPrice: (toNumber(plan.version.price) ?? 0).toFixed(2),
      totalAmount: (toNumber(plan.version.price) ?? 0).toFixed(2),
      currency: plan.currency as never,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      autoRenew: true,
      metadata: { source: "RAZORPAY_RECURRING", provider: "razorpay", pending: true },
    },
  })

  const client = getRazorpay()
  if (!client) {
    throw new RazorpayBillingError("PROVIDER_REQUEST_FAILED", "Razorpay is not configured")
  }

  const createParams: Record<string, unknown> = {
    plan_id: mapping.razorpayPlanId,
    customer_notify: 1,
    quantity: input.quantity ?? 1,
    notes: { internalSubscriptionId: internal.id, planVersionId: input.planVersionId, environment },
  }
  if (mapping.totalCount !== null && mapping.totalCount > 0) {
    createParams.total_count = mapping.totalCount
  }
  const { start_at } = input as { start_at?: number }
  if (start_at && Number.isFinite(start_at)) createParams.start_at = start_at

  const remote = await withTimeout(
    (client.subscriptions as unknown as {
      create(params: Record<string, unknown>): Promise<{ id: string }>
    }).create(createParams),
    20_000,
  )
  if (!remote?.id) {
    throw new RazorpayBillingError(
      "SUBSCRIPTION_PROVIDER_STATE_UNKNOWN",
      "Razorpay returned no subscription id — reconcile manually",
    )
  }

  try {
    const updated = await db.userSubscription.update({
      where: { id: internal.id },
      data: {
        razorpaySubscriptionId: remote.id,
        metadata: { ...((internal.metadata ?? {}) as object), pending: false, razorpayPlanId: mapping.razorpayPlanId },
      },
    })
    await audit(ownerUserId, "RECURRING_SUBSCRIPTION_CREATED", internal.id, {
      razorpaySubscriptionId: remote.id,
      planVersionId: input.planVersionId,
    })
    return {
      internalSubscriptionId: internal.id,
      razorpaySubscriptionId: remote.id,
      planVersionId: input.planVersionId,
      environment,
      status: updated.status,
      existing: false,
    }
  } catch {
    // Remote exists; persistence of the reference failed. Record for
    // reconciliation. A retry will find no local record and could create a
    // duplicate remote subscription, so fail closed instead.
    await db.userSubscription.update({
      where: { id: internal.id },
      data: { metadata: { ...((internal.metadata ?? {}) as object), pending: true, reconciliation: "razorpaySubscriptionId" } },
    }).catch(() => undefined)
    throw new RazorpayBillingError(
      "BILLING_RECONCILIATION_REQUIRED",
      "Razorpay subscription created remotely but the reference could not be persisted — reconciliation required",
    )
  }
}

// ── Checkout signature verification (subscription-specific) ──────────────────

/**
 * Razorpay subscription checkout contract: signature = HMAC-SHA256(
 *   `${razorpay_payment_id}|${razorpay_subscription_id}`, RAZORPAY_KEY_SECRET).
 * This is deliberately distinct from the one-time Order formula
 * (`order_id|payment_id`). Verification NEVER activates billing; the webhook
 * is the authoritative lifecycle source.
 */
export function verifySubscriptionSignature(
  razorpaySubscriptionId: string,
  razorpayPaymentId: string,
  signature: string,
  secret?: string,
): boolean {
  const key = secret ?? env.RAZORPAY_KEY_SECRET
  if (!key || !razorpaySubscriptionId || !razorpayPaymentId || !signature) return false
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = crypto.createHmac("sha256", key).update(`${razorpayPaymentId}|${razorpaySubscriptionId}`).digest("hex")
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))
  } catch {
    return false
  }
}

// ── Cancel / pause / resume ───────────────────────────────────────────────────

interface InternalSubRow {
  id: string
  userId: string
  status: SubscriptionStatus
  razorpaySubscriptionId: string | null
}

async function loadOwnedInternalSubscription(
  internalId: string,
  actorId: string,
  opts?: { byAdmin?: boolean },
): Promise<InternalSubRow> {
  const sub = await db.userSubscription.findUnique({
    where: { id: internalId },
    select: { id: true, userId: true, status: true, razorpaySubscriptionId: true },
  })
  if (!sub) throw new RazorpayBillingError("SUBSCRIPTION_NOT_FOUND", `Unknown subscription: ${internalId}`)
  if (!opts?.byAdmin && sub.userId !== actorId) {
    throw new RazorpayBillingError("SUBSCRIPTION_NOT_OWNED", "Subscription belongs to another customer")
  }
  if (!sub.razorpaySubscriptionId) {
    throw new RazorpayBillingError("SUBSCRIPTION_STATE_CONFLICT", "Subscription has no Razorpay reference")
  }
  return sub
}

export async function cancelRecurringSubscription(
  internalId: string,
  actorId: string,
  cancelAtCycleEnd: boolean = false,
  opts?: { byAdmin?: boolean },
): Promise<{ status: SubscriptionStatus }> {
  const sub = await loadOwnedInternalSubscription(internalId, actorId, opts)
  if (sub.status === SubscriptionStatus.CANCELED || sub.status === SubscriptionStatus.EXPIRED) {
    return { status: sub.status } // idempotent terminal
  }
  const client = getRazorpay()
  if (!client) throw new RazorpayBillingError("PROVIDER_REQUEST_FAILED", "Razorpay is not configured")
  await withTimeout(
    (client.subscriptions as unknown as { cancel(id: string, cancelAtCycleEnd?: boolean | number): Promise<unknown> }).cancel(
      sub.razorpaySubscriptionId as string,
      cancelAtCycleEnd,
    ),
    15_000,
  )
  const updated = await db.userSubscription.update({
    where: { id: internalId },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
      cancelAtPeriodEnd: cancelAtCycleEnd,
      autoRenew: false,
    },
  })
  await audit(actorId, "RECURRING_SUBSCRIPTION_CANCELLED", internalId, { cancelAtCycleEnd })
  await emitEvent({ type: EVENTS.SUBSCRIPTION_CANCELLED, timestamp: new Date().toISOString(), actorId, payload: { subscriptionId: internalId } })
  return { status: updated.status }
}

export async function pauseRecurringSubscription(
  internalId: string,
  actorId: string,
  opts?: { byAdmin?: boolean },
): Promise<{ status: SubscriptionStatus }> {
  const sub = await loadOwnedInternalSubscription(internalId, actorId, opts)
  if (sub.status === SubscriptionStatus.PAUSED) return { status: sub.status }
  if (!canUserSubscriptionTransition(sub.status, SubscriptionStatus.PAUSED)) {
    throw new RazorpayBillingError("SUBSCRIPTION_STATE_CONFLICT", `Cannot pause a ${sub.status} subscription`)
  }
  const client = getRazorpay()
  if (!client) throw new RazorpayBillingError("PROVIDER_REQUEST_FAILED", "Razorpay is not configured")
  await withTimeout(
    (client.subscriptions as unknown as { pause(id: string, params?: Record<string, unknown>): Promise<unknown> }).pause(
      sub.razorpaySubscriptionId as string,
      { pause_at: "now" },
    ),
    15_000,
  )
  const updated = await db.userSubscription.update({
    where: { id: internalId },
    data: { status: SubscriptionStatus.PAUSED },
  })
  await audit(actorId, "RECURRING_SUBSCRIPTION_PAUSED", internalId, {})
  await emitEvent({ type: EVENTS.SUBSCRIPTION_PAUSED, timestamp: new Date().toISOString(), actorId, payload: { subscriptionId: internalId } })
  return { status: updated.status }
}

export async function resumeRecurringSubscription(
  internalId: string,
  actorId: string,
  opts?: { byAdmin?: boolean },
): Promise<{ status: SubscriptionStatus }> {
  const sub = await loadOwnedInternalSubscription(internalId, actorId, opts)
  if (sub.status === SubscriptionStatus.ACTIVE) return { status: sub.status }
  if (sub.status === SubscriptionStatus.CANCELED || sub.status === SubscriptionStatus.EXPIRED) {
    throw new RazorpayBillingError("SUBSCRIPTION_RESUME_FAILED", "A cancelled or completed subscription cannot be resumed")
  }
  if (!canUserSubscriptionTransition(sub.status, SubscriptionStatus.ACTIVE)) {
    throw new RazorpayBillingError("SUBSCRIPTION_STATE_CONFLICT", `Cannot resume a ${sub.status} subscription`)
  }
  const client = getRazorpay()
  if (!client) throw new RazorpayBillingError("PROVIDER_REQUEST_FAILED", "Razorpay is not configured")
  await withTimeout(
    (client.subscriptions as unknown as { resume(id: string, params?: Record<string, unknown>): Promise<unknown> }).resume(
      sub.razorpaySubscriptionId as string,
      { resume_at: "now" },
    ),
    15_000,
  )
  const updated = await db.userSubscription.update({
    where: { id: internalId },
    data: { status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false },
  })
  await audit(actorId, "RECURRING_SUBSCRIPTION_RESUMED", internalId, {})
  await emitEvent({ type: EVENTS.SUBSCRIPTION_REACTIVATED, timestamp: new Date().toISOString(), actorId, payload: { subscriptionId: internalId } })
  return { status: updated.status }
}

// ── Provider-state mapping (shared with the webhook processor) ───────────────

export function mapProviderStatus(providerStatus: string): SubscriptionStatus {
  switch (providerStatus) {
    case "authenticated":
    case "created":
      return SubscriptionStatus.TRIALING
    case "active":
      return SubscriptionStatus.ACTIVE
    case "pending":
      return SubscriptionStatus.UNPAID
    case "halted":
      return SubscriptionStatus.PAST_DUE
    case "paused":
      return SubscriptionStatus.PAUSED
    case "cancelled":
      return SubscriptionStatus.CANCELED
    case "completed":
    case "expired":
      return SubscriptionStatus.EXPIRED
    default:
      throw new RazorpayBillingError("WEBHOOK_PAYLOAD_INVALID", `Unknown provider status: ${providerStatus}`)
  }
}

const USER_SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  TRIALING: ["ACTIVE", "UNPAID", "PAST_DUE", "PAUSED", "CANCELED", "EXPIRED"],
  ACTIVE: ["PAST_DUE", "UNPAID", "PAUSED", "CANCELED", "EXPIRED"],
  UNPAID: ["ACTIVE", "PAST_DUE", "PAUSED", "CANCELED"],
  PAST_DUE: ["ACTIVE", "UNPAID", "PAUSED", "CANCELED"],
  PAUSED: ["ACTIVE", "CANCELED"],
  CANCELED: [],
  EXPIRED: [],
}

export function canUserSubscriptionTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return true
  return USER_SUBSCRIPTION_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Applies a provider status to the internal subscription with CAS semantics
 * and out-of-order protection: a stale provider event (whose mapped target is
 * an illegal transition from the CURRENT internal state) is never applied;
 * the conflict is recorded instead of overwriting newer valid state.
 */
export async function applyProviderStatus(
  internalSubscriptionId: string,
  providerStatus: string,
  opts: { periodStart?: number | null; periodEnd?: number | null },
): Promise<{ changed: boolean; previous: SubscriptionStatus; current: SubscriptionStatus; conflict?: boolean }> {
  const target = mapProviderStatus(providerStatus)
  const currentRow = await db.userSubscription.findUnique({
    where: { id: internalSubscriptionId },
    select: { status: true },
  })
  if (!currentRow) throw new RazorpayBillingError("SUBSCRIPTION_NOT_FOUND", `Unknown subscription: ${internalSubscriptionId}`)
  const current = currentRow.status

  if (current === target) {
    return { changed: false, previous: current, current }
  }
  if (!canUserSubscriptionTransition(current, target)) {
    // Out-of-order or conflicting provider event — never overwrite.
    const conflict = `provider:${providerStatus} blocked from ${current}`
    const previousMetadata = (await db.userSubscription.findUnique({
      where: { id: internalSubscriptionId },
      select: { metadata: true },
    }))?.metadata as Record<string, unknown> | null
    await db.userSubscription.update({
      where: { id: internalSubscriptionId },
      data: {
        metadata: {
          ...(previousMetadata ?? {}),
          lastProviderConflict: conflict,
        },
      },
    }).catch(() => undefined)
    return { changed: false, previous: current, current, conflict: true }
  }

  await db.userSubscription.update({
    where: { id: internalSubscriptionId },
    data: {
      status: target,
      ...(opts.periodStart ? { currentPeriodStart: new Date(opts.periodStart * 1000) } : {}),
      ...(opts.periodEnd ? { currentPeriodEnd: new Date(opts.periodEnd * 1000) } : {}),
    },
  })
  return { changed: true, previous: current, current: target }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export function subscriptionWebhookSecret(): string | null {
  return env.RAZORPAY_SUBSCRIPTIONS_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET || null
}

export async function audit(actorId: string, action: string, entityId: string, after: Record<string, unknown>): Promise<void> {
  try {
    await db.auditLog.create({
      data: { userId: actorId, action, entity: "UserSubscription", entityId, afterJson: after as never },
    })
  } catch {
    // auditing must never break billing
  }
}

export async function invalidateAdminBillingCaches(): Promise<void> {
  await invalidateCache(["admin:subscriptions:list", "admin:revenue:dashboard:v2"])
}

export { Prisma }
