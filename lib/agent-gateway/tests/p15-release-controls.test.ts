/**
 * Phase 15 A–F — runtime release controls (kill switches, rollout stages)
 * enforced at the gate, the resolver and the MCP tool surface, on the REAL
 * chain of the governance test kit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"
import { canaryBucket, evaluateRuntimeControls, killSwitchMatches, rolloutAdmits } from "../rollout/controls"
import type { KillSwitchRow, RolloutRow } from "../rollout/types"
import { IDEMPOTENCY_META_KEY } from "../mcp/request-meta"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const subject = (over: Partial<{ capabilityId: string; riskTier: string; connectionId: string; environment: string }> = {}) => ({
  capabilityId: "tickets.create",
  riskTier: "LOW_RISK_WRITE",
  connectionId: "conn_1",
  environment: "development",
  ...over,
})
const sw = (scope: KillSwitchRow["scope"], target: string | null, over: Partial<KillSwitchRow> = {}): KillSwitchRow => ({
  id: "k",
  publicRef: `ksw_${"a".repeat(32)}`,
  scope,
  target,
  environment: "development",
  active: true,
  reason: "r",
  activatedById: SUPER,
  activatedAt: new Date(),
  deactivatedById: null,
  deactivatedAt: null,
  deactivationReason: null,
  version: 1,
  ...over,
})
const rollout = (stage: RolloutRow["stage"], over: Partial<RolloutRow> = {}): RolloutRow => ({
  id: "r",
  capabilityId: "tickets.create",
  environment: "development",
  stage,
  canaryPercent: 0,
  allowedConnectionIds: [],
  pausedFromStage: null,
  pausedReason: null,
  version: 1,
  updatedById: SUPER,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
})

describe("Phase 15 A — pure evaluation", () => {
  it("kill switch scopes match exactly what they name; inactive or other-environment switches never match", () => {
    expect(killSwitchMatches(sw("GLOBAL", null), subject())).toBe(true)
    expect(killSwitchMatches(sw("CAPABILITY", "tickets.create"), subject())).toBe(true)
    expect(killSwitchMatches(sw("CAPABILITY", "tickets.close"), subject())).toBe(false)
    expect(killSwitchMatches(sw("CONNECTION", "conn_1"), subject())).toBe(true)
    expect(killSwitchMatches(sw("CONNECTION", "conn_2"), subject())).toBe(false)
    expect(killSwitchMatches(sw("RISK_TIER", "LOW_RISK_WRITE"), subject())).toBe(true)
    expect(killSwitchMatches(sw("RISK_TIER", "READ"), subject())).toBe(false)
    expect(killSwitchMatches(sw("GLOBAL", null, { active: false }), subject())).toBe(false)
    expect(killSwitchMatches({ scope: "UNKNOWN" as never, target: null, active: true }, subject())).toBe(true) // fail closed
    expect(evaluateRuntimeControls(subject(), [sw("GLOBAL", null, { environment: "production" })], null, false)).toEqual({ allowed: true, stage: "LEGACY" })
  })

  it("rollout stages admit exactly their audience", () => {
    expect(rolloutAdmits(rollout("DISABLED"), subject())).toBe(false)
    expect(rolloutAdmits(rollout("PAUSED", { allowedConnectionIds: ["conn_1"] }), subject())).toBe(false)
    expect(rolloutAdmits(rollout("INTERNAL", { allowedConnectionIds: ["conn_1"] }), subject())).toBe(true)
    expect(rolloutAdmits(rollout("INTERNAL", { allowedConnectionIds: ["conn_2"] }), subject())).toBe(false)
    expect(rolloutAdmits(rollout("CANARY", { allowedConnectionIds: ["conn_1"], canaryPercent: 0 }), subject())).toBe(true)
    expect(rolloutAdmits(rollout("CANARY", { canaryPercent: 100 }), subject())).toBe(true)
    expect(rolloutAdmits(rollout("CANARY", { canaryPercent: 0 }), subject())).toBe(false)
    expect(rolloutAdmits(rollout("GENERAL"), subject())).toBe(true)
    expect(rolloutAdmits(rollout("SOMETHING" as never), subject())).toBe(false)
  })

  it("canary buckets are stable per connection and capability, and spread evenly", () => {
    expect(canaryBucket("conn_1", "tickets.create")).toBe(canaryBucket("conn_1", "tickets.create"))
    const buckets = Array.from({ length: 2000 }, (_, i) => canaryBucket(`conn_${i}`, "tickets.create"))
    const under25 = buckets.filter((b) => b < 25).length / buckets.length
    expect(under25).toBeGreaterThan(0.2)
    expect(under25).toBeLessThan(0.3)
    expect(buckets.every((b) => b >= 0 && b < 100)).toBe(true)
  })

  it("a kill switch wins over any rollout; a missing rollout is legacy unless enforcement is on", () => {
    expect(evaluateRuntimeControls(subject(), [sw("CAPABILITY", "tickets.create")], rollout("GENERAL"), false)).toMatchObject({ allowed: false, code: "KILL_SWITCH_ACTIVE" })
    expect(evaluateRuntimeControls(subject(), [], null, false)).toEqual({ allowed: true, stage: "LEGACY" })
    expect(evaluateRuntimeControls(subject(), [], null, true)).toMatchObject({ allowed: false, code: "ROLLOUT_BLOCKED", stage: "DISABLED" })
    expect(evaluateRuntimeControls(subject(), [], rollout("GENERAL"), true)).toEqual({ allowed: true, stage: "GENERAL" })
  })
})

let k: GovernanceKit
let ledger: typeof import("../audit-ledger")

async function allowAll(connectionId = "conn_1") {
  for (const def of k.registry.list()) {
    if (def.exposure !== "AGENT_AVAILABLE" || !k.adapters.has(def.id, def.version)) continue
    await k.policyStore.createPolicyVersion({ name: `allow ${def.id}`, effect: "ALLOW", scope: "CAPABILITY", capabilityId: def.id, riskConstraint: def.operationType as "READ", actorId: SUPER })
  }
  await k.autonomyStore.setAutonomyPolicy({ connectionId, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE", actorId: SUPER })
}

async function service() {
  const { ReleaseService } = await import("../rollout/release-service")
  return new ReleaseService({ registry: k.registry, environment: "development" })
}

const toolNames = async (ctx = k.agentCtx()) => (((await k.mcp("tools/list", {}, ctx)).result?.tools ?? []).map((t: { name: string }) => t.name) as string[]).sort()
/** A refusal by the release controls: hidden tools are CAPABILITY_NOT_FOUND; the gate's own code is visible on task submission. */
const submitText = async (capabilityId: string, input: Record<string, unknown>, ctx = k.agentCtx(), idempotencyKey?: string) =>
  (await k.tool("agent_task_submit", { capabilityId, input, ...(idempotencyKey ? { idempotencyKey } : {}) }, ctx)).text
