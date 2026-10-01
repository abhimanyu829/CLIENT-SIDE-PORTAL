/**
 * Phase 15 G–M — the release services and their governance surface:
 * kill-switch and rollout lifecycles (validation, optimistic concurrency,
 * evidence), health gates over the ledger, auto-pause in the maintenance
 * pass, release attestations, guarded autonomy promotion, and the
 * SUPER_ADMIN routes and page.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"
import { HEALTH_MIN_SAMPLES, judgeHealth } from "../rollout/health-gates"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const API = "@/app/api/admin/agent-governance"
const PAGE = "@/app/(admin)/admin/agent-governance"

let k: GovernanceKit
let ledger: typeof import("../audit-ledger")

beforeEach(async () => {
  k = await buildGovernanceKit()
  ledger = await import("../audit-ledger")
}, 60_000)

async function service(environment = "development") {
  const { ReleaseService } = await import("../rollout/release-service")
  return new ReleaseService({ registry: k.registry, environment })
}
const code = async (p: Promise<unknown>) => {
  try {
    await p
    return "OK"
  } catch (err) {
    return (err as { code?: string }).code ?? "THREW"
  }
}
const rows = async () => {
  await ledger.flushAuditLedger()
  return (Array.from(k.approval._auditEvents.values()) as Array<Record<string, any>>).sort((a, b) => a.sequence - b.sequence)
}
/** Seeds execution evidence for one capability (as the resolver would record it). */
async function seedExecutions(capabilityId: string, ok: number, failed: number, failCode = "INTERNAL_ERROR", connectionId = "conn_1", environment = "development") {
  for (let i = 0; i < ok; i += 1) await ledger.appendAuditEvent({ action: "execution.succeeded", outcome: "SUCCESS", actor: { type: "AGENT", id: connectionId }, connectionId, capabilityId, environment, riskTier: "READ" })
  for (let i = 0; i < failed; i += 1) await ledger.appendAuditEvent({ action: "execution.failed", outcome: "FAILED", actor: { type: "AGENT", id: connectionId }, connectionId, capabilityId, environment, riskTier: "READ", errorCode: failCode })
}

