/**
 * Phase 13 A — the domain capability map agrees with the live registries,
 * and every new capability is declared to the Phase 3-12 standard.
 */
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { CapabilityRegistry } from "../capabilities/registry"
import { CORE_CAPABILITY_MANIFEST, registerCoreCapabilities } from "../capabilities/manifest"
import { DOMAIN_CAPABILITY_MAP } from "../capabilities/domain-readiness"
import { AdapterRegistry } from "../execution/resolver/adapter-registry"
import { registerCoreAdapters } from "../execution/adapters/index"
import { projectTools } from "../mcp/tool-projection"
import { resolveRecoverySpec } from "../recovery/spec"
import { mandatoryApprovalReason } from "../autonomy/approval-requirements"
import { detectInText } from "../security/injection-detector"

const PHASE_13 = ["products.listMine", "campaigns.getActive", "subscriptions.list", "tickets.get", "analytics.summary", "analytics.productPerformance", "tickets.create", "tickets.close"]

function load() {
  const registry = new CapabilityRegistry()
  registerCoreCapabilities(registry)
  const adapters = new AdapterRegistry()
  registerCoreAdapters(adapters)
  return { registry, adapters, tools: projectTools(registry, adapters).map((t) => t.name) }
}

describe("Phase 13 A — the capability map is true in both directions", () => {
  it("every READY operation is an executable agent tool", () => {
    const { tools } = load()
    for (const op of DOMAIN_CAPABILITY_MAP.filter((o) => o.readiness === "READY")) expect(tools, op.operation).toContain(op.capabilityId)
  })

  it("no NOT_READY operation can execute or be listed", () => {
    const { registry, adapters, tools } = load()
    for (const op of DOMAIN_CAPABILITY_MAP.filter((o) => o.readiness === "NOT_READY")) {
      expect(op.readiness === "NOT_READY" && op.blocker.length > 20, op.operation).toBe(true)
      if (!op.capabilityId) continue
      const def = registry.get(op.capabilityId)
      expect(def, op.capabilityId).toBeTruthy()
      expect(adapters.has(def!.id, def!.version), op.capabilityId).toBe(false)
      expect(tools).not.toContain(op.capabilityId)
    }
  })

  it("every executable capability appears in the map exactly once as READY", () => {
    const { tools } = load()
    const ready = DOMAIN_CAPABILITY_MAP.filter((o) => o.readiness === "READY").map((o) => o.capabilityId!)
    expect(new Set(ready).size).toBe(ready.length)
    expect(tools.filter((t) => !t.startsWith("agent_task_")).sort()).toEqual([...ready].sort())
  })

  it("covers the five Phase 13 domains, each with a READY and a NOT_READY entry", () => {
    for (const domain of ["PRODUCTS", "MARKETING", "SUBSCRIPTIONS", "SUPPORT", "ANALYTICS"] as const) {
      const ops = DOMAIN_CAPABILITY_MAP.filter((o) => o.domain === domain)
      expect(ops.some((o) => o.readiness === "READY"), domain).toBe(true)
      expect(ops.some((o) => o.readiness === "NOT_READY"), domain).toBe(true)
    }
  })
})

describe("Phase 13 A — every new capability meets the platform standard", () => {
  const defs = CORE_CAPABILITY_MANIFEST.filter((d) => PHASE_13.includes(d.id))

  it("all eight are registered, agent-available, adapter-bound and async-capable", () => {
    const { registry, adapters } = load()
    expect(defs.map((d) => d.id).sort()).toEqual([...PHASE_13].sort())
    for (const d of defs) {
      expect(registry.get(d.id)?.version, d.id).toBe(1)
      expect(d.exposure, d.id).toBe("AGENT_AVAILABLE")
      expect(adapters.has(d.id, 1), d.id).toBe(true)
      expect(d.executionReference?.adapterKey, d.id).toBe(`${d.id}Adapter`)
      expect(d.async.asyncSupported, d.id).toBe(true)
    }
  })

  it("closed input and output schemas with bounded lists", () => {
    for (const d of defs) {
      expect(d.inputSchema instanceof z.ZodObject && d.inputSchema._def.unknownKeys === "strict", d.id).toBe(true)
      expect(d.outputSchema instanceof z.ZodObject && d.outputSchema._def.unknownKeys === "strict", d.id).toBe(true)
      expect(d.inputSchema!.safeParse({ ownerId: "owner_2" }).success, `${d.id} refuses identity fields`).toBe(false)
    }
  })

  it("only public storefront data is not owner-scoped", () => {
    for (const d of defs) {
      const ownerScoped = d.requiredIdentityContext.includes("ownerId")
      expect(ownerScoped, d.id).toBe(d.id !== "campaigns.getActive")
    }
  })

  it("content trust is declared explicitly; third-party text is never labelled system-generated", () => {
    const expected: Record<string, string> = {
      "products.listMine": "THIRD_PARTY_CONTENT",
      "campaigns.getActive": "THIRD_PARTY_CONTENT",
      "subscriptions.list": "SYSTEM_GENERATED",
      "tickets.get": "THIRD_PARTY_CONTENT",
      "analytics.summary": "SYSTEM_GENERATED",
      "analytics.productPerformance": "SYSTEM_GENERATED",
      "tickets.create": "THIRD_PARTY_CONTENT",
      "tickets.close": "SYSTEM_GENERATED",
    }
    for (const d of defs) expect(d.contentTrust, d.id).toBe(expected[d.id])
  })

  it("names and descriptions are clean (no tool poisoning)", () => {
    for (const d of defs) {
      expect(detectInText(`${d.name} ${d.description}`), d.id).toEqual([])
      expect(d.description.length, d.id).toBeLessThan(200)
    }
  })

  it("the two writes: risk tier, permissions, idempotency and recovery", () => {
    const { registry, adapters } = load()
    const create = registry.get("tickets.create")!
    const close = registry.get("tickets.close")!
    for (const w of [create, close]) {
      expect(w.operationType).toBe("LOW_RISK_WRITE")
      expect(w.permission.permission).toBe("write:tickets")
      expect(mandatoryApprovalReason(w, "production"), w.id).toBeNull() // not financial, not irreversible
    }
    expect(create.idempotency).toMatchObject({ requiresIdempotencyKey: true, retrySafe: false })
    expect(close.idempotency).toMatchObject({ requiresIdempotencyKey: false, retrySafe: true, class: "IDEMPOTENT" })

    const spec = resolveRecoverySpec(create)!
    expect(spec).toMatchObject({ class: "COMPENSATABLE", capabilityId: "tickets.close", capabilityVersion: 1, inputMapping: { ticketId: "output.id" }, manualRecoveryRequired: false })
    // The compensation target is itself an executable, agent-available capability.
    expect(adapters.has("tickets.close", 1)).toBe(true)
    expect(resolveRecoverySpec(close)).toMatchObject({ class: "IRREVERSIBLE", manualRecoveryRequired: true })
  })

  it("every read is a READ with no side effects", () => {
    for (const d of defs.filter((x) => !x.id.startsWith("tickets.c"))) {
      expect(d.operationType, d.id).toBe("READ")
      expect(d.sideEffects.effects, d.id).toEqual([])
      expect(d.idempotency.class, d.id).toBe("IDEMPOTENT")
    }
  })
})
