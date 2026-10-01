/**
 * Phase 9 — pure trigger primitives: state machine, schedule semantics
 * (timezones, DST, bounded frequency, missed-run policy at exact
 * boundaries), the event allowlist, webhook signing, configuration.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { isLegalTriggerTransition, isTerminalTriggerStatus, TRIGGER_ACTIONS, EDITABLE_TRIGGER_STATUSES } from "../triggers/state-machine"
import { TRIGGER_STATUSES, type TriggerStatus } from "../triggers/types"
import {
  assertBoundedFrequency,
  assertCronExpression,
  initialNextRunAt,
  isValidTimezone,
  nextOccurrence,
  nextOccurrences,
  planDueOccurrence,
  previousOccurrence,
  type ScheduleState,
} from "../triggers/schedule"
import { normalizeTriggerEvent, TRIGGER_EVENT_CATALOG } from "../triggers/event-catalog"
import {
  generateWebhookSecret,
  openWebhookSecret,
  parseWebhookTimestamp,
  sealWebhookSecret,
  signWebhook,
  verifyWebhookSignature,
  webhookCanonicalMessage,
} from "../triggers/secrets"
import { TriggerError } from "../triggers/errors"

const d = (iso: string) => new Date(iso)
const MIN = 60_000
const OPTS = { lateToleranceMs: 2 * MIN, catchUpWindowMs: 24 * 60 * MIN }

function cron(expr: string, nextRunAt: string, extra: Partial<ScheduleState> = {}): ScheduleState {
  return { scheduleKind: "CRON", cronExpression: expr, timezone: "UTC", runAt: null, missedRunPolicy: "SKIP", nextRunAt: d(nextRunAt), expiresAt: null, ...extra }
}

describe("Phase 9 A — trigger state machine", () => {
  const legal: Record<TriggerStatus, TriggerStatus[]> = {
    DRAFT: ["ACTIVE", "DISABLED", "REVOKED"],
    ACTIVE: ["PAUSED", "DISABLED", "EXPIRED", "REVOKED"],
    PAUSED: ["ACTIVE", "DISABLED", "EXPIRED", "REVOKED"],
    DISABLED: ["ACTIVE", "REVOKED"],
    EXPIRED: [],
    REVOKED: [],
  }

  it("matches the documented transition table for all 36 pairs", () => {
    for (const from of TRIGGER_STATUSES) {
      for (const to of TRIGGER_STATUSES) {
        expect(isLegalTriggerTransition(from, to), `${from} -> ${to}`).toBe(legal[from].includes(to))
      }
    }
  })

  it("EXPIRED and REVOKED are terminal; nothing else is", () => {
    for (const s of TRIGGER_STATUSES) expect(isTerminalTriggerStatus(s)).toBe(s === "EXPIRED" || s === "REVOKED")
  })

  it("every human action is a legal transition, and only non-firing states are editable", () => {
    for (const [action, rule] of Object.entries(TRIGGER_ACTIONS)) {
      for (const from of rule.from) expect(isLegalTriggerTransition(from, rule.to), `${action}: ${from}`).toBe(true)
    }
    expect(EDITABLE_TRIGGER_STATUSES).not.toContain("ACTIVE")
    expect(TRIGGER_ACTIONS.resume.from).toEqual(["PAUSED"])
  })

  it("stable error codes carry HTTP statuses", () => {
    expect(new TriggerError("SIGNATURE_INVALID", "x").statusCode).toBe(401)
    expect(new TriggerError("REPLAY_DETECTED", "x").statusCode).toBe(409)
    expect(new TriggerError("TRIGGER_CONFLICT", "x").statusCode).toBe(409)
    expect(new TriggerError("SCHEDULE_ERROR", "x").statusCode).toBe(400)
    expect(new TriggerError("QUEUE_UNAVAILABLE", "x").statusCode).toBe(503)
  })
})

describe("Phase 9 D — schedule syntax, timezones and DST", () => {
  it("accepts only standard numeric 5-field cron", () => {
    for (const ok of ["*/5 * * * *", "0 9 * * 1-5", "30 2 1,15 * *", "0 0 1 1 *"]) expect(() => assertCronExpression(ok)).not.toThrow()
    for (const bad of ["* * * * * *", "@daily", "0 9 * * MON", "0 9 * JAN *", "0 9 ? * *", "0 9 L * *", "", "x".repeat(101), "61 * * * *", 5]) {
      expect(() => assertCronExpression(bad), String(bad)).toThrow()
    }
  })

  it("validates IANA timezones", () => {
    for (const tz of ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"]) expect(isValidTimezone(tz)).toBe(true)
    for (const tz of ["Mars/Base", "", "UTC+5", 42, null]) expect(isValidTimezone(tz)).toBe(false)
  })

  it("evaluates in the schedule's timezone, never the server's", () => {
    expect(nextOccurrence("0 9 * * *", "UTC", d("2026-10-02T08:59:59Z"))!.toISOString()).toBe("2026-10-02T09:00:00.000Z")
    // Asia/Kolkata is UTC+05:30 with no DST.
    expect(nextOccurrence("0 9 * * *", "Asia/Kolkata", d("2026-10-02T00:00:00Z"))!.toISOString()).toBe("2026-10-02T03:30:00.000Z")
  })

  it("keeps the local wall-clock time across the US spring-forward and fall-back transitions", () => {
    const spring = nextOccurrences("0 9 * * *", "America/New_York", d("2027-03-13T00:00:00Z"), 3).map((x) => x.toISOString())
    expect(spring).toEqual(["2027-03-13T14:00:00.000Z", "2027-03-14T13:00:00.000Z", "2027-03-15T13:00:00.000Z"])
    const fall = nextOccurrences("0 9 * * *", "America/New_York", d("2026-10-31T00:00:00Z"), 3).map((x) => x.toISOString())
    expect(fall).toEqual(["2026-10-31T13:00:00.000Z", "2026-11-01T14:00:00.000Z", "2026-11-02T14:00:00.000Z"])
  })

  it("a skipped local time fires once (shifted); a repeated local time fires once", () => {
    // 02:30 does not exist on 2027-03-14 in New York: it fires once, at 03:30 EDT.
    const skipped = nextOccurrences("30 2 * * *", "America/New_York", d("2027-03-13T12:00:00Z"), 2).map((x) => x.toISOString())
    expect(skipped).toEqual(["2027-03-14T07:30:00.000Z", "2027-03-15T06:30:00.000Z"])
    // 01:30 happens twice on 2026-11-01 in New York: it fires once.
    const repeated = nextOccurrences("30 1 * * *", "America/New_York", d("2026-10-31T12:00:00Z"), 2).map((x) => x.toISOString())
    expect(repeated).toEqual(["2026-11-01T05:30:00.000Z", "2026-11-02T06:30:00.000Z"])
  })

  it("previousOccurrence is inclusive of an exact occurrence", () => {
    expect(previousOccurrence("0 * * * *", "UTC", d("2026-10-02T13:00:00Z"))!.toISOString()).toBe("2026-10-02T13:00:00.000Z")
    expect(previousOccurrence("0 * * * *", "UTC", d("2026-10-02T13:30:00Z"))!.toISOString()).toBe("2026-10-02T13:00:00.000Z")
  })

  it("bounded frequency: nothing more often than the configured minimum", () => {
    const from = d("2026-10-02T00:00:00Z")
    expect(() => assertBoundedFrequency("* * * * *", "UTC", from, 5 * MIN)).toThrow()
    expect(() => assertBoundedFrequency("*/4 * * * *", "UTC", from, 5 * MIN)).toThrow()
    expect(() => assertBoundedFrequency("0,1 9 * * *", "UTC", from, 5 * MIN)).toThrow()
    expect(() => assertBoundedFrequency("*/5 * * * *", "UTC", from, 5 * MIN)).not.toThrow()
    expect(() => assertBoundedFrequency("0 9 * * *", "America/New_York", from, 5 * MIN)).not.toThrow()
  })
})

