/**
 * lib/services/customer-subscription-view.ts
 *
 * Phase 7 — Customer-facing subscription view builder.
 *
 * Composes TRUSTED Phase 1-6 state into normalized, UI-safe shapes for the
 * customer dashboard. Read-only. No mutations, no pricing from the client,
 * no provider secrets. All values are server-derived from the existing
 * services and records.
 */

import { db } from "@/lib/db"
import { SubscriptionStatus } from "@prisma/client"
import { listPlans } from "@/lib/services/plan-catalog-service"
import { getEffectiveEntitlements, getLimit } from "@/lib/services/entitlement-resolver"
import { currentSubscriptionEnvironment } from "@/lib/services/subscription-state-machine"

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (value && typeof value === "object" && "toNumber" in (value as object)) {
    const n = (value as { toNumber: () => number }).toNumber()
    return Number.isFinite(n) ? n : null
  }
  return null
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

function money(value: unknown, currency = "INR"): { amount: string; currency: string } {
  const n = toNumber(value)
  return { amount: n === null ? "0" : n.toFixed(2), currency }
}

// ── Paid subscription summary ────────────────────────────────────────────────

export interface PaidSubscriptionSummary {
  id: string
  status: string
  planId: string
  planName: string | null
  planType: string | null
  planVersionId: string | null
  billingIntervalMonths: number | null
  price: { amount: string; currency: string }
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  nextChargeLabel: string | null
  razorpaySubscriptionId: string | null
}

// ── Trial + Free summaries ───────────────────────────────────────────────────

export interface TrialSummary {
  id: string
  planId: string
  planName: string | null
  planVersionId: string
  status: string
  startedAt: string | null
  expiresAt: string | null
}

export interface FreeSummary {
  id: string
  planId: string
  planName: string | null
  planVersionId: string
  status: string
}

// ── Billing records (customer-scoped, derived from real records) ─────────────

export interface BillingRecordSummary {
  kind: "SUBSCRIPTION_CHARGE" | "SUBSCRIPTION_INVOICE" | "SUBSCRIPTION_PAYMENT"
  id: string
  reference: string | null
  amount: { amount: string; currency: string }
  status: string
  createdAt: string
}

// ── Overview ─────────────────────────────────────────────────────────────────

export interface SubscriptionOverview {
  environment: string
  paidSubscriptions: PaidSubscriptionSummary[]
  trials: TrialSummary[]
  freeEnrollments: FreeSummary[]
  access: {
    entitlementKeys: string[]
    storageLimit: { limitValue: number | null; limitUnit: string | null }
    adminLimit: { limitValue: number | null; limitUnit: string | null }
  }
  billing: BillingRecordSummary[]
}

const PAID_STATUSES = ["TRIALING", "ACTIVE", "UNPAID", "PAST_DUE", "PAUSED", "CANCELED", "EXPIRED"]

