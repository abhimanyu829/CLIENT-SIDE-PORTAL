/**
 * lib/services/reconciliation/rules.ts
 *
 * Phase 10 — Pure reconciliation rules. No I/O. Each rule takes already-fetched
 * trusted rows and returns FindingDrafts. Detection only; repair eligibility is
 * declared here but executed by the engine through EXISTING domain services.
 *
 * Authority matrix (see docs/subscriptions/phase-10/reconciliation-rules.md):
 *  - Webhook authenticity: provider signature verification (Phase 4) — never raw payload.
 *  - Subscription lifecycle: Phase-4 normalized state machine — never a raw label.
 *  - Payment success: verified provider evidence only.
 *  - Effective access: Phase-3 resolver — a subscription row is NOT proof.
 *  - Provisioning: Phase-5 durable operation state.
 *  - Settlement: NOT RECONCILED (no verified settlement data source — documented).
 */

import { ReconciliationCategory, ReconciliationSeverity } from "@prisma/client"

export interface FindingDraft {
  findingKey: string
  category: ReconciliationCategory
  severity: ReconciliationSeverity
  entityType: string
  entityId: string
  expectedValue: Record<string, unknown> | null
  observedValue: Record<string, unknown> | null
  evidence: Record<string, unknown>
  /** Null = detection only; otherwise an allow-listed repair action id. */
  proposedAction: string | null
}

export function findingKey(
  category: ReconciliationCategory,
  entityType: string,
  entityId: string,
  signal: string,
): string {
  return `${category}:${entityType}:${entityId}:${signal}`
}

// ── Configurable timing policy (rationale documented, not arbitrary) ─────────

export interface ReconciliationThresholds {
  /** An ACCEPTED webhook event older than this that is not PROCESSED is actionable. */
  unprocessedEventMinutes: number
  /** A TRIALING/TRIAL-transition subscription older than this without activation is stale. */
  pendingActivationMinutes: number
}

export const DEFAULT_THRESHOLDS: ReconciliationThresholds = Object.freeze({
  unprocessedEventMinutes: 15,
  pendingActivationMinutes: 60,
})

// ── Category A: event ingestion ──────────────────────────────────────────────

export interface WebhookEventRow {
  eventId: string
  eventType: string
  status: string
  receivedAt: Date
  errorMessage: string | null
}

export function ruleUnprocessedEvents(
  rows: WebhookEventRow[],
  now: Date,
  th: ReconciliationThresholds = DEFAULT_THRESHOLDS,
): FindingDraft[] {
  const out: FindingDraft[] = []
  for (const r of rows) {
    const ageMin = (now.getTime() - r.receivedAt.getTime()) / 60_000
    if (r.status === "FAILED") {
      out.push({
        findingKey: findingKey(ReconciliationCategory.UNPROCESSED_EVENT, "WebhookEvent", r.eventId, "FAILED"),
        category: ReconciliationCategory.UNPROCESSED_EVENT,
        severity: ReconciliationSeverity.HIGH,
        entityType: "WebhookEvent",
        entityId: r.eventId,
        expectedValue: { status: "PROCESSED" },
        observedValue: { status: r.status },
        evidence: { eventType: r.eventType, error: r.errorMessage ?? null },
        // Replay is a money/lifecycle-adjacent operation — never automatic.
        proposedAction: null,
      })
    } else if (r.status === "PENDING" && ageMin > th.unprocessedEventMinutes) {
      out.push({
        findingKey: findingKey(ReconciliationCategory.UNPROCESSED_EVENT, "WebhookEvent", r.eventId, "STALE_PENDING"),
        category: ReconciliationCategory.UNPROCESSED_EVENT,
        severity: ReconciliationSeverity.MEDIUM,
        entityType: "WebhookEvent",
        entityId: r.eventId,
        expectedValue: { status: "PROCESSED" },
        observedValue: { status: r.status, ageMinutes: Math.round(ageMin) },
        evidence: { eventType: r.eventType, thresholdMinutes: th.unprocessedEventMinutes },
        proposedAction: null,
      })
    }
  }
  return out
}

// ── Category B: payment/charge records ───────────────────────────────────────

export interface ChargeRow {
  id: string
  razorpaySubscriptionId: string
  razorpayPaymentId: string | null
  amountSubunits: number
  currency: string
  chargeStatus: string
  createdAt: Date
}