describe("Phase 9 D — missed-run policy at exact boundaries", () => {
  it("fires on time and schedules the next occurrence", () => {
    const plan = planDueOccurrence(cron("0 * * * *", "2026-10-02T10:00:00Z"), d("2026-10-02T10:00:00Z"), OPTS)
    expect(plan).toEqual({ fire: true, scheduledFor: d("2026-10-02T10:00:00Z"), missed: false, nextRunAt: d("2026-10-02T11:00:00Z") })
  })

  it("exactly at the late tolerance is still on time; one millisecond later is missed", () => {
    const onEdge = planDueOccurrence(cron("0 * * * *", "2026-10-02T10:00:00Z"), d("2026-10-02T10:02:00.000Z"), OPTS)
    expect(onEdge.fire).toBe(true)
    expect(onEdge.missed).toBe(false)
    const late = planDueOccurrence(cron("0 * * * *", "2026-10-02T10:00:00Z"), d("2026-10-02T10:02:00.001Z"), OPTS)
    expect(late).toMatchObject({ fire: false, missed: true, scheduledFor: d("2026-10-02T10:00:00Z"), nextRunAt: d("2026-10-02T11:00:00Z") })
  })

  it("SKIP never replays a backlog; the schedule resumes at the next future occurrence", () => {
    const plan = planDueOccurrence(cron("0 * * * *", "2026-10-02T10:00:00Z"), d("2026-10-02T13:30:00Z"), OPTS)
    expect(plan).toEqual({ fire: false, scheduledFor: d("2026-10-02T13:00:00Z"), missed: true, nextRunAt: d("2026-10-02T14:00:00Z") })
  })

  it("CATCH_UP_ONCE fires exactly one run for the newest missed occurrence", () => {
    const plan = planDueOccurrence(cron("0 * * * *", "2026-10-02T10:00:00Z", { missedRunPolicy: "CATCH_UP_ONCE" }), d("2026-10-02T13:30:00Z"), OPTS)
    expect(plan).toEqual({ fire: true, scheduledFor: d("2026-10-02T13:00:00Z"), missed: true, nextRunAt: d("2026-10-02T14:00:00Z") })
  })

  it("CATCH_UP_ONCE respects the catch-up window (exact boundary included)", () => {
    const once = (runAt: string): ScheduleState => ({ scheduleKind: "ONCE", cronExpression: null, timezone: "UTC", runAt: d(runAt), missedRunPolicy: "CATCH_UP_ONCE", nextRunAt: d(runAt), expiresAt: null })
    expect(planDueOccurrence(once("2026-10-01T10:00:00Z"), d("2026-10-02T10:00:00Z"), OPTS).fire).toBe(true)
    expect(planDueOccurrence(once("2026-10-01T10:00:00Z"), d("2026-10-02T10:00:00.001Z"), OPTS).fire).toBe(false)
  })

  it("one-time schedules finish after their occurrence; SKIP drops a late one", () => {
    const state: ScheduleState = { scheduleKind: "ONCE", cronExpression: null, timezone: "UTC", runAt: d("2026-10-02T10:00:00Z"), missedRunPolicy: "SKIP", nextRunAt: d("2026-10-02T10:00:00Z"), expiresAt: null }
    expect(planDueOccurrence(state, d("2026-10-02T10:00:30Z"), OPTS)).toEqual({ fire: true, scheduledFor: d("2026-10-02T10:00:00Z"), missed: false, nextRunAt: null })
    expect(planDueOccurrence(state, d("2026-10-02T11:00:00Z"), OPTS)).toMatchObject({ fire: false, missed: true, nextRunAt: null })
  })

  it("a schedule finishes when the next occurrence would be after expiresAt", () => {
    const plan = planDueOccurrence(cron("0 * * * *", "2026-10-02T10:00:00Z", { expiresAt: d("2026-10-02T10:30:00Z") }), d("2026-10-02T10:00:00Z"), OPTS)
    expect(plan.fire).toBe(true)
    expect(plan.nextRunAt).toBeNull()
  })

  it("initial nextRunAt is always in the future (activation never replays)", () => {
    const now = d("2026-10-02T10:30:00Z")
    expect(initialNextRunAt({ scheduleKind: "CRON", cronExpression: "0 * * * *", timezone: "UTC", runAt: null, expiresAt: null }, now)!.toISOString()).toBe("2026-10-02T11:00:00.000Z")
    expect(initialNextRunAt({ scheduleKind: "ONCE", cronExpression: null, timezone: "UTC", runAt: d("2026-10-02T10:00:00Z"), expiresAt: null }, now)).toBeNull()
    expect(initialNextRunAt({ scheduleKind: "CRON", cronExpression: "0 * * * *", timezone: "UTC", runAt: null, expiresAt: d("2026-10-02T10:45:00Z") }, now)).toBeNull()
  })
})

