/**
 * Phase 11 D — capability-aware recovery ("rollback").
 *
 * The REAL RecoveryService, ExecutionGate (scripted Phase 6 decision and
 * autonomy policy), AdapterResolver, audit ledger and approval engine over
 * the Phase 7 fake DB, with fixture capabilities that declare explicit
 * recovery mappings and operate on an in-memory store (so a recovery is
 * proven to restore / compensate real state, not merely to report it).
 */
import { beforeEach, describe, expect, it } from "vitest"
import { DENY, policy } from "./p7-helpers"
import { buildRecoveryKit, SUPER_ADMIN_ID, type RecoveryKit } from "./recovery-test-kit"

let k: RecoveryKit
const ADMIN = { userId: SUPER_ADMIN_ID }

beforeEach(async () => {
  k = await buildRecoveryKit()
})

async function createThing(name = "alpha") {
  const result = await k.agentExecute("fixtures.createThing", { name })
  const event = await k.lastSucceeded("fixtures.createThing")
  return { id: (result.output as { id: string }).id, event }
}

describe("Phase 11 D — the declarative recovery model", () => {
  it("execution evidence carries the identifiers the declared recovery needs (and nothing else)", async () => {
    const { id, event } = await createThing()
    expect(event.metadata).toMatchObject({ recoveryInput: { thingId: id } })
    expect(event.outputDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(event)).not.toContain('"name":"alpha"')
    // A READ records no recovery input.
    await k.agentExecute("fixtures.readThing", { thingId: id })
    const read = await k.lastSucceeded("fixtures.readThing")
    expect(read.metadata).not.toHaveProperty("recoveryInput")
  })

  it("registration rejects malformed recovery specifications", async () => {
    const { CapabilityRegistry } = await import("../capabilities/registry")
    const base = k.registry.getVersion("fixtures.createThing", 1)!
    const variants: Array<[string, Record<string, unknown>]> = [
      ["irreversible capability declaring automatic recovery", { reversibility: "IRREVERSIBLE", mechanism: "x", recovery: { ...base.rollback.recovery } }],
      // (the variant is registered as "fixtures.variant")
      ["self recovery", { ...base.rollback, recovery: { ...base.rollback.recovery, capabilityId: "fixtures.variant" } }],
      ["missing version", { ...base.rollback, recovery: { ...base.rollback.recovery, capabilityVersion: undefined } }],
      ["mapping from outside input/output", { ...base.rollback, recovery: { ...base.rollback.recovery, inputMapping: { thingId: "context.ownerId" } } }],
      ["nested mapping path", { ...base.rollback, recovery: { ...base.rollback.recovery, inputMapping: { thingId: "output.a.b" } } }],
      ["empty mapping", { ...base.rollback, recovery: { ...base.rollback.recovery, inputMapping: {} } }],
      ["IRREVERSIBLE class referencing a capability", { ...base.rollback, recovery: { class: "IRREVERSIBLE", capabilityId: "fixtures.archiveThing", manualRecoveryRequired: true, recommendation: "x" } }],
      ["unknown class", { ...base.rollback, recovery: { ...base.rollback.recovery, class: "MAGIC" } }],
      ["no recommendation", { ...base.rollback, recovery: { ...base.rollback.recovery, recommendation: "" } }],
    ]
    for (const [name, rollback] of variants) {
      const registry = new CapabilityRegistry()
      expect(() => registry.register({ ...base, id: "fixtures.variant", rollback: rollback as never }), name).toThrow(/recovery/i)
    }
  })

  it("a write without an explicit mapping is manual recovery, never an invented reversal", async () => {
    const { resolveRecoverySpec } = await import("../recovery/spec")
    expect(resolveRecoverySpec(k.registry.getVersion("fixtures.noSpecWrite", 1)!)).toMatchObject({ class: "IRREVERSIBLE", manualRecoveryRequired: true })
    expect(resolveRecoverySpec(k.registry.getVersion("fixtures.readThing", 1)!)).toBeNull()
    // No production capability declares an automatic recovery before Phase 13.
    for (const def of k.registry.list({ includeDisabled: true, includeForbidden: true }).filter((d) => !d.id.startsWith("fixtures."))) {
      const spec = resolveRecoverySpec(def)
      if (spec && spec.class !== "IRREVERSIBLE") {
        expect(k.registry.getVersion(spec.capabilityId!, spec.capabilityVersion!), `${def.id} -> ${spec.capabilityId}`).not.toBeNull()
      }
    }
  })
})