describe("Phase 15 G — kill-switch lifecycle", () => {
  it("validates scope and target, is idempotent per scope + target, and is evidenced with the human actor and reason", async () => {
    const svc = await service()
    expect(await code(svc.activateKillSwitch({ scope: "GLOBAL", target: "x", reason: "r" }, SUPER))).toBe("VALIDATION_FAILED")
    expect(await code(svc.activateKillSwitch({ scope: "CAPABILITY", target: "nope.nothing", reason: "r" }, SUPER))).toBe("VALIDATION_FAILED")
    expect(await code(svc.activateKillSwitch({ scope: "CAPABILITY", target: "../etc", reason: "r" }, SUPER))).toBe("VALIDATION_FAILED")
    expect(await code(svc.activateKillSwitch({ scope: "CONNECTION", target: "conn_missing", reason: "r" }, SUPER))).toBe("VALIDATION_FAILED")
    expect(await code(svc.activateKillSwitch({ scope: "RISK_TIER", target: "HUGE", reason: "r" }, SUPER))).toBe("VALIDATION_FAILED")
    const a = await svc.activateKillSwitch({ scope: "CONNECTION", target: "conn_2", reason: "compromised" }, SUPER)
    const b = await svc.activateKillSwitch({ scope: "CONNECTION", target: "conn_2", reason: "again" }, SUPER)
    expect(a.created).toBe(true)
    expect(b).toMatchObject({ created: false, killSwitch: { publicRef: a.killSwitch.publicRef } })
    expect(a.killSwitch.publicRef).toMatch(/^ksw_[0-9a-f]{32}$/)
    expect(k.approval._killSwitches.size).toBe(1)
    const ev = (await rows()).filter((r) => r.action === "kill_switch.activated")
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ actorType: "HUMAN", actorId: SUPER, connectionId: "conn_2", resourceRef: a.killSwitch.publicRef, category: "CONFIGURATION" })
    expect(ev[0].metadata).toMatchObject({ scope: "CONNECTION", target: "conn_2", reason: "compromised" })
  })

  it("deactivation is version-checked, single, and recorded; nothing is ever deleted", async () => {
    const svc = await service()
    const { killSwitch } = await svc.activateKillSwitch({ scope: "GLOBAL", reason: "drill" }, SUPER)
    expect(await code(svc.deactivateKillSwitch(killSwitch.publicRef, killSwitch.version + 1, "stale", SUPER))).toBe("CONFLICT")
    const off = await svc.deactivateKillSwitch(killSwitch.publicRef, killSwitch.version, "drill over", SUPER)
    expect(off).toMatchObject({ active: false, deactivatedById: SUPER, deactivationReason: "drill over", version: 2 })
    expect(await code(svc.deactivateKillSwitch(killSwitch.publicRef, 2, "again", SUPER))).toBe("INVALID_STATE")
    expect(await code(svc.deactivateKillSwitch(`ksw_${"0".repeat(32)}`, 1, "missing", SUPER))).toBe("NOT_FOUND")
    expect(await code(svc.deactivateKillSwitch("../../x", 1, "bad", SUPER))).toBe("NOT_FOUND")
    expect(k.approval._killSwitches.size).toBe(1)
    expect((await rows()).filter((r) => r.action === "kill_switch.deactivated")).toHaveLength(1)
  })

  it("concurrent deactivations: exactly one wins", async () => {
    const svc = await service()
    const { killSwitch } = await svc.activateKillSwitch({ scope: "GLOBAL", reason: "drill" }, SUPER)
    const results = await Promise.all(Array.from({ length: 6 }, () => code(svc.deactivateKillSwitch(killSwitch.publicRef, 1, "race", SUPER))))
    expect(results.filter((r) => r === "OK")).toHaveLength(1)
    expect((await rows()).filter((r) => r.action === "kill_switch.deactivated")).toHaveLength(1)
  })
})