export function ruleChargeRecords(
  rows: ChargeRow[],
  now: Date,
  th: ReconciliationThresholds = DEFAULT_THRESHOLDS,
): FindingDraft[] {
  const out: FindingDraft[] = []
  const byPayment = new Map<string, ChargeRow[]>()
  for (const r of rows) {
    if (r.razorpayPaymentId) {
      const list = byPayment.get(r.razorpayPaymentId) ?? []
      list.push(r)
      byPayment.set(r.razorpayPaymentId, list)
    }
  }
  for (const [paymentId, list] of byPayment) {
    if (list.length > 1) {
      // Unique constraint should prevent this; evidence of a bypass = CRITICAL.
      out.push({
        findingKey: findingKey(ReconciliationCategory.DUPLICATE_RECORD, "SubscriptionCharge", paymentId, "DUP_PAYMENT"),
        category: ReconciliationCategory.DUPLICATE_RECORD,
        severity: ReconciliationSeverity.CRITICAL,
        entityType: "SubscriptionCharge",
        entityId: list[0].id,
        expectedValue: { distinctChargesForPayment: 1 },
        observedValue: { distinctChargesForPayment: list.length },
        evidence: { paymentId, chargeIds: list.map((c) => c.id) },
        proposedAction: null,
      })
    }
  }
  for (const r of rows) {
    if (r.chargeStatus === "FAILED") {
      out.push({
        findingKey: findingKey(ReconciliationCategory.MISSING_PROVIDER_EVIDENCE, "SubscriptionCharge", r.id, "FAILED_CHARGE"),
        category: ReconciliationCategory.MISSING_PROVIDER_EVIDENCE,
        severity: ReconciliationSeverity.HIGH,
        entityType: "SubscriptionCharge",
        entityId: r.id,
        expectedValue: { chargeStatus: "SUCCEEDED" },
        observedValue: { chargeStatus: r.chargeStatus, amountSubunits: r.amountSubunits, currency: r.currency },
        evidence: { razorpaySubscriptionId: r.razorpaySubscriptionId, paymentId: r.razorpayPaymentId },
        proposedAction: null,
      })
    }
    if (r.amountSubunits <= 0) {
      out.push({
        findingKey: findingKey(ReconciliationCategory.AMOUNT_OR_CURRENCY_MISMATCH, "SubscriptionCharge", r.id, "NONPOSITIVE"),
        category: ReconciliationCategory.AMOUNT_OR_CURRENCY_MISMATCH,
        severity: ReconciliationSeverity.HIGH,
        entityType: "SubscriptionCharge",
        entityId: r.id,
        expectedValue: { amountSubunits: "> 0" },
        observedValue: { amountSubunits: r.amountSubunits, currency: r.currency },
        evidence: { paymentId: r.razorpayPaymentId },
        proposedAction: null,
      })
    }
  }
  void now
  void th
  return out
}

// ── Category C: subscription lifecycle ───────────────────────────────────────

export interface SubscriptionRow {
  id: string
  userId: string
  status: string
  planVersionId: string | null
  razorpaySubscriptionId: string | null
  currentPeriodStart: Date
  currentPeriodEnd: Date
  updatedAt: Date
}

export function ruleSubscriptionLifecycle(
  rows: SubscriptionRow[],
  now: Date,
  th: ReconciliationThresholds = DEFAULT_THRESHOLDS,
): FindingDraft[] {
  const out: FindingDraft[] = []
  for (const r of rows) {
    // Pending activation beyond the window: TRIALING/UNPAID created with a
    // provider reference but never activated (webhook may be delayed/lost).
    if ((r.status === "TRIALING" || r.status === "UNPAID") && r.razorpaySubscriptionId) {
      const ageMin = (now.getTime() - r.updatedAt.getTime()) / 60_000
      if (ageMin > th.pendingActivationMinutes) {
        out.push({
          findingKey: findingKey(ReconciliationCategory.STALE_SUBSCRIPTION_STATE, "UserSubscription", r.id, "PENDING_ACTIVATION"),
          category: ReconciliationCategory.STALE_SUBSCRIPTION_STATE,
          severity: ReconciliationSeverity.MEDIUM,
          entityType: "UserSubscription",
          entityId: r.id,
          expectedValue: { status: "provider-verified" },
          observedValue: { status: r.status, ageMinutes: Math.round(ageMin) },
          evidence: { razorpaySubscriptionId: r.razorpaySubscriptionId, thresholdMinutes: th.pendingActivationMinutes },
          proposedAction: null,
        })
      }
    }
    // Internal ACTIVE but period long past and no renewal — flag for verification.
    if (r.status === "ACTIVE" && r.currentPeriodEnd.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
      out.push({
        findingKey: findingKey(ReconciliationCategory.STALE_SUBSCRIPTION_STATE, "UserSubscription", r.id, "PERIOD_PAST_END"),
        category: ReconciliationCategory.STALE_SUBSCRIPTION_STATE,
        severity: ReconciliationSeverity.MEDIUM,
        entityType: "UserSubscription",
        entityId: r.id,
        expectedValue: { currentPeriodEnd: ">= now" },
        observedValue: { currentPeriodEnd: r.currentPeriodEnd.toISOString(), status: r.status },
        evidence: { razorpaySubscriptionId: r.razorpaySubscriptionId },
        proposedAction: null,
      })
    }
  }
  return out
}

// ── Category E: entitlement & provisioning consistency ───────────────────────

export interface ProvisioningRow {
  id: string
  subscriptionId: string
  operation: string
  periodRef: string | null
  status: string
  attemptCount: number
  errorCode: string | null
  updatedAt: Date
}

export interface GrantRow {
  id: string
  entitlementKey: string
  sourceType: string
  sourceReference: string
  status: string
  expiresAt: Date | null
}

