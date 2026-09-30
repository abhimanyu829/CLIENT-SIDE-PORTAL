import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("GatewayRedisRateLimiter", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("fails closed (denied) when Redis is not configured", async () => {
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const { GatewayRedisRateLimiter } = await import("../limits/rate-limiter")
    const limiter = new GatewayRedisRateLimiter()
    const result = await limiter.check("conn:test-1")
    expect(result.allowed).toBe(false)
  })
})