describe("Phase 15 H — rollout lifecycle guards", () => {
  it("configure creates DISABLED; cohort and percentage are validated; versions are enforced", async () => {
    const svc = await service()
    expect(await code(svc.configureRollout({ capabilityId: "refunds.process", canaryPercent: 0, allowedConnectionIds: [], reason: "r" }, SUPER))).toBe("VALIDATION_FAILED")
    expect(await code(svc.configureRollout({ capabilityId: "products.get", canaryPercent: 101, allowedConnectionIds: [], reason: "r" }, SUPER))).toBe("VALIDATION_FAILED")
    expect(await code(svc.configureRollout({ capabilityId: "products.get", canaryPercent: 0, allowedConnectionIds: ["conn_ghost"], reason: "r" }, SUPER))).toBe("VALIDATION_FAILED")
    const r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 10, allowedConnectionIds: ["conn_1", "conn_1"], reason: "start" }, SUPER)
    expect(r).toMatchObject({ stage: "DISABLED", canaryPercent: 10, allowedConnectionIds: ["conn_1"], version: 1 })
    expect(await code(svc.configureRollout({ capabilityId: "products.get", canaryPercent: 10, allowedConnectionIds: [], reason: "no version" }, SUPER))).toBe("CONFLICT")
    expect(await code(svc.configureRollout({ capabilityId: "products.get", canaryPercent: 10, allowedConnectionIds: [], expectedVersion: 9, reason: "stale" }, SUPER))).toBe("CONFLICT")
  })

  it("advances exactly one stage at a time, with the stage prerequisites", async () => {
    const svc = await service()
    let r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 0, allowedConnectionIds: [], reason: "start" }, SUPER)
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "no cohort" }, SUPER))).toBe("INVALID_STATE")
    r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 0, allowedConnectionIds: ["conn_1"], expectedVersion: r.version, reason: "cohort" }, SUPER)
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "internal" }, SUPER)).rollout
    expect(r.stage).toBe("INTERNAL")
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "0%" }, SUPER))).toBe("INVALID_STATE")
    expect(await code(svc.configureRollout({ capabilityId: "products.get", canaryPercent: 10, allowedConnectionIds: [], expectedVersion: r.version, reason: "empty internal" }, SUPER))).toBe("VALIDATION_FAILED")
    r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 10, allowedConnectionIds: ["conn_1"], expectedVersion: r.version, reason: "10%" }, SUPER)
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "canary" }, SUPER)).rollout
    expect(r.stage).toBe("CANARY")
    expect(await code(svc.configureRollout({ capabilityId: "products.get", canaryPercent: 80, allowedConnectionIds: ["conn_1"], expectedVersion: r.version, reason: "too wide" }, SUPER))).toBe("VALIDATION_FAILED")
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version - 1, reason: "stale" }, SUPER))).toBe("CONFLICT")
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "general" }, SUPER)).rollout
    expect(r.stage).toBe("GENERAL")
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "beyond" }, SUPER))).toBe("INVALID_STATE")
    const actions = (await rows()).filter((e) => e.action.startsWith("rollout.")).map((e) => `${e.action}:${e.metadata.stage}`)
    expect(actions).toEqual(["rollout.configured:DISABLED", "rollout.configured:DISABLED", "rollout.advanced:INTERNAL", "rollout.configured:INTERNAL", "rollout.advanced:CANARY", "rollout.advanced:GENERAL"])
  })

  it("GENERAL is refused while the health gate is UNHEALTHY; rollback goes only downwards", async () => {
    const svc = await service()
    let r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 20, allowedConnectionIds: ["conn_1"], reason: "start" }, SUPER)
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "i" }, SUPER)).rollout
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "c" }, SUPER)).rollout
    await seedExecutions("products.get", 10, 15)
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "g" }, SUPER))).toBe("INVALID_STATE")
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "rollback", targetStage: "CANARY", expectedVersion: r.version, reason: "same" }, SUPER))).toBe("VALIDATION_FAILED")
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "rollback", targetStage: "INTERNAL", expectedVersion: r.version, reason: "shrink" }, SUPER)).rollout
    expect(r.stage).toBe("INTERNAL")
  })

  it("production GENERAL needs a passed attestation from the last 7 days", async () => {
    k.approval.seedConnection({ id: "conn_prod", name: "Prod agent", ownerId: "owner_1", environment: "production" })
    const svc = await service("production")
    let r = await svc.configureRollout({ capabilityId: "products.get", canaryPercent: 20, allowedConnectionIds: ["conn_prod"], reason: "start" }, SUPER)
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "i" }, SUPER)).rollout
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "c" }, SUPER)).rollout
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "no attestation" }, SUPER))).toBe("INVALID_STATE")
    const { recordReleaseAttestation } = await import("../rollout/attestations")
    const failedAttestation = await recordReleaseAttestation({ capabilityId: "products.get", environment: "production", confirmed: ["TESTS_PASSED"], reason: "partial", actorId: SUPER }, new Date())
    expect(failedAttestation.view).toMatchObject({ passed: false })
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "failed attestation" }, SUPER))).toBe("INVALID_STATE")
    await recordReleaseAttestation({ capabilityId: "products.get", environment: "production", confirmed: ["TESTS_PASSED", "SECURITY_REVIEWED", "ROLLBACK_PLAN_READY", "MONITORING_READY", "ON_CALL_ASSIGNED"], reason: "full", actorId: SUPER }, new Date())
    r = (await svc.transitionRollout({ capabilityId: "products.get", action: "advance", expectedVersion: r.version, reason: "general" }, SUPER)).rollout
    expect(r.stage).toBe("GENERAL")
  })
})

