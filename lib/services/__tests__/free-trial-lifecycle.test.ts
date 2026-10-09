/**
 * Phase 6 — Pure lifecycle rules (no DB).
 */
import { describe, expect, it } from "vitest"
import { TrialStatus } from "@prisma/client"
import {
  FreeTrialError,
  TRIAL_DURATION_DAYS,
  buildFreeEnrollmentKey,
  buildTrialScopeKey,
  canTransitionTrialStatus,
  evaluateTrialEligibility,
  isTrialExpiredAt,
  trialExpiresAtFor,
} from "@/lib/services/free-trial-lifecycle"

describe("trial duration math (UTC, exact 14 days)", () => {
  it("computes trialExpiresAt = startedAt + 14 consecutive 24-hour periods", () => {
    const start = new Date("2026-05-01T10:30:00Z")
    const end = trialExpiresAtFor(start)
    expect(end.getTime() - start.getTime()).toBe(14 * 24 * 60 * 60 * 1000)
    expect(end.toISOString()).toBe("2026-05-15T10:30:00.000Z")
  })

  it("rejects invalid start times and enforces the default policy constants", () => {
    expect(() => trialExpiresAtFor(new Date("nope"))).toThrow(FreeTrialError)
    expect(TRIAL_DURATION_DAYS).toBe(14)
  })
})

describe("scope identity", () => {
  it("trial scope key is deterministic and differs per version", () => {
    const a = buildTrialScopeKey("user_1", "v1")
    expect(a).toBe(buildTrialScopeKey("user_1", "v1"))
    expect(a).not.toBe(buildTrialScopeKey("user_1", "v2"))
    expect(a).not.toBe(buildTrialScopeKey("user_2", "v1"))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it("free enrollment key is deterministic", () => {
    expect(buildFreeEnrollmentKey("u", "v")).toBe(buildFreeEnrollmentKey("u", "v"))
    expect(buildFreeEnrollmentKey("u", "v")).not.toBe(buildFreeEnrollmentKey("u", "v2"))
  })
})

describe("trial state machine", () => {
  it("allows documented transitions and blocks resurrection", () => {
    expect(canTransitionTrialStatus(TrialStatus.PENDING, TrialStatus.ACTIVE)).toBe(true)
    expect(canTransitionTrialStatus(TrialStatus.PENDING, TrialStatus.CANCELLED)).toBe(true)
    expect(canTransitionTrialStatus(TrialStatus.ACTIVE, TrialStatus.CONVERTED)).toBe(true)
    expect(canTransitionTrialStatus(TrialStatus.ACTIVE, TrialStatus.EXPIRED)).toBe(true)
    expect(canTransitionTrialStatus(TrialStatus.ACTIVE, TrialStatus.CANCELLED)).toBe(true)
    for (const t of [TrialStatus.CONVERTED, TrialStatus.EXPIRED, TrialStatus.CANCELLED]) {
      expect(canTransitionTrialStatus(t, TrialStatus.ACTIVE), t).toBe(false)
      expect(canTransitionTrialStatus(t, TrialStatus.PENDING), t).toBe(false)
    }
  })
})

describe("expiry read-time rule (independent of cleanup)", () => {
  it("denies once now >= expiresAt even before any worker runs", () => {
    const start = new Date(Date.now() - 15 * 86400_000)
    const expired = trialExpiresAtFor(start)
    expect(isTrialExpiredAt(TrialStatus.ACTIVE, expired)).toBe(true)
    expect(isTrialExpiredAt(TrialStatus.ACTIVE, new Date(Date.now() + 86_400_000))).toBe(false)
    expect(isTrialExpiredAt(TrialStatus.EXPIRED, null)).toBe(true)
  })
})

describe("eligibility policy", () => {
  it("requires a verified account, no active/consumed trial, no paid subscription", () => {
    expect(evaluateTrialEligibility({ hasVerifiedAccount: false, hasActiveOrPendingTrial: false, hasConsumedTrial: false, hasActivePaidSubscription: false }).eligible).toBe(false)
    expect(evaluateTrialEligibility({ hasVerifiedAccount: true, hasActiveOrPendingTrial: true, hasConsumedTrial: false, hasActivePaidSubscription: false }).code).toBe("TRIAL_ALREADY_ACTIVE")
    expect(evaluateTrialEligibility({ hasVerifiedAccount: true, hasActiveOrPendingTrial: false, hasConsumedTrial: true, hasActivePaidSubscription: false }).code).toBe("TRIAL_ALREADY_USED")
    expect(evaluateTrialEligibility({ hasVerifiedAccount: true, hasActiveOrPendingTrial: false, hasConsumedTrial: false, hasActivePaidSubscription: true }).eligible).toBe(false)
    expect(evaluateTrialEligibility({ hasVerifiedAccount: true, hasActiveOrPendingTrial: false, hasConsumedTrial: false, hasActivePaidSubscription: false })).toEqual({ eligible: true, code: null })
  })
})