describe("Phase 11 D — successful recovery", () => {
  it("COMPENSATABLE: archives exactly the created thing through gate + resolver, with a deterministic idempotency key", async () => {
    const { id, event } = await createThing()
    expect(k.things.get(id)!.archived).toBe(false)
    const view = await k.service.requestRecovery({ eventId: event.eventId, reason: "agent created it by mistake" }, ADMIN)
    expect(view).toMatchObject({ status: "SUCCEEDED", recoveryClass: "COMPENSATABLE", recoveryCapabilityId: "fixtures.archiveThing", attempts: 1, errorCode: null })
    expect(view.residualEffects).toMatch(/remains/)
    expect(view.recoveryRef).toMatch(/^rcv_[0-9a-f]{32}$/)
    expect(k.things.get(id)!.archived).toBe(true)
    const archive = k.dispatchesOf("fixtures.archiveThing")
    expect(archive).toHaveLength(1)
    expect(archive[0]).toMatchObject({ input: { thingId: id }, idempotencyKey: `recovery.${view.recoveryRef}` })
    // The recovery ran through the gate as the ORIGINAL connection.
    expect(k.decide).toHaveBeenLastCalledWith(expect.objectContaining({ connectionId: "conn_1", ownerId: "owner_1" }), expect.objectContaining({ id: "fixtures.archiveThing" }), { thingId: id })
  })

  it("REVERSIBLE: restores the recorded previous price", async () => {
    const { id } = await createThing()
    await k.agentExecute("fixtures.setPrice", { thingId: id, price: 100 })
    await k.agentExecute("fixtures.setPrice", { thingId: id, price: 150 })
    const event = await k.lastSucceeded("fixtures.setPrice")
    expect(event.metadata).toMatchObject({ recoveryInput: { thingId: id, price: 100 } })
    const view = await k.service.requestRecovery({ eventId: event.eventId, reason: "wrong price" }, ADMIN)
    expect(view).toMatchObject({ status: "SUCCEEDED", recoveryClass: "REVERSIBLE" })
    expect(k.things.get(id)!.price).toBe(100)
  })

  it("the whole recovery is evidenced in the chain, and the chain still verifies", async () => {
    const { event } = await createThing()
    const view = await k.service.requestRecovery({ eventId: event.eventId, reason: "cleanup" }, ADMIN)
    await k.flush()
    const recoveryEvents = k.events().filter((e) => e.category === "ROLLBACK")
    expect(recoveryEvents.map((e) => e.action)).toEqual(["recovery.requested", "recovery.executing", "recovery.succeeded"])
    for (const e of recoveryEvents) {
      expect(e).toMatchObject({ actorType: "HUMAN", actorId: SUPER_ADMIN_ID, connectionId: "conn_1" })
      expect((e.metadata as Record<string, unknown>).recoveryRef).toBe(view.recoveryRef)
    }
    // The recovery capability's own execution is evidenced like any agent mutation.
    const archiveExec = k.events().filter((e) => e.capabilityId === "fixtures.archiveThing" && e.category === "EXECUTION").map((e) => e.action)
    expect(archiveExec).toEqual(["execution.started", "execution.succeeded"])
    expect(await k.ledger.verifyAuditChain()).toMatchObject({ ok: true })
  })
})