describe("Phase 15 I — health gates", () => {
  it("judges by service failures, circuit openings and evidence volume", () => {
    expect(judgeHealth({ successes: 5, serviceFailures: 0, circuitOpenings: 0, securityEvents: 0 }, 1).verdict).toBe("INSUFFICIENT_DATA")
    expect(judgeHealth({ successes: HEALTH_MIN_SAMPLES, serviceFailures: 0, circuitOpenings: 0, securityEvents: 0 }, 1).verdict).toBe("HEALTHY")
    expect(judgeHealth({ successes: 15, serviceFailures: 6, circuitOpenings: 0, securityEvents: 0 }, 1)).toMatchObject({ verdict: "UNHEALTHY", reasons: ["FAILURE_RATE"] })
    expect(judgeHealth({ successes: 2, serviceFailures: 0, circuitOpenings: 1, securityEvents: 0 }, 1)).toMatchObject({ verdict: "UNHEALTHY", reasons: ["CIRCUIT_OPENED"] })
    expect(judgeHealth({ successes: 30, serviceFailures: 0, circuitOpenings: 0, securityEvents: 1 }, 1, { securityLimit: 0 })).toMatchObject({ verdict: "UNHEALTHY", reasons: ["SECURITY_EVENTS"] })
  })

  it("reads the ledger: agent mistakes are not service failures; a store failure is UNAVAILABLE, never HEALTHY", async () => {
    const { evaluateHealth } = await import("../rollout/health-gates")
    await seedExecutions("products.get", 20, 30, "RESOURCE_NOT_FOUND")
    expect((await evaluateHealth({ capabilityId: "products.get", environment: "development" }, new Date())).verdict).toBe("HEALTHY")
    await seedExecutions("products.get", 0, 30, "INTERNAL_ERROR")
    expect((await evaluateHealth({ capabilityId: "products.get", environment: "development" }, new Date())).verdict).toBe("UNHEALTHY")
    expect((await evaluateHealth({ capabilityId: "products.get", environment: "production" }, new Date())).verdict).toBe("INSUFFICIENT_DATA")
    vi.spyOn(k.approval.client.agentAuditEvent, "count").mockRejectedValue(new Error("down"))
    expect((await evaluateHealth({ capabilityId: "products.get", environment: "development" }, new Date())).verdict).toBe("UNAVAILABLE")
  })
})

describe("Phase 15 J — auto-pause in the maintenance pass", () => {
  it("pauses an unhealthy CANARY rollout (with evidence), leaves healthy and GENERAL rollouts alone", async () => {
    const svc = await service()
    for (const id of ["products.get", "products.list", "tickets.list"]) {
      let r = await svc.configureRollout({ capabilityId: id, canaryPercent: 20, allowedConnectionIds: ["conn_1"], reason: "start" }, SUPER)
      r = (await svc.transitionRollout({ capabilityId: id, action: "advance", expectedVersion: r.version, reason: "i" }, SUPER)).rollout
      r = (await svc.transitionRollout({ capabilityId: id, action: "advance", expectedVersion: r.version, reason: "c" }, SUPER)).rollout
      if (id === "tickets.list") await svc.transitionRollout({ capabilityId: id, action: "advance", expectedVersion: r.version, reason: "g" }, SUPER)
    }
    await seedExecutions("products.get", 5, 20) // unhealthy canary
    await seedExecutions("products.list", 30, 0) // healthy canary
    await seedExecutions("tickets.list", 5, 20) // unhealthy, but GENERAL
    const { runTaskMaintenance } = await import("../tasks/maintenance")
    const report = await runTaskMaintenance({ queue: k.queue, config: (await import("./task-test-kit")).TEST_CONFIG, clock: () => new Date() })
    expect(report.autoPaused).toBe(1)
    const stage = (id: string) => (Array.from(k.approval._rollouts.values()) as Array<Record<string, any>>).find((r) => r.capabilityId === id)!
    expect(stage("products.get")).toMatchObject({ stage: "PAUSED", pausedFromStage: "CANARY", updatedById: "system" })
    expect(stage("products.get").pausedReason).toMatch(/FAILURE_RATE/)
    expect(stage("products.list").stage).toBe("CANARY")
    expect(stage("tickets.list").stage).toBe("GENERAL")
    const auto = (await rows()).filter((e) => e.action === "rollout.auto_paused")
    expect(auto).toHaveLength(1)
    expect(auto[0]).toMatchObject({ actorType: "SYSTEM", capabilityId: "products.get" })
    // Resume is refused while still unhealthy.
    const paused = stage("products.get")
    expect(await code(svc.transitionRollout({ capabilityId: "products.get", action: "resume", expectedVersion: paused.version, reason: "too soon" }, SUPER))).toBe("INVALID_STATE")
  })
})

