/**
 * Phase 1 — Subscription state machine tests (pure, no DB).
 */
import { describe, expect, it, vi } from "vitest"
import { SubStatus } from "@prisma/client"
import {
  ALLOWED_INITIAL_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_ENVIRONMENTS,
  SUBSCRIPTION_SOURCES,
  SUBSCRIPTION_TRANSITIONS,
  SubscriptionTransitionError,
  SubscriptionValidationError,
  assertAllowedInitialStatus,
  assertSubscriptionTransition,
  assertValidSubscriptionSource,
  canTransitionSubscriptionStatus,
  currentSubscriptionEnvironment,
  isSubscriptionStatus,
  isTerminalSubscriptionStatus,
  normalizeSubscriptionEnvironment,
} from "@/lib/services/subscription-state-machine"

const ALL: SubStatus[] = [
  SubStatus.TRIALING,
  SubStatus.ACTIVE,
  SubStatus.PAST_DUE,
  SubStatus.PAUSED,
  SubStatus.CANCELLED,
]

describe("subscription state machine — transition table", () => {
  it("allows every documented legal transition", () => {
    const legal: Array<[SubStatus, SubStatus]> = [
      [SubStatus.TRIALING, SubStatus.ACTIVE],
      [SubStatus.TRIALING, SubStatus.PAST_DUE],
      [SubStatus.TRIALING, SubStatus.PAUSED],
      [SubStatus.TRIALING, SubStatus.CANCELLED],
      [SubStatus.ACTIVE, SubStatus.PAST_DUE],
      [SubStatus.ACTIVE, SubStatus.PAUSED],
      [SubStatus.ACTIVE, SubStatus.CANCELLED],
      [SubStatus.PAST_DUE, SubStatus.ACTIVE],
      [SubStatus.PAST_DUE, SubStatus.PAUSED],
      [SubStatus.PAST_DUE, SubStatus.CANCELLED],
      [SubStatus.PAUSED, SubStatus.ACTIVE],
      [SubStatus.PAUSED, SubStatus.PAST_DUE],
      [SubStatus.PAUSED, SubStatus.CANCELLED],
      [SubStatus.CANCELLED, SubStatus.ACTIVE],
    ]
    for (const [from, to] of legal) {
      expect(canTransitionSubscriptionStatus(from, to), `${from} -> ${to}`).toBe(true)
    }
  })

  it("rejects every illegal transition", () => {
    const illegal: Array<[SubStatus, SubStatus]> = [
      [SubStatus.CANCELLED, SubStatus.PAST_DUE],
      [SubStatus.CANCELLED, SubStatus.PAUSED],
      [SubStatus.CANCELLED, SubStatus.TRIALING],
      [SubStatus.ACTIVE, SubStatus.TRIALING],
      [SubStatus.PAST_DUE, SubStatus.TRIALING],
      [SubStatus.PAUSED, SubStatus.TRIALING],
    ]
    for (const [from, to] of illegal) {
      expect(canTransitionSubscriptionStatus(from, to), `${from} -> ${to}`).toBe(false)
    }
  })

  it("treats every same-state transition as an idempotent no-op", () => {
    for (const s of ALL) {
      expect(canTransitionSubscriptionStatus(s, s), `${s} -> ${s}`).toBe(true)
    }
  })

  it("exhaustively: every (from,to) pair is either in the table, same-state, or rejected", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const allowed = canTransitionSubscriptionStatus(from, to)
        const expected =
          from === to || (SUBSCRIPTION_TRANSITIONS[from] as readonly SubStatus[]).includes(to)
        expect(allowed, `${from} -> ${to}`).toBe(expected)
      }
    }
  })

  it("assert throws SubscriptionTransitionError with exact from/to on violation", () => {
    expect(() => assertSubscriptionTransition(SubStatus.CANCELLED, SubStatus.PAST_DUE)).toThrow(
      SubscriptionTransitionError,
    )
    try {
      assertSubscriptionTransition(SubStatus.CANCELLED, SubStatus.PAST_DUE)
    } catch (err) {
      const e = err as SubscriptionTransitionError
      expect(e.code).toBe("INVALID_SUBSCRIPTION_TRANSITION")
      expect(e.from).toBe(SubStatus.CANCELLED)
      expect(e.to).toBe(SubStatus.PAST_DUE)
      expect(e.message).toBe("Invalid subscription transition CANCELLED -> PAST_DUE")
    }
  })

  it("assert is silent on legal transitions", () => {
    expect(() =>
      assertSubscriptionTransition(SubStatus.ACTIVE, SubStatus.CANCELLED),
    ).not.toThrow()
    expect(() =>
      assertSubscriptionTransition(SubStatus.CANCELLED, SubStatus.CANCELLED),
    ).not.toThrow()
  })
})

