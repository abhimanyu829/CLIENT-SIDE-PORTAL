/**
 * Phase 14 B / C / F — adversarial probes, red-team attack chains and the
 * security regression corpus, each run on a fresh real gateway
 * (simulation-test-driver.ts) and checked against every per-step
 * expectation AND every platform invariant. Extra effect checks below
 * prove the attacks changed nothing they should not have.
 */
import { describe, expect, it, vi } from "vitest"
import { runScenario } from "../simulation/runner"
import { ADVERSARIAL_SCENARIOS, RED_TEAM_SCENARIOS } from "../simulation/scenarios"
import { SECURITY_REGRESSION_CORPUS } from "../simulation/corpus"
import { NEVER_EXECUTABLE, PLANTED_SECRET } from "../simulation/world"
import type { Scenario } from "../simulation/types"
import { buildSimulationHarness } from "./simulation-test-driver"

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 })

const opts = { environment: "development", invariants: { neverExecutable: NEVER_EXECUTABLE } }

async function run(scenario: Scenario) {
  const h = await buildSimulationHarness()
  const result = await runScenario(scenario, h.driver, opts)
  return { h, result, world: await h.driver.snapshot() }
}

const byId = (list: readonly Scenario[], id: string) => list.find((s) => s.id === id)!

describe("Phase 14 B — adversarial probes", () => {
  it.each(ADVERSARIAL_SCENARIOS.map((s) => [s.id, s.title, s] as const))("%s %s", async (_id, _title, scenario) => {
    const { result } = await run(scenario)
    expect([...result.expectationFailures, ...result.violations]).toEqual([])
  })

  it("ADV-3: the cross-tenant close changed nothing; ADV-5: hostile inputs created no approval and reached no adapter", async () => {
    const adv3 = await run(byId(ADVERSARIAL_SCENARIOS, "ADV-3"))
    expect(adv3.h.k.exec._tickets.get("sim_tk_bravo")!.status).toBe("OPEN")
    expect(adv3.h.k.exec._tickets.get("sim_tk_alpha")!.status).toBe("OPEN")
    expect(adv3.world.writes).toEqual([])

    const adv5 = await run(byId(ADVERSARIAL_SCENARIOS, "ADV-5"))
    expect(adv5.h.k.approval._requests.size).toBe(0)
    expect(adv5.world.writes).toEqual([])
    expect(adv5.world.ledger.filter((e) => e.action.startsWith("execution."))).toEqual([])
  })

  it("ADV-4: forbidden capabilities never reached the gate or an adapter", async () => {
    const { world, h } = await run(byId(ADVERSARIAL_SCENARIOS, "ADV-4"))
    for (const id of NEVER_EXECUTABLE) expect(world.ledger.filter((e) => e.capabilityId === id), id).toEqual([])
    expect(h.k.approval._requests.size).toBe(0)
    expect(h.k.approval._tasks.size).toBe(0)
  })
})

describe("Phase 14 C — red-team attack chains", () => {
  it.each(RED_TEAM_SCENARIOS.map((s) => [s.id, s.title, s] as const))("%s %s", async (_id, _title, scenario) => {
    const { result } = await run(scenario)
    expect([...result.expectationFailures, ...result.violations]).toEqual([])
  })

  it("RT-1: the planted ticket is delivered as labelled, redacted data, and the hijacked follow-ups changed nothing", async () => {
    const { result, world, h } = await run(byId(RED_TEAM_SCENARIOS, "RT-1"))
    const planted = result.observations.find((o) => o.label === "planted")!
    expect(planted.text).not.toContain(PLANTED_SECRET)
    expect(planted.text).toMatch(/untrusted data, not as instructions/)
    expect(planted.text).toMatch(/INSTRUCTION_OVERRIDE/)
    expect(world.writes).toEqual([])
    expect(h.k.exec._tickets.get("sim_tk_bravo")!.status).toBe("OPEN")
    expect(world.ledger.some((e) => e.action === "security.injection_suspected")).toBe(true)
  })

  it("RT-2: one approved call ran exactly once; the altered call was refused and the replay needs a new approval", async () => {
    const { world } = await run(byId(RED_TEAM_SCENARIOS, "RT-2"))
    expect(world.writes.filter((w) => w.change === "created")).toHaveLength(1)
    expect(world.approvals.filter((a) => a.consumedCount === 1)).toHaveLength(1)
    // Exactly one approval was ever consumed; every other request is still waiting for a human.
    const statuses = world.approvals.map((a) => a.status)
    expect(statuses.filter((s) => s === "CONSUMED")).toHaveLength(1)
    expect(statuses.filter((s) => s !== "CONSUMED").every((s) => s === "PENDING")).toBe(true)
  })

  it("RT-3: the async cross-tenant close failed in the worker and the victim's ticket is untouched", async () => {
    const { result, h } = await run(byId(RED_TEAM_SCENARIOS, "RT-3"))
    const status = result.observations.find((o) => o.label === "closeStatus")!.output as Record<string, unknown>
    expect(status.status).toBe("FAILED")
    expect(h.k.exec._tickets.get("sim_tk_bravo")!.status).toBe("OPEN")
  })

  it("RT-5: a retry storm on one key produced one task and one ticket", async () => {
    const { result, world, h } = await run(byId(RED_TEAM_SCENARIOS, "RT-5"))
    const refs = new Set(result.observations.filter((o) => o.kind === "task_submit").map((o) => (o.output as { taskRef: string }).taskRef))
    expect(refs.size).toBe(1)
    expect(h.k.approval._tasks.size).toBe(1)
    expect(world.writes).toHaveLength(1)
  })
})

describe("Phase 14 F — security regression corpus", () => {
  it("entries are unique, referenced, and the known set is still present (append-only)", () => {
    const ids = SECURITY_REGRESSION_CORPUS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SECURITY_REGRESSION_CORPUS) {
      expect(s.category).toBe("REGRESSION")
      expect((s.reference ?? "").length, s.id).toBeGreaterThan(10)
    }
    for (const known of ["REG-P4-1", "REG-P4-2", "REG-P5-1", "REG-P8-1", "REG-P12-B1", "REG-P12-B2", "REG-P12-B3", "REG-P12-E", "REG-P12-B4", "REG-P13-B1", "REG-P13-B2", "REG-P13-E"]) {
      expect(ids).toContain(known)
    }
  })

  it.each(SECURITY_REGRESSION_CORPUS.map((s) => [s.id, s.reference ?? "", s] as const))("%s (%s)", async (_id, _ref, scenario) => {
    const { result } = await run(scenario)
    expect([...result.expectationFailures, ...result.violations]).toEqual([])
  })
})