describe("Phase 15 K — attestations are ledger evidence", () => {
  it("records the checklist and the measured health; unhealthy health fails the attestation", async () => {
    const { recordReleaseAttestation, hasCurrentAttestation, ATTESTATION_CHECKS } = await import("../rollout/attestations")
    const all = [...ATTESTATION_CHECKS]
    const ok = await recordReleaseAttestation({ capabilityId: "products.get", environment: "development", confirmed: all, reason: "ready", actorId: SUPER }, new Date())
    expect(ok.view).toMatchObject({ passed: true, failedChecks: [], recordedBy: SUPER })
    expect(await hasCurrentAttestation("products.get", "development", new Date())).toBe(true)
    expect(await hasCurrentAttestation("products.get", "development", new Date(Date.now() + 8 * 86_400_000))).toBe(false)
    await seedExecutions("products.get", 0, 25)
    const bad = await recordReleaseAttestation({ capabilityId: "products.get", environment: "development", confirmed: all, reason: "ready?", actorId: SUPER }, new Date())
    expect(bad.view).toMatchObject({ passed: false, failedChecks: ["HEALTH_UNHEALTHY"] })
    expect(await hasCurrentAttestation("products.get", "development", new Date())).toBe(false) // the latest one counts
    const ev = (await rows()).filter((e) => e.action === "release.attestation_recorded")
    expect(ev).toHaveLength(2)
    expect(await ledger.verifyAuditChain()).toMatchObject({ ok: true })
  })
})