describe("Phase 9 B — event allowlist", () => {
  const event = (type: string, payload: Record<string, unknown>, actorId?: string) => ({ type, timestamp: "2026-10-02T10:00:00.000Z", actorId, payload }) as never

  it("only allowlisted events can drive triggers; money, identity and fraud events never", () => {
    for (const t of ["PAYMENT_SUCCESS", "REFUND_PROCESSED", "USER_BANNED", "USER_ROLE_CHANGED", "WEBHOOK_RECEIVED", "COUPON_APPLIED"]) {
      expect(TRIGGER_EVENT_CATALOG[t]).toBeUndefined()
      expect(normalizeTriggerEvent(event(t, { productId: "p1" }))).toBeNull()
    }
  })

  it("reduces an event to ids only (the payload never leaves)", () => {
    const n = normalizeTriggerEvent(event("PRODUCT_UPDATED", { productId: "prod_1", productName: "Name", price: 10 }, "owner_1"))!
    expect(n).toMatchObject({ eventType: "PRODUCT_UPDATED", resourceType: "Product", resourceId: "prod_1", actorId: "owner_1", subjectUserId: null })
    expect(JSON.stringify(n)).not.toContain("Name")
    const s = normalizeTriggerEvent(event("SUBSCRIPTION_ACTIVATED", { subscriptionId: "sub_1", userId: "user_9" }))!
    expect(s).toMatchObject({ resourceType: "Subscription", resourceId: "sub_1", subjectUserId: "user_9" })
  })

  it("rejects non-plain ids", () => {
    for (const bad of ["../etc/passwd", "a b", "x".repeat(129), 123, { $ne: 1 }]) {
      expect(normalizeTriggerEvent(event("PRODUCT_UPDATED", { productId: bad }))!.resourceId).toBeNull()
    }
  })

  it("the digest identifies the exact event", () => {
    const a = normalizeTriggerEvent(event("PRODUCT_UPDATED", { productId: "p1", v: 1 }))!
    const b = normalizeTriggerEvent(event("PRODUCT_UPDATED", { v: 1, productId: "p1" }))!
    const c = normalizeTriggerEvent(event("PRODUCT_UPDATED", { productId: "p1", v: 2 }))!
    expect(a.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(a.digest).toBe(b.digest)
    expect(a.digest).not.toBe(c.digest)
  })
})

describe("Phase 9 C — webhook signing", () => {
  const parts = { timestamp: "1790000000", nonce: "nonce-abcdefghijklmnop", eventId: "evt_1", method: "POST", path: "/api/agent-webhooks/trg_0", body: '{"a":1}' }

  it("secrets are 256-bit, sealed at rest and recoverable only through decryption", () => {
    const secret = generateWebhookSecret()
    expect(secret).toMatch(/^whsec_[0-9a-f]{64}$/)
    const sealed = sealWebhookSecret(secret)
    expect(sealed).not.toContain(secret)
    expect(openWebhookSecret(sealed)).toBe(secret)
    expect(() => openWebhookSecret(sealed.replace(/.$/, (c) => (c === "0" ? "1" : "0")))).toThrow()
  })

  it("binds timestamp, nonce, event id, method, path and body digest", () => {
    const secret = generateWebhookSecret()
    const sig = signWebhook(secret, parts)
    expect(verifyWebhookSignature(secret, parts, sig)).toBe(true)
    expect(verifyWebhookSignature(secret, parts, sig.toUpperCase())).toBe(true)
    for (const [k, v] of Object.entries({ timestamp: "1790000001", nonce: "nonce-abcdefghijklmnoq", eventId: "evt_2", method: "PUT", path: "/api/agent-webhooks/trg_1", body: '{"a":2}' })) {
      expect(verifyWebhookSignature(secret, { ...parts, [k]: v }, sig), k).toBe(false)
    }
    expect(verifyWebhookSignature(generateWebhookSecret(), parts, sig)).toBe(false)
    for (const bad of ["", "zz", sig.slice(1), `${sig}00`]) expect(verifyWebhookSignature(secret, parts, bad)).toBe(false)
    expect(webhookCanonicalMessage(parts).split("\n")[0]).toBe("abhibhi.webhook.v1")
    expect(webhookCanonicalMessage(parts)).not.toContain('{"a":1}')
  })

  it("parses unix-seconds and ISO timestamps only", () => {
    expect(parseWebhookTimestamp("1790000000")).toBe(1790000000)
    expect(parseWebhookTimestamp("2026-10-02T10:00:00Z")).toBe(Math.floor(Date.parse("2026-10-02T10:00:00Z") / 1000))
    expect(parseWebhookTimestamp("yesterday")).toBeNull()
  })
})

describe("Phase 9 — configuration", () => {
  afterEach(async () => {
    vi.unstubAllEnvs()
    ;(await import("../tasks/config")).__resetTaskEngineConfigForTests()
    ;(await import("../triggers/config")).__resetTriggerConfigForTests()
  })

  it("is off by default and requires BOTH the trigger and the task switches", async () => {
    const tasks = await import("../tasks/config")
    const triggers = await import("../triggers/config")
    const read = () => {
      tasks.__resetTaskEngineConfigForTests()
      triggers.__resetTriggerConfigForTests()
      return triggers.getTriggerConfig()
    }
    vi.stubEnv("AGENT_GATEWAY_TRIGGERS_ENABLED", "")
    vi.stubEnv("AGENT_GATEWAY_TASKS_ENABLED", "")
    expect(read().enabled).toBe(false)
    vi.stubEnv("AGENT_GATEWAY_TRIGGERS_ENABLED", "true")
    expect(read().enabled).toBe(false)
    vi.stubEnv("AGENT_GATEWAY_TASKS_ENABLED", "true")
    expect(read()).toMatchObject({ enabled: true, minIntervalMs: 5 * MIN, lateToleranceMs: 2 * MIN, webhookMaxBodyBytes: 65_536 })
  })

  it("an invalid value falls back to the defaults with triggers disabled", async () => {
    const triggers = await import("../triggers/config")
    vi.stubEnv("AGENT_GATEWAY_TRIGGERS_ENABLED", "true")
    vi.stubEnv("AGENT_GATEWAY_TASKS_ENABLED", "true")
    vi.stubEnv("AGENT_GATEWAY_TRIGGER_MIN_INTERVAL_MS", "10")
    triggers.__resetTriggerConfigForTests()
    expect(triggers.getTriggerConfig().enabled).toBe(false)
  })
})