const events = async () => {
  await ledger.flushAuditLedger()
  return Array.from(k.approval._auditEvents.values()) as Array<Record<string, any>>
}

beforeEach(async () => {
  k = await buildGovernanceKit()
  ledger = await import("../audit-ledger")
  await allowAll()
}, 60_000)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("Phase 15 B — kill switches at the gate and the tool surface", () => {
  it("GLOBAL: every call is refused before any approval, task or adapter; every capability tool disappears", async () => {
    const svc = await service()
    await svc.activateKillSwitch({ scope: "GLOBAL", reason: "incident 42" }, SUPER)
    const reads = vi.spyOn(k.exec.client.product, "findUnique")
    // Not listed, so not callable as a tool (stable, non-reflecting refusal)...
    const out = await k.tool("products.get", { id: "prod_1" })
    expect(out.isError).toBe(true)
    expect(out.text).toBe("CAPABILITY_NOT_FOUND: The requested tool is not available.")
    expect(await toolNames()).toEqual(["agent_task_cancel", "agent_task_status", "agent_task_submit"])
    // ...and every path that still names the capability is refused by the gate itself.
    const submit = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    expect(submit.isError).toBe(true)
    expect(submit.text).toMatch(/^KILL_SWITCH_ACTIVE: /)
    const { buildExecutionContext } = await import("../execution/resolver/build-execution-context")
    const cap = k.registry.get("products.get")!
    await expect(k.gate.grant(buildExecutionContext(k.agentCtx(), cap.id, cap.version, "development"), cap, { id: "prod_1" })).rejects.toMatchObject({ code: "KILL_SWITCH_ACTIVE" })
    expect(reads).not.toHaveBeenCalled()
    expect(k.approval._tasks.size).toBe(0)
    expect(k.approval._requests.size).toBe(0)
    const blocked = (await events()).filter((e) => e.action === "security.kill_switch_blocked")
    expect(blocked.length).toBeGreaterThanOrEqual(1)
    expect(blocked[0]).toMatchObject({ outcome: "DENIED", connectionId: "conn_1", capabilityId: "products.get" })
  })

  it("CAPABILITY / CONNECTION / RISK_TIER switches stop only what they name", async () => {
    const svc = await service()
    await allowAll("conn_2")
    k.exec.seedTicket({ id: "tk_1", clientId: "owner_1", title: "t", status: "OPEN", assignedTo: null })
    await svc.activateKillSwitch({ scope: "CAPABILITY", target: "tickets.close", reason: "bad deploy" }, SUPER)
    expect((await k.tool("tickets.close", { ticketId: "tk_1" })).isError).toBe(true)
    expect(await submitText("tickets.close", { ticketId: "tk_1" })).toMatch(/^KILL_SWITCH_ACTIVE/)
    expect((await k.tool("products.get", { id: "prod_1" })).isError).toBe(false)
    expect(await toolNames()).not.toContain("tickets.close")
    expect(await toolNames()).toContain("tickets.create")

    await svc.activateKillSwitch({ scope: "CONNECTION", target: "conn_2", reason: "compromised agent" }, SUPER)
    const bravo = k.agentCtx("conn_2", "owner_2")
    expect((await k.tool("products.get", { id: "prod_1" }, bravo)).isError).toBe(true)
    expect(await submitText("products.get", { id: "prod_1" }, bravo)).toMatch(/^KILL_SWITCH_ACTIVE/)
    expect(await toolNames(bravo)).toEqual(["agent_task_cancel", "agent_task_status", "agent_task_submit"])
    expect((await k.tool("products.get", { id: "prod_1" })).isError).toBe(false)

    await svc.activateKillSwitch({ scope: "RISK_TIER", target: "LOW_RISK_WRITE", reason: "freeze writes" }, SUPER)
    const write = await k.mcp("tools/call", { name: "tickets.create", arguments: { subject: "Frozen", description: "Writes are frozen now." }, _meta: { [IDEMPOTENCY_META_KEY]: "freeze-0001" } })
    expect(write.result.isError).toBe(true)
    expect(await submitText("tickets.create", { subject: "Frozen", description: "Writes are frozen now." }, k.agentCtx(), "freeze-0002")).toMatch(/^KILL_SWITCH_ACTIVE/)
    expect(await toolNames()).not.toContain("tickets.create")
    expect((await k.tool("tickets.list", {})).isError).toBe(false)
    expect(k.exec._tickets.get("tk_1")!.status).toBe("OPEN")
    expect(k.exec._tickets.size).toBe(1)
  })

  it("deactivation restores service immediately (no cache)", async () => {
    const svc = await service()
    const { killSwitch } = await svc.activateKillSwitch({ scope: "GLOBAL", reason: "drill" }, SUPER)
    expect((await k.tool("products.get", { id: "prod_1" })).isError).toBe(true)
    await svc.deactivateKillSwitch(killSwitch.publicRef, killSwitch.version, "drill over", SUPER)
    expect((await k.tool("products.get", { id: "prod_1" })).isError).toBe(false)
    expect(await toolNames()).toContain("products.get")
  })
})