describe("Phase 15 L — guarded autonomy promotion", () => {
  async function promote(connectionId = "conn_1", environment = "development") {
    const { promoteAutonomy } = await import("../rollout/promotion")
    return promoteAutonomy({ connectionId, reason: "earned", actorId: SUPER, environment }, new Date())
  }

  it("one level at a time, keeping the risk ceiling and scope; evidence of each step", async () => {
    await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "OBSERVE_ONLY", maxRiskTier: "LOW_RISK_WRITE", allowedCapabilityIds: ["tickets.create"], actorId: SUPER })
    const first = await promote()
    expect(first).toMatchObject({ outcome: "PROMOTED", levelFrom: "OBSERVE_ONLY", levelTo: "ASSISTED" })
    const second = await promote()
    expect(second).toMatchObject({ outcome: "PROMOTED", levelFrom: "ASSISTED", levelTo: "APPROVAL_REQUIRED" })
    const policy = await (await import("../autonomy/policy-store")).loadEffectiveAutonomyPolicy("conn_1")
    expect(policy).toMatchObject({ autonomyLevel: "APPROVAL_REQUIRED", maxRiskTier: "LOW_RISK_WRITE", allowedCapabilityIds: ["tickets.create"] })
    // LIMITED_AUTONOMY needs HEALTHY evidence: with no executions recorded it is blocked.
    const third = await promote()
    expect(third).toMatchObject({ outcome: "BLOCKED", failedChecks: ["HEALTH_INSUFFICIENT_EVIDENCE"] })
    await seedExecutions("tickets.list", 25, 0)
    expect(await promote()).toMatchObject({ outcome: "PROMOTED", levelTo: "LIMITED_AUTONOMY" })
    const actions = (await rows()).filter((e) => e.action.startsWith("autonomy.promot")).map((e) => e.action)
    expect(actions).toEqual(["autonomy.promoted", "autonomy.promoted", "autonomy.promotion_blocked", "autonomy.promoted"])
  })

  it("blocked by a kill switch, by security events and by service failures; FULL autonomy is never promoted to in production", async () => {
    await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "OBSERVE_ONLY", maxRiskTier: "READ", actorId: SUPER })
    const svc = await service()
    const { killSwitch } = await svc.activateKillSwitch({ scope: "CONNECTION", target: "conn_1", reason: "hold" }, SUPER)
    expect((await promote()).failedChecks).toContain("KILL_SWITCH_ACTIVE")
    await svc.deactivateKillSwitch(killSwitch.publicRef, killSwitch.version, "released", SUPER)
    await ledger.appendAuditEvent({ action: "security.input_rejected", outcome: "DENIED", actor: { type: "AGENT", id: "conn_1" }, connectionId: "conn_1", environment: "development" })
    expect((await promote()).failedChecks).toContain("HEALTH_SECURITY_EVENTS")

    k.approval.seedConnection({ id: "conn_p", name: "Prod", ownerId: "owner_1", environment: "production" })
    await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_p", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE", actorId: SUPER })
    await seedExecutions("tickets.list", 25, 0, "INTERNAL_ERROR", "conn_p", "production")
    expect((await promote("conn_p", "production")).failedChecks).toContain("FULL_AUTONOMY_NOT_PROMOTABLE_IN_PRODUCTION")
    await seedExecutions("tickets.list", 0, 20, "TIMEOUT", "conn_p", "production")
    expect((await promote("conn_p", "production")).failedChecks).toContain("HEALTH_FAILURE_RATE")
  })

  it("demotion is immediate to any lower level and needs no guard", async () => {
    await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE", actorId: SUPER })
    const svc = await service()
    await svc.activateKillSwitch({ scope: "GLOBAL", reason: "incident" }, SUPER)
    const { demoteAutonomy } = await import("../rollout/promotion")
    const res = await demoteAutonomy({ connectionId: "conn_1", targetLevel: "OBSERVE_ONLY", reason: "incident", actorId: SUPER, environment: "development" })
    expect(res).toMatchObject({ outcome: "DEMOTED", levelFrom: "LIMITED_AUTONOMY", levelTo: "OBSERVE_ONLY" })
    expect(await code(demoteAutonomy({ connectionId: "conn_1", targetLevel: "ASSISTED", reason: "up?", actorId: SUPER, environment: "development" }))).toBe("INVALID_STATE")
    expect((await rows()).some((e) => e.action === "autonomy.demoted")).toBe(true)
  })
})

