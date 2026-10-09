/**
 * Phase 4 — Test Group D: webhook signature verification (raw body, HMAC).
 */
import { describe, expect, it, vi } from "vitest"
import crypto from "crypto"
import { verifyWebhookSignature } from "@/lib/services/razorpay-subscription-webhook"

vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("@/lib/services/event-bus", () => ({
  emitEvent: vi.fn(async () => undefined),
  EVENTS: new Proxy({}, { get: (_t, prop: string) => prop }),
}))
vi.mock("@/lib/services/cache-service", () => ({
  invalidateCache: vi.fn(async () => undefined),
  CACHE_KEYS: {},
}))
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

const SECRET = "webhook_secret_test"
const BODY = JSON.stringify({ entity: "event", id: "event_1", event: "subscription.activated", payload: { subscription: { entity: { id: "sub_test_1" } } } })

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex")
}

describe("D — webhook signature verification", () => {
  it("accepts a valid signature over the exact raw body", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true)
  })

  it("rejects an invalid signature", () => {
    expect(verifyWebhookSignature(BODY, "f".repeat(64), SECRET)).toBe(false)
  })

  it("rejects a missing or malformed signature", () => {
    expect(verifyWebhookSignature(BODY, "", SECRET)).toBe(false)
    expect(verifyWebhookSignature(BODY, "zz", SECRET)).toBe(false)
    expect(verifyWebhookSignature(BODY, null as unknown as string, SECRET)).toBe(false)
  })

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY, "other_secret"), SECRET)).toBe(false)
  })

  it("rejects a body modified after signing (tampered payload)", () => {
    const tampered = BODY.replace("activated", "cancelled")
    expect(verifyWebhookSignature(tampered, sign(BODY, SECRET), SECRET)).toBe(false)
  })

  it("verifies against RAW bytes — a re-serialized body differs", () => {
    const parsed = JSON.parse(BODY)
    const reSerialized = JSON.stringify(parsed)
    // Same logical payload, different exact bytes → different signature.
    expect(reSerialized === BODY || verifyWebhookSignature(reSerialized, sign(BODY, SECRET), SECRET)).toBe(
      reSerialized === BODY,
    )
  })

  it("rejects when no secret is configured (fail closed)", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY, SECRET), "")).toBe(false)
    expect(verifyWebhookSignature(BODY, sign(BODY, SECRET), "   ")).toBe(false)
  })
})