export function ruleProvisioning(
  rows: ProvisioningRow[],
  now: Date,
  th: ReconciliationThresholds = DEFAULT_THRESHOLDS,
): FindingDraft[] {
  const draft = (r: ProvisioningRow): FindingDraft => {
    const retryable = r.status === "FAILED_RETRYABLE"
    return {
      findingKey: findingKey(ReconciliationCategory.FAILED_PROVISIONING, "SubscriptionProvisioning", r.id, r.status),
      category: ReconciliationCategory.FAILED_PROVISIONING,
      severity: retryable ? ReconciliationSeverity.MEDIUM : ReconciliationSeverity.HIGH,
      entityType: "SubscriptionProvisioning",
      entityId: r.id,
      expectedValue: { status: "SUCCEEDED" },
      observedValue: { status: r.status, attempts: r.attemptCount, errorCode: r.errorCode },
      evidence: { subscriptionId: r.subscriptionId, operation: r.operation, periodRef: r.periodRef },
      // Idempotent: Phase-5 retries reuse the same dedupe identity.
      proposedAction: retryable ? "REPROCESS_PROVISIONING" : null,
    }
  }
  void now
  void th
  return rows
    .filter((r) => r.status === "FAILED_RETRYABLE" || r.status === "FAILED_PERMANENT")
    .map(draft)
}

export interface SubscriptionStateRow {
  id: string
  status: string
}

export function ruleEntitlementConsistency(
  grants: GrantRow[],
  subscriptions: SubscriptionStateRow[],
  now: Date,
): FindingDraft[] {
  const out: FindingDraft[] = []
  const subById = new Map(subscriptions.map((s) => [s.id, s]))
  for (const g of grants) {
    if (g.sourceType !== "SUBSCRIPTION") continue
    const sub = subById.get(g.sourceReference)
    // Expired grant still ACTIVE = read-time rule says access is already denied,
    // but the record should be retired through the existing Phase-3 expiry op.
    if (g.status === "ACTIVE" && g.expiresAt && g.expiresAt.getTime() <= now.getTime()) {
      out.push({
        findingKey: findingKey(ReconciliationCategory.ENTITLEMENT_MISMATCH, "EntitlementGrant", g.id, "EXPIRED_STILL_ACTIVE"),
        category: ReconciliationCategory.ENTITLEMENT_MISMATCH,
        severity: ReconciliationSeverity.LOW,
        entityType: "EntitlementGrant",
        entityId: g.id,
        expectedValue: { status: "EXPIRED" },
        observedValue: { status: g.status, expiresAt: g.expiresAt.toISOString() },
        evidence: { entitlementKey: g.entitlementKey, sourceReference: g.sourceReference },
        proposedAction: "EXPIRE_STALE_GRANT",
      })
    }
    // Active source-bound grant for a subscription that has ended = access
    // leak via the stale record (resolver may still honour it if no expiry).
    if (
      g.status === "ACTIVE" &&
      sub &&
      (sub.status === "CANCELED" || sub.status === "EXPIRED") &&
      (!g.expiresAt || g.expiresAt.getTime() > now.getTime())
    ) {
      out.push({
        findingKey: findingKey(ReconciliationCategory.ENTITLEMENT_MISMATCH, "EntitlementGrant", g.id, "SOURCE_ENDED"),
        category: ReconciliationCategory.ENTITLEMENT_MISMATCH,
        severity: ReconciliationSeverity.CRITICAL,
        entityType: "EntitlementGrant",
        entityId: g.id,
        expectedValue: { grantedFor: "active-subscription" },
        observedValue: { subscriptionStatus: sub.status, grantStatus: g.status },
        evidence: { entitlementKey: g.entitlementKey, sourceReference: g.sourceReference },
        // Source-bound revocation through the existing Phase-5 operation.
        proposedAction: "REVOKE_SUBSCRIPTION_GRANTS",
      })
    }
  }
  return out
}

export interface TrialRow {
  id: string
  userId: string
  status: string
  expiresAt: Date | null
}

export function ruleTrialExpiry(rows: TrialRow[], now: Date): FindingDraft[] {
  const out: FindingDraft[] = []
  for (const r of rows) {
    if (r.status === "ACTIVE" && r.expiresAt && r.expiresAt.getTime() <= now.getTime()) {
      out.push({
        findingKey: findingKey(ReconciliationCategory.ENTITLEMENT_MISMATCH, "TrialEnrollment", r.id, "EXPIRED_STILL_ACTIVE"),
        category: ReconciliationCategory.ENTITLEMENT_MISMATCH,
        severity: ReconciliationSeverity.MEDIUM,
        entityType: "TrialEnrollment",
        entityId: r.id,
        expectedValue: { status: "EXPIRED" },
        observedValue: { status: r.status, expiresAt: r.expiresAt.toISOString() },
        evidence: { userId: r.userId },
        proposedAction: "EXPIRE_STALE_TRIALS",
      })
    }
  }
  return out
}
