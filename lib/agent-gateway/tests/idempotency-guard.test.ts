import { describe, expect, it, vi, beforeEach } from "vitest"
import { z } from "zod"
import type { CapabilityDefinition } from "../capabilities/types"

function makeCapability(overrides: Partial<CapabilityDefinition["idempotency"]> = {}): CapabilityDefinition {
  return {
    id: "test.write",
    version: 1,
    domain: "test",
    name: "n",
    description: "d",
    status: "ACTIVE",
    operationType: "LOW_RISK_WRITE",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({}).strict(),
    errorContract: [],
    requiredIdentityContext: [],
    resource: { resourceType: "Test" },
    permission: { permission: null },
    sideEffects: { effects: [] },
    idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "x", class: "IDEMPOTENT", ...overrides },
    async: { executionMode: "SYNC" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "x" },
    executionReference: { adapterKey: "test.writeAdapter" },
  }
}

describe("checkIdempotency", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("20. NOT_REQUIRED when the capability does not declare requiresIdempotencyKey", async () => {
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const { checkIdempotency } = await import("../execution/idempotency/idempotency-guard")
    const outcome = await checkIdempotency(makeCapability({ requiresIdempotencyKey: false }), "conn_1", undefined)
    expect(outcome.kind).toBe("NOT_REQUIRED")
  })

  it("REQUIRED_BUT_MISSING when required and no key was supplied", async () => {
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const { checkIdempotency } = await import("../execution/idempotency/idempotency-guard")
    const outcome = await checkIdempotency(makeCapability({ requiresIdempotencyKey: true }), "conn_1", undefined)
    expect(outcome.kind).toBe("REQUIRED_BUT_MISSING")
  })

  it("20. NEW_KEY when required, key supplied, and Redis is unavailable (fails open)", async () => {
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const { checkIdempotency } = await import("../execution/idempotency/idempotency-guard")
    const outcome = await checkIdempotency(makeCapability({ requiresIdempotencyKey: true }), "conn_1", "key_1")
    expect(outcome.kind).toBe("NEW_KEY")
  })

  it("24. duplicate execution protection — REPLAY when the same key was already recorded", async () => {
    const store = new Map<string, unknown>()
    vi.doMock("@/lib/redis", () => ({
      redis: {
        get: vi.fn(async (k: string) => store.get(k) ?? null),
        set: vi.fn(async (k: string, v: unknown) => {
          store.set(k, v)
        }),
      },
    }))
    const { checkIdempotency, recordIdempotencyResult } = await import("../execution/idempotency/idempotency-guard")
    const def = makeCapability({ requiresIdempotencyKey: true })
    const result = { output: { ok: true }, executionMode: "SYNC" as const, durationMs: 1 }

    const first = await checkIdempotency(def, "conn_1", "key_1")
    expect(first.kind).toBe("NEW_KEY")
    await recordIdempotencyResult(def, "conn_1", "key_1", result)

    const second = await checkIdempotency(def, "conn_1", "key_1")
    expect(second.kind).toBe("REPLAY")
    if (second.kind === "REPLAY") expect(second.result).toEqual(result)
  })

  it("scope: same key from a DIFFERENT connection is treated as a new, unrelated key (never cross-connection replay)", async () => {
    const store = new Map<string, unknown>()
    vi.doMock("@/lib/redis", () => ({
      redis: {
        get: vi.fn(async (k: string) => store.get(k) ?? null),
        set: vi.fn(async (k: string, v: unknown) => {
          store.set(k, v)
        }),
      },
    }))
    const { checkIdempotency, recordIdempotencyResult } = await import("../execution/idempotency/idempotency-guard")
    const def = makeCapability({ requiresIdempotencyKey: true })
    await recordIdempotencyResult(def, "conn_1", "key_1", { output: {}, executionMode: "SYNC", durationMs: 1 })

    const outcome = await checkIdempotency(def, "conn_2", "key_1")
    expect(outcome.kind).toBe("NEW_KEY")
  })

  it("22. non-idempotent-but-not-required capability never blocks execution for lack of a key", async () => {
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const { checkIdempotency } = await import("../execution/idempotency/idempotency-guard")
    const outcome = await checkIdempotency(
      makeCapability({ requiresIdempotencyKey: false, class: "NON_IDEMPOTENT" }),
      "conn_1",
      undefined
    )
    expect(outcome.kind).toBe("NOT_REQUIRED")
  })

  it("fails open on a Redis error during lookup (never throws, never blocks execution)", async () => {
    vi.doMock("@/lib/redis", () => ({
      redis: { get: vi.fn(async () => { throw new Error("redis down") }), set: vi.fn() },
    }))
    const { checkIdempotency } = await import("../execution/idempotency/idempotency-guard")
    const outcome = await checkIdempotency(makeCapability({ requiresIdempotencyKey: true }), "conn_1", "key_1")
    expect(outcome.kind).toBe("NEW_KEY")
  })
})
