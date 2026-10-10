/**
 * Phase 10 — Pure reconciliation rules (no DB).
 */
import { describe, expect, it } from "vitest"
import { ReconciliationCategory, ReconciliationSeverity } from "@prisma/client"
import {
  DEFAULT_THRESHOLDS,
  findingKey,
  ruleChargeRecords,
  ruleEntitlementConsistency,
  ruleProvisioning,
  ruleSubscriptionLifecycle,
  ruleTrialExpiry,
  ruleUnprocessedEvents,
} from "@/lib/services/reconciliation/rules"

const NOW = new Date("2026-10-10T12:00:00Z")
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000)

describe("Category A — event ingestion rules", () => {
  it("FAILED events become HIGH findings; stale PENDING MEDIUM; fresh PENDING none", () => {
    const drafts = ruleUnprocessedEvents(
      [
        { eventId: "e_fail", eventType: "subscription.charged", status: "FAILED", receivedAt: minutesAgo(1), errorMessage: "boom" },
        { eventId: "e_old", eventType: "subscription.activated", status: "PENDING", receivedAt: minutesAgo(30), errorMessage: null },
        { eventId: "e_new", eventType: "subscription.charged", status: "PENDING", receivedAt: minutesAgo(1), errorMessage: null },
        { eventId: "e_done", eventType: "subscription.charged", status: "PROCESSED", receivedAt: minutesAgo(60), errorMessage: null },
      ],
      NOW,
    )
    expect(drafts).toHaveLength(2)
    const failed = drafts.find((d) => d.entityId === "e_fail")!
    expect(failed.severity).toBe(ReconciliationSeverity.HIGH)
    expect(failed.proposedAction).toBeNull() // replay never automatic
    expect(drafts.find((d) => d.entityId === "e_old")!.severity).toBe(ReconciliationSeverity.MEDIUM)
    expect(drafts.some((d) => d.entityId === "e_new")).toBe(false)
  })

  it("PROCESSED events never produce findings", () => {
    expect(
      ruleUnprocessedEvents(
        [{ eventId: "e", eventType: "x", status: "PROCESSED", receivedAt: minutesAgo(120), errorMessage: null }],
        NOW,
      ),
    ).toEqual([])
  })
})

describe("Category B — charge rules", () => {
  it("detects duplicate payment references as CRITICAL", () => {
    const base = { razorpaySubscriptionId: "sub_1", razorpayPaymentId: "pay_1", amountSubunits: 10000, currency: "INR", chargeStatus: "SUCCEEDED", createdAt: minutesAgo(5) }
    const drafts = ruleChargeRecords(
      [
        { id: "c1", ...base },
        { id: "c2", ...base },
      ],
      NOW,
    )
    const dup = drafts.find((d) => d.category === ReconciliationCategory.DUPLICATE_RECORD)!
    expect(dup.severity).toBe(ReconciliationSeverity.CRITICAL)
  })

  it("detects FAILED charges and non-positive amounts with the correct representation", () => {
    const drafts = ruleChargeRecords(
      [
        { id: "c_fail", razorpaySubscriptionId: "s", razorpayPaymentId: "p1", amountSubunits: 10000, currency: "INR", chargeStatus: "FAILED", createdAt: minutesAgo(5) },
        { id: "c_zero", razorpaySubscriptionId: "s", razorpayPaymentId: null, amountSubunits: 0, currency: "INR", chargeStatus: "SUCCEEDED", createdAt: minutesAgo(5) },
        { id: "c_ok", razorpaySubscriptionId: "s", razorpayPaymentId: "p2", amountSubunits: 99900, currency: "INR", chargeStatus: "SUCCEEDED", createdAt: minutesAgo(5) },
      ],
      NOW,
    )
    expect(drafts).toHaveLength(2)
    expect(drafts.find((d) => d.entityId === "c_zero")!.category).toBe(ReconciliationCategory.AMOUNT_OR_CURRENCY_MISMATCH)
    expect(drafts.find((d) => d.entityId === "c_fail")!.observedValue).toMatchObject({ amountSubunits: 10000, currency: "INR" })
    expect(drafts.some((d) => d.entityId === "c_ok")).toBe(false)
  })
})

describe("Category C — subscription lifecycle rules", () => {
  it("flags stale pending activation beyond the window only", () => {
    const drafts = ruleSubscriptionLifecycle(
      [
        { id: "stale", userId: "u", status: "TRIALING", planVersionId: "v", razorpaySubscriptionId: "sub_a", currentPeriodStart: minutesAgo(200), currentPeriodEnd: minutesAgo(-100), updatedAt: minutesAgo(120) },
        { id: "fresh", userId: "u", status: "TRIALING", planVersionId: "v", razorpaySubscriptionId: "sub_b", currentPeriodStart: minutesAgo(5), currentPeriodEnd: minutesAgo(-100), updatedAt: minutesAgo(5) },
        { id: "active_ok", userId: "u", status: "ACTIVE", planVersionId: "v", razorpaySubscriptionId: "sub_c", currentPeriodStart: minutesAgo(-100), currentPeriodEnd: minutesAgo(-5000), updatedAt: minutesAgo(5) },
      ],
      NOW,
    )
    expect(drafts.map((d) => d.entityId)).toEqual(["stale"])
    expect(drafts[0].category).toBe(ReconciliationCategory.STALE_SUBSCRIPTION_STATE)
  })

  it("flags ACTIVE subscriptions whose verified period ended >24h ago", () => {
    const drafts = ruleSubscriptionLifecycle(
      [{ id: "overdue", userId: "u", status: "ACTIVE", planVersionId: "v", razorpaySubscriptionId: "sub", currentPeriodStart: minutesAgo(-5000), currentPeriodEnd: minutesAgo(2 * 24 * 60), updatedAt: minutesAgo(60 * 24 * 2) }],
      NOW,
    )
    expect(drafts.find((d) => d.entityId === "overdue")?.category).toBe(ReconciliationCategory.STALE_SUBSCRIPTION_STATE)
  })
})

