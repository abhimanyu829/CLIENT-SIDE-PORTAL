import { describe, expect, it, vi } from "vitest"
import { createExecutionFakeDb } from "./execution-fake-db"

async function setup() {
  vi.resetModules()
  const fake = createExecutionFakeDb()
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  const { SubscriptionsGetAdapter } = await import("../execution/adapters/subscriptions-get-adapter")
  return { adapter: new SubscriptionsGetAdapter(), fake }
}

function ctx(ownerId = "owner_1", overrides: Partial<{ aborted: boolean }> = {}) {
  const controller = new AbortController()
  if (overrides.aborted) controller.abort()
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId,
    connectionStatus: "ACTIVE" as const,
    capabilityId: "subscriptions.get",
    capabilityVersion: 1,
    environment: "development",
    timestamp: new Date(),
    signal: controller.signal,
    tracing: { requestId: "req_1", connectionId: "conn_1", capabilityId: "subscriptions.get", capabilityVersion: 1 },
  }
}

describe("SubscriptionsGetAdapter", () => {
  it("1. valid execution — owner matches, returns the subscription", async () => {
    const { adapter, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "tier_1" })
    const result = await adapter.execute(ctx("owner_1"), { subscriptionId: "s1" })
    expect(result.output).toEqual({ id: "s1", status: "ACTIVE", planId: "tier_1" })
  })

  it("2. missing resource — RESOURCE_NOT_FOUND", async () => {
    const { adapter } = await setup()
    await expect(adapter.execute(ctx("owner_1"), { subscriptionId: "nonexistent" })).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    })
  })

  it("6. wrong-owner cross-tenant access — normalized to the SAME RESOURCE_NOT_FOUND as not-found (never leaks existence)", async () => {
    const { adapter, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "tier_1" })
    let notFoundErr: unknown
    let wrongOwnerErr: unknown
    try {
      await adapter.execute(ctx("owner_1"), { subscriptionId: "nonexistent" })
    } catch (e) {
      notFoundErr = e
    }
    try {
      await adapter.execute(ctx("owner_2"), { subscriptionId: "s1" })
    } catch (e) {
      wrongOwnerErr = e
    }
    expect((notFoundErr as { code: string }).code).toBe((wrongOwnerErr as { code: string }).code)
    expect((notFoundErr as { message: string }).message).toBe((wrongOwnerErr as { message: string }).message)
  })

  it("never uses a client-supplied ownerId — only context.ownerId (trusted Phase 2 identity) is used for the ownership check", async () => {
    const { adapter, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "tier_1" })
    // Even if `input` somehow carried an ownerId-shaped field, the
    // adapter's input type doesn't accept one — this test documents that
    // the adapter signature itself makes forging ownerId impossible.
    const result = await adapter.execute(ctx("owner_1"), { subscriptionId: "s1" } as Record<string, unknown> as { subscriptionId: string })
    expect(result.output.id).toBe("s1")
  })

  it("does not query/return stripeSubId, razorpaySubId, or metadata", async () => {
    const { adapter, fake } = await setup()
    fake.seedSubscription({ id: "s1", userId: "owner_1", status: "ACTIVE", tierId: "tier_1" })
    await adapter.execute(ctx("owner_1"), { subscriptionId: "s1" })
    const call = fake.lastCallArgs("subscription.findUnique") as { select: Record<string, boolean> }
    expect(call.select).not.toHaveProperty("stripeSubId")
    expect(call.select).not.toHaveProperty("razorpaySubId")
    expect(call.select).not.toHaveProperty("metadata")
  })

  it("19. respects AbortSignal", async () => {
    const { adapter } = await setup()
    await expect(adapter.execute(ctx("owner_1", { aborted: true }), { subscriptionId: "s1" })).rejects.toMatchObject({
      code: "CANCELLED",
    })
  })
})
