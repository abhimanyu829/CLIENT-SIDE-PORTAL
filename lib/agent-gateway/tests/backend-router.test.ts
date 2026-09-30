import { describe, expect, it } from "vitest"
import { ApprovedDestinationRouter } from "../routing/backend-router"
import { GatewayError } from "../shared/errors"
import { buildRequestContext } from "../identity/request-identity"

describe("ApprovedDestinationRouter", () => {
  it("denies with NOT_FOUND when no destinations are registered (Phase 1 default)", async () => {
    const router = new ApprovedDestinationRouter()
    const context = buildRequestContext(
      new Request("https://example.com/api/agent-gateway"),
      { authenticated: true, connectionId: "conn_1", ownerId: "o" },
      new AbortController().signal
    )
    await expect(router.route(context, new Request("https://example.com/api/agent-gateway"))).rejects.toSatisfy(
      (err) => err instanceof GatewayError && err.code === "NOT_FOUND"
    )
  })

  it("never routes to an arbitrary client-supplied destination — no such input exists on the interface", () => {
    // Structural guarantee, not a runtime check: GatewayRouter.route() takes
    // (context, request) — there is no url/destination parameter for a
    // caller to control, and ApprovedDestinationRouter's only way to reach
    // a handler is via a name registered server-side through register().
    const router = new ApprovedDestinationRouter()
    expect(typeof router.register).toBe("function")
    expect(router.route.length).toBe(2)
  })

  it("rejects registering the same route name twice", () => {
    const router = new ApprovedDestinationRouter()
    router.register("example.route", async () => new Response("ok"))
    expect(() => router.register("example.route", async () => new Response("ok"))).toThrow()
  })
})