describe("Phase 11 D — irreversible and manual recovery", () => {
  it("IRREVERSIBLE: nothing is executed; the recommendation is recorded as MANUAL_RECOVERY_REQUIRED", async () => {
    await k.agentExecute("fixtures.sendNotice", { thingId: "t1" }, { approve: true })
    const event = await k.lastSucceeded("fixtures.sendNotice")
    const before = k.dispatches.length
    const view = await k.service.requestRecovery({ eventId: event.eventId, reason: "sent to the wrong customer" }, ADMIN)
    expect(view).toMatchObject({ status: "MANUAL_RECOVERY_REQUIRED", recoveryClass: "IRREVERSIBLE", recoveryCapabilityId: null })
    expect(view.recommendation).toMatch(/correction/)
    expect(view.completedAt).not.toBeNull()
    expect(k.dispatches.length).toBe(before)
    await k.flush()
    expect(k.eventsFor("recovery.manual_required")).toHaveLength(1)
  })

  it("a write with no mapping is manual (no fake rollback)", async () => {
    await k.agentExecute("fixtures.noSpecWrite", { thingId: "t1" })
    const view = await k.service.requestRecovery({ eventId: (await k.lastSucceeded("fixtures.noSpecWrite")).eventId, reason: "undo" }, ADMIN)
    expect(view).toMatchObject({ status: "MANUAL_RECOVERY_REQUIRED", recoveryClass: "IRREVERSIBLE" })
  })

  it("missing recorded identifiers -> manual (the recovery is never reconstructed from mutable state)", async () => {
    const { id } = await createThing()
    await k.agentExecute("fixtures.setPrice", { thingId: id, price: 100 }) // previousPrice was null
    const view = await k.service.requestRecovery({ eventId: (await k.lastSucceeded("fixtures.setPrice")).eventId, reason: "undo" }, ADMIN)
    expect(view).toMatchObject({ status: "MANUAL_RECOVERY_REQUIRED", errorCode: "RECOVERY_INPUT_UNAVAILABLE" })
    expect(k.dispatchesOf("fixtures.restorePrice")).toHaveLength(0)
  })

  it("the original connection is no longer ACTIVE / moved environment -> manual, nothing runs", async () => {
    const { event } = await createThing()
    k.fake.updateConnection("conn_1", { status: "SUSPENDED" })
    const suspended = await k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN)
    expect(suspended).toMatchObject({ status: "MANUAL_RECOVERY_REQUIRED", errorCode: "CONNECTION_NOT_ACTIVE" })
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)

    const second = await createThingAfterReactivation()
    k.fake.updateConnection("conn_1", { environment: "production" })
    expect(await k.service.requestRecovery({ eventId: second.eventId, reason: "undo" }, ADMIN)).toMatchObject({ status: "MANUAL_RECOVERY_REQUIRED", errorCode: "CONNECTION_NOT_ACTIVE" })
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)

    async function createThingAfterReactivation() {
      k.fake.updateConnection("conn_1", { status: "ACTIVE" })
      return (await createThing("beta")).event
    }
  })

  it("the declared recovery capability is unavailable (disabled) -> manual", async () => {
    const { event } = await createThing()
    k.registry.disable("fixtures.archiveThing", 1)
    expect(await k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN)).toMatchObject({ status: "MANUAL_RECOVERY_REQUIRED", errorCode: "RECOVERY_CAPABILITY_UNAVAILABLE" })
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)
  })
})

describe("Phase 11 D — failed, duplicate and concurrent recovery", () => {
  it("a failed recovery is FAILED with the stable code; a retry succeeds; a completed recovery never runs again", async () => {
    const { id, event } = await createThing()
    k.state.failAdapter["fixtures.archiveThing"] = "EXECUTION_UNAVAILABLE"
    const failed = await k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN)
    expect(failed).toMatchObject({ status: "FAILED", errorCode: "EXECUTION_UNAVAILABLE", attempts: 1 })
    expect(k.things.get(id)!.archived).toBe(false)

    k.state.failAdapter["fixtures.archiveThing"] = undefined
    const retried = await k.service.requestRecovery({ eventId: event.eventId, reason: "retry" }, ADMIN)
    expect(retried).toMatchObject({ status: "SUCCEEDED", attempts: 2, recoveryRef: failed.recoveryRef })
    expect(k.things.get(id)!.archived).toBe(true)

    const again = await k.service.requestRecovery({ eventId: event.eventId, reason: "again" }, ADMIN)
    expect(again).toMatchObject({ status: "SUCCEEDED", attempts: 2 })
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(2) // one failed dispatch + one success, never a third
    expect(k.recoveries()).toHaveLength(1)
  })

  it("concurrent duplicate requests create one recovery and dispatch the compensation exactly once", async () => {
    const { event } = await createThing()
    const results = await Promise.all(Array.from({ length: 8 }, () => k.service.requestRecovery({ eventId: event.eventId, reason: "double click" }, ADMIN)))
    expect(new Set(results.map((r) => r.recoveryRef)).size).toBe(1)
    expect(k.recoveries()).toHaveLength(1)
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(1)
    expect(k.recoveries()[0].status).toBe("SUCCEEDED")
  })
})

describe("Phase 11 D — a recovery never bypasses authorization, autonomy or approval", () => {
  it("Phase 6 denial at recovery time -> FAILED (AUTHORIZATION_DENIED), nothing executed", async () => {
    const { id, event } = await createThing()
    k.state.authz = DENY
    const view = await k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN)
    expect(view).toMatchObject({ status: "FAILED", errorCode: "AUTHORIZATION_DENIED" })
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)
    expect(k.things.get(id)!.archived).toBe(false)
  })

  it("autonomy below the recovery's risk -> FAILED (AUTONOMY_DENIED)", async () => {
    const { event } = await createThing()
    k.state.policy = policy({ autonomyLevel: "OBSERVE_ONLY", maxRiskTier: "READ" })
    expect(await k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN)).toMatchObject({ status: "FAILED", errorCode: "AUTONOMY_DENIED" })
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)
  })

  it("approval required -> APPROVAL_REQUIRED with the approval ref; after a human approves, the retry consumes it once", async () => {
    const { id, event } = await createThing()
    k.state.policy = policy({ autonomyLevel: "APPROVAL_REQUIRED", maxRiskTier: "LOW_RISK_WRITE" })
    const waiting = await k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN)
    expect(waiting.status).toBe("APPROVAL_REQUIRED")
    expect(waiting.approvalRef).toMatch(/^apr_[0-9a-f]{32}$/)
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)

    // Retrying before approval does not run it either.
    expect((await k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN)).status).toBe("APPROVAL_REQUIRED")
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)

    await k.approveRef(waiting.approvalRef!)
    const done = await k.service.requestRecovery({ eventId: event.eventId, reason: "approved" }, ADMIN)
    expect(done.status).toBe("SUCCEEDED")
    expect(k.things.get(id)!.archived).toBe(true)
    const approvalRow = Array.from(k.fake._requests.values()).find((r) => r.publicRef === waiting.approvalRef)!
    expect(approvalRow.status).toBe("CONSUMED")
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(1)
  })

  it("the policy store failing at recovery time fails closed (FAILED, POLICY_UNAVAILABLE)", async () => {
    const { event } = await createThing()
    k.decide.mockRejectedValueOnce(new Error("policy store down"))
    expect(await k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN)).toMatchObject({ status: "FAILED", errorCode: "POLICY_UNAVAILABLE" })
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)
  })
})

