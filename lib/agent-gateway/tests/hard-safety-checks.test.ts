import { describe, expect, it, beforeEach } from "vitest"
import { z } from "zod"
import { CapabilityRegistry } from "../capabilities/registry"
import { AdapterRegistry } from "../execution/resolver/adapter-registry"
import { resolveExecutionTarget, assertEnvironmentMatches } from "../execution/resolver/hard-safety-checks"
import { ExecutionError } from "../execution/contracts/execution-error"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AgentGatewayRequestContext } from "../shared/types"
import type { AgentCapabilityAdapter } from "../execution/contracts/adapter"

function makeCapability(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: "test.read",
    version: 1,
    domain: "test",
    name: "n",
    description: "d",
    status: "ACTIVE",
    operationType: "READ",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({}).strict(),
    errorContract: [],
    requiredIdentityContext: ["connectionId"],
    resource: { resourceType: "Test" },
    permission: { permission: null },
    sideEffects: { effects: [] },
    idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "x", class: "IDEMPOTENT" },
    async: { executionMode: "SYNC" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "x" },
    executionReference: { adapterKey: "test.readAdapter" },
    ...overrides,
  }
}

function fakeAdapter(capabilityId: string, capabilityVersion: number): AgentCapabilityAdapter {
  return {
    capabilityId,
    capabilityVersion,
    async execute() {
      return { output: {}, executionMode: "SYNC" as const, durationMs: 0 }
    },
  }
}

function gatewayCtx(overrides: Partial<AgentGatewayRequestContext> = {}): AgentGatewayRequestContext {
  return {
    requestId: "req_1",
    receivedAt: new Date(),
    authenticated: true,
    machine: {
      connectionId: "conn_1",
      credentialId: "cred_1",
      ownerId: "owner_1",
      connectionStatus: "ACTIVE",
      authenticatedAt: new Date(),
    },
    protocol: "HTTP",
    signal: new AbortController().signal,
    ...overrides,
  }
}

describe("resolveExecutionTarget", () => {
  let capReg: CapabilityRegistry
  let adapterReg: AdapterRegistry

  beforeEach(() => {
    capReg = new CapabilityRegistry()
    adapterReg = new AdapterRegistry()
  })

  it("8. unknown capability rejection", () => {
    expect(() => resolveExecutionTarget(capReg, adapterReg, "nonexistent.cap", gatewayCtx())).toThrow(ExecutionError)
    try {
      resolveExecutionTarget(capReg, adapterReg, "nonexistent.cap", gatewayCtx())
    } catch (err) {
      expect((err as ExecutionError).code).toBe("RESOURCE_NOT_FOUND")
    }
  })

  it("9. disabled capability rejection", () => {
    capReg.register(makeCapability())
    capReg.disable("test.read", 1)
    try {
      resolveExecutionTarget(capReg, adapterReg, "test.read", gatewayCtx())
      expect.unreachable()
    } catch (err) {
      expect((err as ExecutionError).code).toBe("EXECUTION_UNAVAILABLE")
    }
  })

  it("FORBIDDEN capability is rejected even without a version suffix", () => {
    capReg.register(makeCapability({ id: "test.forbidden", exposure: "FORBIDDEN", inputSchema: null, outputSchema: null, executionReference: null }))
    try {
      resolveExecutionTarget(capReg, adapterReg, "test.forbidden", gatewayCtx())
      expect.unreachable()
    } catch (err) {
      expect((err as ExecutionError).code).toBe("FORBIDDEN")
    }
  })

  it("INTERNAL_ONLY capability is rejected with NOT_EXECUTABLE_YET", () => {
    capReg.register(makeCapability({ id: "test.internal", exposure: "INTERNAL_ONLY", executionReference: null }))
    try {
      resolveExecutionTarget(capReg, adapterReg, "test.internal", gatewayCtx())
      expect.unreachable()
    } catch (err) {
      expect((err as ExecutionError).code).toBe("NOT_EXECUTABLE_YET")
    }
  })

  it("7. wrong-adapter rejection — no adapter registered at all", () => {
    capReg.register(makeCapability())
    try {
      resolveExecutionTarget(capReg, adapterReg, "test.read", gatewayCtx())
      expect.unreachable()
    } catch (err) {
      expect((err as ExecutionError).code).toBe("ADAPTER_NOT_FOUND")
    }
  })

  it("valid resolution succeeds when everything lines up", () => {
    capReg.register(makeCapability())
    adapterReg.register(fakeAdapter("test.read", 1))
    const result = resolveExecutionTarget(capReg, adapterReg, "test.read", gatewayCtx())
    expect(result.definition.id).toBe("test.read")
    expect(result.adapter.capabilityId).toBe("test.read")
  })

  it("10. identity propagation — rejects when no machine identity is present", () => {
    capReg.register(makeCapability())
    adapterReg.register(fakeAdapter("test.read", 1))
    try {
      resolveExecutionTarget(capReg, adapterReg, "test.read", gatewayCtx({ machine: undefined }))
      expect.unreachable()
    } catch (err) {
      expect((err as ExecutionError).code).toBe("FORBIDDEN")
    }
  })

  it("rejects when the machine identity's connection is not ACTIVE (e.g. SUSPENDED)", () => {
    capReg.register(makeCapability())
    adapterReg.register(fakeAdapter("test.read", 1))
    const ctx = gatewayCtx({
      machine: {
        connectionId: "conn_1",
        credentialId: "cred_1",
        ownerId: "owner_1",
        connectionStatus: "SUSPENDED",
        authenticatedAt: new Date(),
      },
    })
    try {
      resolveExecutionTarget(capReg, adapterReg, "test.read", ctx)
      expect.unreachable()
    } catch (err) {
      expect((err as ExecutionError).code).toBe("FORBIDDEN")
    }
  })
})

describe("assertEnvironmentMatches", () => {
  it("12. environment mismatch is rejected", () => {
    expect(() => assertEnvironmentMatches("development", "production")).toThrow(ExecutionError)
    try {
      assertEnvironmentMatches("development", "production")
    } catch (err) {
      expect((err as ExecutionError).code).toBe("ENVIRONMENT_MISMATCH")
    }
  })

  it("13. environment propagation — matching environments pass", () => {
    expect(() => assertEnvironmentMatches("production", "production")).not.toThrow()
  })
})