export async function getCustomerSubscriptionOverview(userId: string): Promise<SubscriptionOverview> {
  const [subs, trials, frees, entitlements, storage, admins] = await Promise.all([
    (db.userSubscription.findMany({
      where: { userId, status: { in: PAID_STATUSES as SubscriptionStatus[] } },
      include: {
        plan: { select: { id: true, name: true, planType: true, currency: true, billingIntervalMonths: true } },
        charges: { orderBy: { createdAt: "desc" }, take: 5 },
        invoices: { orderBy: { createdAt: "desc" }, take: 5 },
        payments: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
    }) as unknown) as Promise<
      Array<{
        id: string
        userId: string
        planId: string
        planVersionId: string | null
        status: string
        currency: string
        currentPeriodStart: Date
        currentPeriodEnd: Date
        cancelAtPeriodEnd: boolean
        razorpaySubscriptionId: string | null
        totalAmount: unknown
        plan: { id: string; name: string; planType: string | null; billingIntervalMonths: number | null } | null
        charges: Array<{ id: string; createdAt: Date; chargeStatus: string; currency: string; amountSubunits: number; razorpayPaymentId: string | null }>
        invoices: Array<{ id: string; createdAt: Date; status: unknown; invoiceNumber: string | null; totalAmount: unknown }>
        payments: Array<{ id: string; createdAt: Date; status: unknown; totalAmount: unknown; razorpayPaymentId: string | null }>
      }>
    >,
    db.trialEnrollment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.freeEnrollment.findMany({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
    getEffectiveEntitlements({ type: "USER", userId }),
    getLimit({ type: "USER", userId }, "limit.storage"),
    getLimit({ type: "USER", userId }, "limit.admin_users"),
  ])

  const plansById = new Map<string, string>()
  for (const s of subs) if (s.plan) plansById.set(s.plan.id, s.plan.name)
  const trialIds = trials.map((t) => t.planId).filter((id): id is string => !!id)
  const freeIds = frees.map((f) => f.planId)
  const allPlanIds = [...plansById.keys(), ...trialIds, ...freeIds]
  if (allPlanIds.length > 0) {
    const plans = await db.subscriptionPlan.findMany({
      where: { id: { in: allPlanIds } },
      select: { id: true, name: true },
    })
    for (const p of plans) plansById.set(p.id, p.name)
  }

  const billing: BillingRecordSummary[] = [
    ...subs.flatMap((s) =>
      s.charges.map((c) => ({
        kind: "SUBSCRIPTION_CHARGE" as const,
        id: c.id,
        reference: c.razorpayPaymentId ?? c.id,
        amount: { amount: ((toNumber(c.amountSubunits) ?? 0) / 100).toFixed(2), currency: c.currency },
        status: c.chargeStatus,
        createdAt: c.createdAt.toISOString(),
      })),
    ),
    ...subs.flatMap((s) =>
      s.invoices.map((i) => ({
        kind: "SUBSCRIPTION_INVOICE" as const,
        id: i.id,
        reference: i.invoiceNumber ?? i.id,
        amount: money(i.totalAmount as never, "INR"),
        status: i.status as string,
        createdAt: i.createdAt.toISOString(),
      })),
    ),
    ...subs.flatMap((s) =>
      s.payments.map((p) => ({
        kind: "SUBSCRIPTION_PAYMENT" as const,
        id: p.id,
        reference: p.razorpayPaymentId ?? p.id,
        amount: money(p.totalAmount as never, "INR"),
        status: p.status as string,
        createdAt: p.createdAt.toISOString(),
      })),
    ),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)

  return {
    environment: currentSubscriptionEnvironment(),
    paidSubscriptions: subs.map((s) => ({
      id: s.id,
      status: s.status,
      planId: s.planId,
      planName: plansById.get(s.planId) ?? null,
      planType: s.plan?.planType ?? null,
      planVersionId: s.planVersionId,
      billingIntervalMonths: s.plan?.billingIntervalMonths ?? null,
      price: money(s.totalAmount as never, s.currency ?? "INR"),
      currentPeriodStart: iso(s.currentPeriodStart),
      currentPeriodEnd: iso(s.currentPeriodEnd),
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      nextChargeLabel: s.cancelAtPeriodEnd
        ? "Ends at period end"
        : s.currentPeriodEnd
          ? `Renews ${new Date(s.currentPeriodEnd).toISOString().slice(0, 10)}`
          : null,
      razorpaySubscriptionId: s.razorpaySubscriptionId,
    })),
    trials: trials.map((t) => ({
      id: t.id,
      planId: t.planId,
      planName: plansById.get(t.planId) ?? null,
      planVersionId: t.planVersionId,
      status: t.status,
      startedAt: iso(t.startedAt),
      expiresAt: iso(t.expiresAt),
    })),
    freeEnrollments: frees.map((f) => ({
      id: f.id,
      planId: f.planId,
      planName: plansById.get(f.planId) ?? null,
      planVersionId: f.planVersionId,
      status: f.status,
    })),
    access: {
      entitlementKeys: entitlements.map((e) => e.key),
      storageLimit: { limitValue: storage.limitValue, limitUnit: storage.limitUnit },
      adminLimit: { limitValue: admins.limitValue, limitUnit: admins.limitUnit },
    },
    billing,
  }
}

// ── Plan catalog (customer-visible) ──────────────────────────────────────────

export interface CustomerPlanItem {
  itemType: string
  itemRefId: string | null
  itemRefKey: string
  label: string | null
  quantity: number | null
  limitValue: number | null
  limitUnit: string | null
}

export interface CustomerPlan {
  id: string
  name: string
  tagline: string | null
  description: string | null
  planType: string | null
  currency: string
  price: { amount: string; currency: string }
  billingIntervalMonths: number | null
  durationMonths: number | null
  status: string
  currentVersionId: string | null
  versionId: string | null
  versionStatus: string | null
  items: CustomerPlanItem[]
}

/**
 * Published plans only, with their current published version's items.
 * Draft/archived/unpublished plans are never exposed to the customer.
 */
export async function listCustomerPlans(): Promise<CustomerPlan[]> {
  const plans = (await listPlans({ status: "PUBLISHED" })) as Array<{
    id: string
    name: string
    tagline: string | null
    description: string | null
    planType: string | null
    currency: string
    price: unknown
    billingIntervalMonths: number | null
    durationMonths: number | null
    status: string
    currentVersionId: string | null
    versions: Array<{
      id: string
      status: string
      items: Array<{
        itemType: string
        itemRefId: string | null
        itemRefKey: string
        label: string | null
        quantity: number | null
        limitValue: unknown
        limitUnit: string | null
      }>
    }>
  }>

  return plans.map((p) => {
    const version =
      (p.currentVersionId ? p.versions.find((v) => v.id === p.currentVersionId) : null) ??
      p.versions.find((v) => v.status === "PUBLISHED")
    return {
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      planType: p.planType,
      currency: p.currency,
      price: { amount: (toNumber(p.price) ?? 0).toFixed(2), currency: p.currency },
      billingIntervalMonths: p.billingIntervalMonths,
      durationMonths: p.durationMonths,
      status: p.status,
      currentVersionId: p.currentVersionId,
      versionId: version?.id ?? null,
      versionStatus: version?.status ?? null,
      items: (version?.items ?? []).map((i) => ({
        itemType: i.itemType,
        itemRefId: i.itemRefId,
        itemRefKey: i.itemRefKey,
        label: i.label,
        quantity: i.quantity,
        limitValue: i.limitValue === null ? null : toNumber(i.limitValue),
        limitUnit: i.limitUnit,
      })),
    }
  })
}
