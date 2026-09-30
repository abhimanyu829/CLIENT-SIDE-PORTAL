import { describe, expect, it } from "vitest"
import { z } from "zod"
import { FailClosedAuthorizer, AllowAllForTestingAuthorizer } from "../mcp/authorization-hook"
import { AuthorizationDeniedError } from "../mcp/errors"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"

function capability(): CapabilityDefinition {
  return {
    id: "products.list",
    version: 1,
    domain: "products",
    name: "n",
    description: "d",
    status: "ACTIVE",
    operationType: "READ",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({}).strict(),
    errorContract: [],
    requiredIdentityContext: [],
    resource: { resourceType: "Product" },
    permission: { permission: "read:products" },
    sideEffects: { effects: [] },
    idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "x", class: "IDEMPOTENT" },
    async: { executionMode: "SYNC" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "x" },
    executionReference: { adapterKey: "products.listAdapter" },
  }
}

function context(): AgentExecutionContext {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    ownerId: "owner_1",
    connectionStatus: "ACTIVE",
    capabilityId: "products.list",
    capabilityVersion: 1,
    environment: "development",
    timestamp: new Date(),
    signal: new AbortController().signal,
    tracing: { requestId: "req_1", connectionId: "conn_1", capabilityId: "products.list", capabilityVersion: 1 },
  }
}

describe("FailClosedAuthorizer", () => {
  it("denies every call by default — production safety requirement", async () => {
    const authorizer = new FailClosedAuthorizer()
    await expect(authorizer.authorize(context(), capability(), {}, {})).rejects.toBeInstanceOf(AuthorizationDeniedError)
  })

  it("denies regardless of capability risk tier (even a plain READ)", async () => {
    const authorizer = new FailClosedAuthorizer()
    const readCapability = capability()
    await expect(authorizer.authorize(context(), readCapability, {}, {})).rejects.toThrow()
  })
})

describe("AllowAllForTestingAuthorizer", () => {
  it("is permissive — TEST-ONLY, never imported by production code", async () => {
    const authorizer = new AllowAllForTestingAuthorizer()
    await expect(authorizer.authorize(context(), capability(), {}, {})).resolves.toBeUndefined()
  })
})