describe("Phase 11 D — evidence the recovery relies on must be intact", () => {
  it("a tampered source event is refused (no recovery row, nothing runs) and the refusal is evidenced", async () => {
    const { event } = await createThing()
    await createThing("decoy")
    const decoyId = "thing_2"
    const stored = Array.from(k.fake._auditEvents.entries()).find(([, r]) => r.eventId === event.eventId)!
    k.fake._auditEvents.set(stored[0], { ...stored[1], metadata: { ...(stored[1].metadata as object), recoveryInput: { thingId: decoyId } } })
    expect(await k.catchCode(k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN))).toBe("INVALID_STATE")
    expect(k.recoveries()).toHaveLength(0)
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)
    expect(k.things.get(decoyId)!.archived).toBe(false)
    await k.flush()
    expect(k.eventsFor("security.input_rejected").at(-1)).toMatchObject({ errorCode: "EVIDENCE_INTEGRITY" })
  })

  it("a re-digested forgery is caught by the broken link to its predecessor", async () => {
    const { event } = await createThing()
    const stored = Array.from(k.fake._auditEvents.entries()).find(([, r]) => r.eventId === event.eventId)!
    const forged = { ...stored[1], metadata: { recoveryInput: { thingId: "thing_999" } }, previousEventDigest: "d".repeat(64) }
    k.fake._auditEvents.set(stored[0], { ...forged, eventDigest: k.ledger.computeEventDigest(forged as never) })
    expect(await k.catchCode(k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN))).toBe("INVALID_STATE")
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)
  })

  it("a re-digested forgery that keeps its own back-link is caught by its successor's link", async () => {
    const { event } = await createThing()
    await createThing("later") // guarantees the source event has successors
    await k.flush()
    const stored = Array.from(k.fake._auditEvents.entries()).find(([, r]) => r.eventId === event.eventId)!
    const forged = { ...stored[1], metadata: { recoveryInput: { thingId: "thing_2" } } }
    const rewritten = { ...forged, eventDigest: k.ledger.computeEventDigest(forged as never) }
    k.fake._auditEvents.set(stored[0], rewritten)
    // Its own digest and its back-link are consistent: only the successor's link exposes it.
    expect(k.ledger.eventDigestMatches(rewritten as never)).toBe(true)
    expect(await k.catchCode(k.service.requestRecovery({ eventId: event.eventId, reason: "undo" }, ADMIN))).toBe("INVALID_STATE")
    expect(k.things.get("thing_2")!.archived).toBe(false)
    expect(k.dispatchesOf("fixtures.archiveThing")).toHaveLength(0)
  })

  it("only a recorded successful write can be recovered", async () => {
    const { id } = await createThing()
    await k.agentExecute("fixtures.readThing", { thingId: id })
    const read = await k.lastSucceeded("fixtures.readThing")
    expect(await k.catchCode(k.service.requestRecovery({ eventId: read.eventId, reason: "x" }, ADMIN))).toBe("VALIDATION_FAILED")
    const started = k.eventsFor("execution.started")[0]
    expect(await k.catchCode(k.service.requestRecovery({ eventId: started.eventId, reason: "x" }, ADMIN))).toBe("VALIDATION_FAILED")
    expect(await k.catchCode(k.service.requestRecovery({ eventId: "aud_" + "0".repeat(32), reason: "x" }, ADMIN))).toBe("NOT_FOUND")
    expect(await k.catchCode(k.service.requestRecovery({ eventId: "../../etc", reason: "x" }, ADMIN))).toBe("NOT_FOUND")
    expect(k.recoveries()).toHaveLength(0)
  })
})