describe("subscription state machine — terminal protection", () => {
  it("marks only CANCELLED as terminal", () => {
    expect(isTerminalSubscriptionStatus(SubStatus.CANCELLED)).toBe(true)
    for (const s of ALL.filter((x) => x !== SubStatus.CANCELLED)) {
      expect(isTerminalSubscriptionStatus(s), s).toBe(false)
    }
  })

  it("terminal state only exits via ACTIVE (explicit reactivation)", () => {
    expect(SUBSCRIPTION_TRANSITIONS[SubStatus.CANCELLED]).toEqual([SubStatus.ACTIVE])
  })
})

describe("subscription state machine — source validation", () => {
  it("accepts the controlled source set", () => {
    for (const s of SUBSCRIPTION_SOURCES) {
      expect(isValidSource(s)).toBe(true)
      expect(() => assertValidSubscriptionSource(s)).not.toThrow()
    }
  })

  it("rejects unknown sources", () => {
    for (const bad of ["paypal", "CHECKOUT ", "", "PHISH", 42, null, undefined, {}]) {
      expect(isValidSource(bad), String(bad)).toBe(false)
      expect(() => assertValidSubscriptionSource(bad)).toThrow(SubscriptionValidationError)
    }
  })
})

describe("subscription state machine — environment validation", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeSubscriptionEnvironment("Production")).toBe("production")
    expect(normalizeSubscriptionEnvironment(" test ")).toBe("test")
    expect(normalizeSubscriptionEnvironment("DEVELOPMENT")).toBe("development")
  })

  it("rejects anything outside the controlled set", () => {
    for (const bad of ["staging", "prod", "", "  ", 7, null, undefined]) {
      expect(() => normalizeSubscriptionEnvironment(bad)).toThrow(SubscriptionValidationError)
    }
  })

  it("controlled set is exactly development/test/production", () => {
    expect([...SUBSCRIPTION_ENVIRONMENTS]).toEqual(["development", "test", "production"])
  })

  it("currentSubscriptionEnvironment maps NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(currentSubscriptionEnvironment()).toBe("production")
    vi.stubEnv("NODE_ENV", "test")
    expect(currentSubscriptionEnvironment()).toBe("test")
    vi.stubEnv("NODE_ENV", "development")
    expect(currentSubscriptionEnvironment()).toBe("development")
    vi.stubEnv("NODE_ENV", "")
    expect(currentSubscriptionEnvironment()).toBe("development")
    vi.unstubAllEnvs()
  })
})

describe("subscription state machine — initial status + status recognition", () => {
  it("allows only TRIALING/ACTIVE as initial status", () => {
    expect([...ALLOWED_INITIAL_SUBSCRIPTION_STATUSES]).toEqual([
      SubStatus.TRIALING,
      SubStatus.ACTIVE,
    ])
    expect(() => assertAllowedInitialStatus("TRIALING")).not.toThrow()
    expect(() => assertAllowedInitialStatus("ACTIVE")).not.toThrow()
    for (const bad of ["PAUSED", "CANCELLED", "PAST_DUE", "banana", 9, null]) {
      expect(() => assertAllowedInitialStatus(bad)).toThrow(SubscriptionValidationError)
    }
  })

  it("recognizes exactly the five SubStatus values", () => {
    for (const s of ALL) expect(isSubscriptionStatus(s), s).toBe(true)
    for (const bad of ["active", "CANCEL", "DONE", "", 1, null]) {
      expect(isSubscriptionStatus(bad), String(bad)).toBe(false)
    }
  })
})

function isValidSource(v: unknown): boolean {
  try {
    assertValidSubscriptionSource(v)
    return true
  } catch {
    return false
  }
}
