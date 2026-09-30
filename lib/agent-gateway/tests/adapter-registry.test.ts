import { describe, expect, it, beforeEach } from "vitest"
import { AdapterRegistry } from "../execution/resolver/adapter-registry"
import { ExecutionError } from "../execution/contracts/execution-error"
import type { AgentCapabilityAdapter } from "../execution/contracts/adapter"

function fakeAdapter(capabilityId: string, capabilityVersion: number): AgentCapabilityAdapter {
  return {
    capabilityId,
    capabilityVersion,
    async execute() {
      return { output: {}, executionMode: "SYNC" as const, durationMs: 0 }
    },
  }
}

describe("AdapterRegistry", () => {
  let registry: AdapterRegistry
  beforeEach(() => {
    registry = new AdapterRegistry()
  })

  it("registers and resolves an adapter by (capabilityId, version)", () => {
    const adapter = fakeAdapter("products.list", 1)
    registry.register(adapter)
    expect(registry.get("products.list", 1)).toBe(adapter)
    expect(registry.has("products.list", 1)).toBe(true)
  })

  it("5. wrong-adapter/duplicate rejection — a second registration for the same (id, version) throws CONFLICT", () => {
    registry.register(fakeAdapter("products.list", 1))
    expect(() => registry.register(fakeAdapter("products.list", 1))).toThrow(ExecutionError)
    try {
      registry.register(fakeAdapter("products.list", 1))
    } catch (err) {
      expect((err as ExecutionError).code).toBe("CONFLICT")
    }
  })

  it("8. unknown capability -> null, not an exception", () => {
    expect(registry.get("nonexistent.capability", 1)).toBeNull()
    expect(registry.has("nonexistent.capability", 1)).toBe(false)
  })

  it("a different version of the same capability id is a distinct registration", () => {
    registry.register(fakeAdapter("products.list", 1))
    registry.register(fakeAdapter("products.list", 2))
    expect(registry.get("products.list", 1)).not.toBe(registry.get("products.list", 2))
  })
})
