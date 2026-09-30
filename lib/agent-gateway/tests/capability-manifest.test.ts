/**
 * Integration test: the REAL core manifest (manifest.ts) loaded into a
 * fresh registry, exercised through the public registry/index surface —
 * not synthetic test fixtures. Also verifies Phase 2 identity fields line
 * up with what a real AgentMachineIdentity shape provides.
 */
import { describe, expect, it, beforeEach } from "vitest"
import { CapabilityRegistry } from "../capabilities/registry"
import { registerCoreCapabilities, CORE_CAPABILITY_MANIFEST } from "../capabilities/manifest"
import { getCapabilityRegistry, __resetCapabilityRegistryForTests } from "../capabilities/index"
import type { AgentMachineIdentity } from "../shared/types"

describe("registerCoreCapabilities", () => {
  it("loads the entire manifest into a fresh registry without throwing", () => {
    const registry = new CapabilityRegistry()
    expect(() => registerCoreCapabilities(registry)).not.toThrow()
  })

  it("registers every capability declared in CORE_CAPABILITY_MANIFEST exactly once", () => {
    const registry = new CapabilityRegistry()
    registerCoreCapabilities(registry)
    for (const def of CORE_CAPABILITY_MANIFEST) {
      expect(registry.getVersion(def.id, def.version)).not.toBeNull()
    }
  })

  it("represents at least one capability from every Phase 0 risk tier", () => {
    const registry = new CapabilityRegistry()
    registerCoreCapabilities(registry)
    const tiers = new Set(registry.list({ includeDisabled: true, includeForbidden: true }).map((d) => d.operationType))
    expect(tiers.has("READ")).toBe(true)
    expect(tiers.has("LOW_RISK_WRITE")).toBe(true)
    expect(tiers.has("HIGH_RISK_MUTATION")).toBe(true)
    expect(tiers.has("CRITICAL")).toBe(true)
  })

  it("never marks a CRITICAL capability as AGENT_AVAILABLE or PUBLIC_DISCOVERABLE", () => {
    const registry = new CapabilityRegistry()
    registerCoreCapabilities(registry)
    for (const def of registry.list({ includeForbidden: true })) {
      if (def.operationType === "CRITICAL") {
        expect(["FORBIDDEN", "DISABLED"]).toContain(def.exposure)
      }
    }
  })

  it("never gives a HIGH_RISK_MUTATION capability a live executionReference while exposure is not AGENT_AVAILABLE-approved", () => {
    const registry = new CapabilityRegistry()
    registerCoreCapabilities(registry)
    for (const def of registry.list({ includeDisabled: true, includeForbidden: true })) {
      if (def.operationType === "HIGH_RISK_MUTATION" && def.exposure === "INTERNAL_ONLY") {
        expect(def.executionReference).toBeNull()
      }
    }
  })

  it("never gives a FORBIDDEN capability any executionReference", () => {
    const registry = new CapabilityRegistry()
    registerCoreCapabilities(registry)
    for (const def of registry.list({ includeForbidden: true })) {
      if (def.exposure === "FORBIDDEN") {
        expect(def.executionReference).toBeNull()
      }
    }
  })

  it("registering the same manifest twice into two independent registries produces identical, non-interfering results", () => {
    const registryA = new CapabilityRegistry()
    const registryB = new CapabilityRegistry()
    registerCoreCapabilities(registryA)
    registerCoreCapabilities(registryB)
    expect(registryA.list().map((d) => d.id)).toEqual(registryB.list().map((d) => d.id))
  })
})

describe("getCapabilityRegistry singleton", () => {
  beforeEach(() => {
    __resetCapabilityRegistryForTests()
  })

  it("returns the same instance across calls", () => {
    const a = getCapabilityRegistry()
    const b = getCapabilityRegistry()
    expect(a).toBe(b)
  })

  it("comes pre-loaded with the core manifest", () => {
    const registry = getCapabilityRegistry()
    expect(registry.has("products.list")).toBe(true)
    expect(registry.has("products.createDraft")).toBe(true)
  })

  it("resets to a fresh instance after __resetCapabilityRegistryForTests", () => {
    const a = getCapabilityRegistry()
    __resetCapabilityRegistryForTests()
    const b = getCapabilityRegistry()
    expect(a).not.toBe(b)
    // Still functionally equivalent (both loaded from the same manifest).
    expect(b.has("products.list")).toBe(true)
  })
})

describe("Phase 2 identity integration (no business execution occurs)", () => {
  it("a resolved capability's requiredIdentityContext fields are all satisfiable by a real AgentMachineIdentity shape", () => {
    const registry = getCapabilityRegistry()
    const identity: AgentMachineIdentity = {
      connectionId: "conn_123",
      credentialId: "cred_123",
      ownerId: "user_123",
      teamId: null,
      connectionStatus: "ACTIVE",
      authenticatedAt: new Date(),
    }

    const identityFields: Record<string, unknown> = {
      connectionId: identity.connectionId,
      ownerId: identity.ownerId,
      teamId: identity.teamId,
    }

    for (const def of registry.list()) {
      for (const field of def.requiredIdentityContext) {
        expect(Object.prototype.hasOwnProperty.call(identityFields, field)).toBe(true)
      }
    }
  })

  it("capability lookup -> schema validation -> valid registry result, with no business execution", () => {
    const registry = getCapabilityRegistry()
    const validated = registry.validateInput("products.get@v1", { id: "prod_123" })
    expect(validated).toEqual({ id: "prod_123" })
    // No adapter was called, no database was touched — this test only
    // exercises the registry's own validateInput() path.
  })
})