describe("Category E — provisioning, entitlements, trials", () => {
  it("retryable provisioning failures propose REPROCESS; permanent stays detection-only", () => {
    const drafts = ruleProvisioning(
      [
        { id: "p_r", subscriptionId: "s1", operation: "INITIAL_ACTIVATION", periodRef: "ev1", status: "FAILED_RETRYABLE", attemptCount: 1, errorCode: "PROVISIONING_TRANSIENT", updatedAt: minutesAgo(5) },
        { id: "p_p", subscriptionId: "s2", operation: "INITIAL_ACTIVATION", periodRef: "ev2", status: "FAILED_PERMANENT", attemptCount: 3, errorCode: "PROVISIONING_DEFINITION_MISSING", updatedAt: minutesAgo(5) },
      ],
      NOW,
    )
    expect(drafts).toHaveLength(2)
    expect(drafts.find((d) => d.entityId === "p_r")!.proposedAction).toBe("REPROCESS_PROVISIONING")
    expect(drafts.find((d) => d.entityId === "p_p")!.proposedAction).toBeNull()
    expect(drafts.find((d) => d.entityId === "p_r")!.evidence).toMatchObject({ periodRef: "ev1" })
  })

  it("source isolation: expired-still-active = LOW repairable; ended-source ACTIVE grant = CRITICAL source-bound", () => {
    const drafts = ruleEntitlementConsistency(
      [
        { id: "g_late", entitlementKey: "product.p1", sourceType: "SUBSCRIPTION", sourceReference: "s1", status: "ACTIVE", expiresAt: minutesAgo(1) },
        { id: "g_leak", entitlementKey: "product.p1", sourceType: "SUBSCRIPTION", sourceReference: "s1", status: "ACTIVE", expiresAt: null },
        { id: "g_standalone", entitlementKey: "product.p1", sourceType: "STANDALONE_PURCHASE", sourceReference: "o1", status: "ACTIVE", expiresAt: null },
      ],
      [{ id: "s1", status: "CANCELED" }],
      NOW,
    )
    // standalone source never considered
    expect(drafts.every((d) => d.entityId !== "g_standalone")).toBe(true)
    const leak = drafts.find((d) => d.entityId === "g_leak")!
    expect(leak.severity).toBe(ReconciliationSeverity.CRITICAL)
    expect(leak.proposedAction).toBe("REVOKE_SUBSCRIPTION_GRANTS")
    const late = drafts.find((d) => d.entityId === "g_late")!
    expect(late.proposedAction).toBe("EXPIRE_STALE_GRANT")
  })

  it("expired ACTIVE trials propose EXPIRE_STALE_TRIALS; future trials none", () => {
    const drafts = ruleTrialExpiry(
      [
        { id: "t_late", userId: "u", status: "ACTIVE", expiresAt: minutesAgo(1) },
        { id: "t_ok", userId: "u", status: "ACTIVE", expiresAt: new Date(NOW.getTime() + 86_400_000) },
        { id: "t_done", userId: "u", status: "EXPIRED", expiresAt: minutesAgo(1) },
      ],
      NOW,
    )
    expect(drafts).toHaveLength(1)
    expect(drafts[0].entityId).toBe("t_late")
    expect(drafts[0].proposedAction).toBe("EXPIRE_STALE_TRIALS")
  })
})

describe("thresholds and identity", () => {
  it("default thresholds are documented policy values", () => {
    expect(DEFAULT_THRESHOLDS.unprocessedEventMinutes).toBe(15)
    expect(DEFAULT_THRESHOLDS.pendingActivationMinutes).toBe(60)
  })

  it("findingKey is deterministic and category/entity/signal scoped", () => {
    const k = findingKey(ReconciliationCategory.FAILED_PROVISIONING, "X", "id1", "SIG")
    expect(k).toBe(findingKey(ReconciliationCategory.FAILED_PROVISIONING, "X", "id1", "SIG"))
    expect(k).not.toBe(findingKey(ReconciliationCategory.FAILED_PROVISIONING, "X", "id2", "SIG"))
    expect(k).not.toBe(findingKey(ReconciliationCategory.FAILED_PROVISIONING, "X", "id1", "OTHER"))
  })
})