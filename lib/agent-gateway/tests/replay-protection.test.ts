import { describe, expect, it, vi } from "vitest"

describe("checkAndConsumeNonce", () => {
  it("fails closed (REDIS_UNAVAILABLE) when Redis is not configured", async () => {
    vi.resetModules()
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const { checkAndConsumeNonce } = await import("../auth/replay-protection")
    const result = await checkAndConsumeNonce("key1", "nonce1")
    expect(result).toEqual({ ok: false, reason: "REDIS_UNAVAILABLE" })
  })

  it("allows a first-seen nonce and detects a replay of the same nonce", async () => {
    vi.resetModules()
    const store = new Map<string, string>()
    const fakeRedis = {
      set: vi.fn(async (key: string, value: string, opts: { nx?: boolean; ex?: number }) => {
        if (opts?.nx && store.has(key)) return null
        store.set(key, value)
        return "OK"
      }),
    }
    vi.doMock("@/lib/redis", () => ({ redis: fakeRedis }))
    const { checkAndConsumeNonce } = await import("../auth/replay-protection")

    const first = await checkAndConsumeNonce("key1", "nonce-abc")
    expect(first).toEqual({ ok: true })

    const second = await checkAndConsumeNonce("key1", "nonce-abc")
    expect(second).toEqual({ ok: false, reason: "REPLAY_DETECTED" })
  })

  it("treats the same nonce under different keyIds as distinct", async () => {
    vi.resetModules()
    const store = new Map<string, string>()
    const fakeRedis = {
      set: vi.fn(async (key: string, value: string, opts: { nx?: boolean; ex?: number }) => {
        if (opts?.nx && store.has(key)) return null
        store.set(key, value)
        return "OK"
      }),
    }
    vi.doMock("@/lib/redis", () => ({ redis: fakeRedis }))
    const { checkAndConsumeNonce } = await import("../auth/replay-protection")

    const forKeyA = await checkAndConsumeNonce("key-A", "shared-nonce")
    const forKeyB = await checkAndConsumeNonce("key-B", "shared-nonce")
    expect(forKeyA).toEqual({ ok: true })
    expect(forKeyB).toEqual({ ok: true })
  })

  it("fails closed (REDIS_UNAVAILABLE) when the Redis call throws", async () => {
    vi.resetModules()
    const fakeRedis = { set: vi.fn(async () => { throw new Error("connection reset") }) }
    vi.doMock("@/lib/redis", () => ({ redis: fakeRedis }))
    const { checkAndConsumeNonce } = await import("../auth/replay-protection")
    const result = await checkAndConsumeNonce("key1", "nonce1")
    expect(result).toEqual({ ok: false, reason: "REDIS_UNAVAILABLE" })
  })
})