describe("Phase 15 C — queued work and the resolver", () => {
  it("a task queued before the switch fails terminally in the worker and never dispatches; it does not resume after deactivation", async () => {
    const queued = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    expect(queued.isError).toBe(false)
    const svc = await service()
    const { killSwitch } = await svc.activateKillSwitch({ scope: "CAPABILITY", target: "products.get", reason: "stop" }, SUPER)
    const reads = vi.spyOn(k.exec.client.product, "findUnique")
    await k.drain()
    expect(reads).not.toHaveBeenCalled()
    const task = k.taskRow(queued.json.taskRef)!
    expect(task.status).toBe("EXPIRED")
    await svc.deactivateKillSwitch(killSwitch.publicRef, killSwitch.version, "resume", SUPER)
    await k.drain()
    expect(k.taskRow(queued.json.taskRef)!.status).toBe("EXPIRED")
    expect(reads).not.toHaveBeenCalled()
  })

  it("the resolver re-checks immediately before dispatch (a switch flipped after the gate decision still stops it)", async () => {
    const { AdapterResolver } = await import("../execution/resolver/adapter-resolver")
    const svc = await service()
    await svc.activateKillSwitch({ scope: "CAPABILITY", target: "products.get", reason: "late flip" }, SUPER)
    const resolver = new AdapterResolver(k.registry, k.adapters)
    const reads = vi.spyOn(k.exec.client.product, "findUnique")
    await expect(resolver.execute("products.get@v1", { id: "prod_1" }, k.agentCtx())).rejects.toMatchObject({ code: "KILL_SWITCH_ACTIVE" })
    expect(reads).not.toHaveBeenCalled()
    expect((await events()).some((e) => e.action === "security.kill_switch_blocked")).toBe(true)
  })

  it("release controls that cannot be read fail closed (never allowed)", async () => {
    vi.spyOn(k.approval.client.agentKillSwitch, "findMany").mockRejectedValue(new Error("db down"))
    expect(await toolNames()).toEqual(["agent_task_cancel", "agent_task_status", "agent_task_submit"])
    expect((await k.tool("products.get", { id: "prod_1" })).isError).toBe(true)
    expect(await submitText("products.get", { id: "prod_1" })).toMatch(/^POLICY_UNAVAILABLE/)
    const { AdapterResolver } = await import("../execution/resolver/adapter-resolver")
    await expect(new AdapterResolver(k.registry, k.adapters).execute("products.get@v1", { id: "prod_1" }, k.agentCtx())).rejects.toMatchObject({ code: "EXECUTION_UNAVAILABLE" })
    expect(k.approval._tasks.size).toBe(0)
  })
})