describe("Phase 15 M — governance routes and page", () => {
  const post = async (route: string, body: unknown, params: Record<string, string> = {}) => k.call(await import(`${API}/${route}/route`), "POST", { path: `/api/admin/agent-governance/${route}`, body, params })

  it("a super administrator operates every release control through its own route; each change is in the AuditLog", async () => {
    k.as(SUPER)
    const ks = await post("kill-switches", { scope: "CAPABILITY", target: "tickets.close", reason: "incident 7" })
    expect(ks.status).toBe(201)
    expect(ks.json.killSwitch).toMatchObject({ scope: "CAPABILITY", target: "tickets.close", active: true })
    const off = await post("kill-switches/[ref]/deactivate", { expectedVersion: 1, reason: "resolved" }, { ref: ks.json.killSwitch.ref })
    expect(off.status).toBe(200)
    expect(off.json.killSwitch.active).toBe(false)
    const conf = await post("rollouts", { capabilityId: "products.get", canaryPercent: 10, allowedConnectionIds: ["conn_1"], reason: "release" })
    expect(conf.json.rollout).toMatchObject({ stage: "DISABLED", version: 1 })
    const adv = await post("rollouts/transition", { capabilityId: "products.get", action: "advance", expectedVersion: 1, reason: "internal" })
    expect(adv.json.rollout).toMatchObject({ stage: "INTERNAL", version: 2 })
    const stale = await post("rollouts/transition", { capabilityId: "products.get", action: "advance", expectedVersion: 1, reason: "stale" })
    expect(stale.status).toBe(409)
    const att = await post("attestations", { capabilityId: "products.get", confirmed: ["TESTS_PASSED"], reason: "partial" })
    expect(att.status).toBe(201)
    expect(att.json.attestation).toMatchObject({ passed: false })
    await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "OBSERVE_ONLY", maxRiskTier: "READ", actorId: SUPER })
    const prom = await post("connections/[id]/autonomy", { direction: "promote", reason: "pilot" }, { id: "conn_1" })
    expect(prom.json.change).toMatchObject({ outcome: "PROMOTED", levelTo: "ASSISTED" })
    const blocked = await post("connections/[id]/autonomy", { direction: "promote", targetLevel: "LIMITED_AUTONOMY", reason: "skip" }, { id: "conn_1" })
    expect(blocked.status).toBe(400) // a promotion never names a target (one level at a time)
    await k.settle()
    const audit = k.auditEntries().map((a) => a.action)
    for (const a of ["AGENT_KILL_SWITCH_ACTIVATED", "AGENT_KILL_SWITCH_DEACTIVATED", "AGENT_ROLLOUT_CONFIGURED", "AGENT_ROLLOUT_TRANSITIONED", "AGENT_RELEASE_ATTESTED", "AGENT_AUTONOMY_PROMOTION"]) expect(audit, a).toContain(a)
  })

  it("strict bodies: unknown fields, bad enums, missing reasons and bad ids are refused with 400", async () => {
    k.as(SUPER)
    for (const [route, body] of [
      ["kill-switches", { scope: "GLOBAL" }],
      ["kill-switches", { scope: "EVERYTHING", reason: "x y z" }],
      ["kill-switches", { scope: "GLOBAL", reason: "drill", extra: 1 }],
      ["rollouts", { capabilityId: "products.get", canaryPercent: 10, allowedConnectionIds: ["../x"], reason: "bad id" }],
      ["rollouts/transition", { capabilityId: "products.get", action: "jump", expectedVersion: 1, reason: "bad action" }],
      ["rollouts/transition", { capabilityId: "products.get", action: "rollback", targetStage: "GENERAL", expectedVersion: 1, reason: "up is not back" }],
      ["attestations", { capabilityId: "products.get", confirmed: ["I_SAID_SO"], reason: "bad check" }],
    ] as Array<[string, unknown]>) {
      const res = await post(route, body)
      expect(res.status, `${route} ${JSON.stringify(body)}`).toBe(400)
    }
    expect(k.approval._killSwitches.size).toBe(0)
    expect(k.approval._rollouts.size).toBe(0)
  })

  it("the release page shows switches, rollouts with health, and attestations; it never shows secrets", async () => {
    k.as(SUPER)
    await post("kill-switches", { scope: "RISK_TIER", target: "LOW_RISK_WRITE", reason: "freeze writes" })
    await post("rollouts", { capabilityId: "products.get", canaryPercent: 10, allowedConnectionIds: ["conn_1"], reason: "release" })
    const out = await k.render(await import(`${PAGE}/release/page`), { pathname: "/admin/agent-governance/release" })
    expect(out.html).toContain("Release controls")
    expect(out.html).toContain("Kill switches")
    expect(out.html).toContain("freeze writes")
    expect(out.html).toContain("products.get")
    expect(out.html).toContain("INSUFFICIENT")
    expect(out.html).toContain("Release attestations")
    expect(out.html).not.toMatch(/agw_|whsec_/)
    const layout = await k.render(await import(`${PAGE}/layout`), { layout: true, pathname: "/admin/agent-governance/release" })
    expect(layout.html).toMatch(/<a(?=[^>]*aria-current="page")(?=[^>]*href="\/admin\/agent-governance\/release")[^>]*>Release controls<\/a>/)
  })
})