describe("Phase 15 D — rollout stages", () => {
  async function enforce() {
    vi.stubEnv("AGENT_GATEWAY_ROLLOUT_ENFORCED", "1")
    const { __resetGatewayConfigForTests } = await import("../config")
    __resetGatewayConfigForTests()
  }

  it("with enforcement on, an unreleased capability is hidden and refused", async () => {
    await enforce()
    expect(await toolNames()).toEqual(["agent_task_cancel", "agent_task_status", "agent_task_submit"])
    expect((await k.tool("products.get", { id: "prod_1" })).isError).toBe(true)
    expect(await submitText("products.get", { id: "prod_1" })).toMatch(/^ROLLOUT_BLOCKED/)
    expect((await events()).some((e) => e.action === "security.rollout_blocked")).toBe(true)
  })

  it("DISABLED -> INTERNAL -> CANARY -> GENERAL widens the audience one step at a time", async () => {
    await enforce()
    await allowAll("conn_2")
    const svc = await service()
    let r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 0, allowedConnectionIds: ["conn_1"], reason: "start" }, SUPER)
    const alpha = k.agentCtx()
    const bravo = k.agentCtx("conn_2", "owner_2")
    expect(await submitText("products.get", { id: "prod_1" }, alpha)).toMatch(/^ROLLOUT_BLOCKED/) // DISABLED
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "internal" }, SUPER)).rollout
    expect(r.stage).toBe("INTERNAL")
    expect((await k.tool("products.get", { id: "prod_1" }, alpha)).isError).toBe(false)
    expect(await submitText("products.get", { id: "prod_1" }, bravo)).toMatch(/^ROLLOUT_BLOCKED/)
    expect(await toolNames(bravo)).not.toContain("products.get")
    expect(await toolNames(alpha)).toContain("products.get")

    r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 50, allowedConnectionIds: ["conn_1"], expectedVersion: r.version, reason: "canary size" }, SUPER)
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "canary" }, SUPER)).rollout
    expect(r.stage).toBe("CANARY")
    const bravoInCanary = canaryBucket("conn_2", "products.get") < 50
    expect((await k.tool("products.get", { id: "prod_1" }, bravo)).isError).toBe(!bravoInCanary)

    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "general" }, SUPER)).rollout
    expect(r.stage).toBe("GENERAL")
    expect((await k.tool("products.get", { id: "prod_1" }, bravo)).isError).toBe(false)
  })

  it("pause takes the capability away at once; resume restores the paused-from stage", async () => {
    await enforce()
    const svc = await service()
    let r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 0, allowedConnectionIds: ["conn_1"], reason: "start" }, SUPER)
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "internal" }, SUPER)).rollout
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "pause", expectedVersion: r.version, reason: "investigating" }, SUPER)).rollout
    expect(r).toMatchObject({ stage: "PAUSED", pausedFromStage: "INTERNAL" })
    expect(await submitText("products.get", { id: "prod_1" })).toMatch(/^ROLLOUT_BLOCKED/)
    expect(await toolNames()).not.toContain("products.get")
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "resume", expectedVersion: r.version, reason: "fixed" }, SUPER)).rollout
    expect(r).toMatchObject({ stage: "INTERNAL", pausedFromStage: null })
    expect((await k.tool("products.get", { id: "prod_1" })).isError).toBe(false)
  })

  it("with enforcement off (the default) Phase 15 changes nothing until a rollout is configured", async () => {
    expect(await toolNames()).toContain("products.get")
    expect((await k.tool("products.get", { id: "prod_1" })).isError).toBe(false)
  })
})
