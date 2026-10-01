/**
 * Phase 14 A — the simulation engine itself: environment guard, no HTTP
 * surface, purity, deterministic generation, step references, and
 * invariants that are proven NOT vacuous (each one detects a seeded
 * violation and stays silent on clean evidence). Benign baselines pass on
 * the real gateway.
 */
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"
import { describe, expect, it, vi } from "vitest"
import { checkInvariants, INVARIANT_IDS } from "../simulation/invariants"
import { assertSimulationEnvironment, errorCodeOf, runScenario, SimulationEnvironmentError } from "../simulation/runner"
import { fuzzCases, mulberry32 } from "../simulation/fuzzer"
import { ALPHA, BRAVO, NEVER_EXECUTABLE, PLANTED_SECRET } from "../simulation/world"
import { BENIGN_SCENARIOS } from "../simulation/scenarios"
import type { Observation, SimulationDriver, WorldSnapshot } from "../simulation/types"
import { buildSimulationHarness } from "./simulation-test-driver"

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 })

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = path.join(dir, e)
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(e) ? [full] : []
  })
}

const clean = (): WorldSnapshot => ({ ledger: [], ledgerChainValid: true, writes: [], tenantMarkers: { owner_1: ["ALPHA-PRIVATE-7781"], owner_2: ["BRAVO-PRIVATE-9932"] }, approvals: [] })
const obs = (o: Partial<Observation>): Observation => ({ index: 0, kind: "tool", isError: false, code: null, text: "{}", actor: ALPHA, ...o })
const ctx = { neverExecutable: NEVER_EXECUTABLE }

describe("Phase 14 A1 — guard rails of the engine", () => {
  it("refuses production (and anything unknown); development and staging only", () => {
    expect(() => assertSimulationEnvironment("production")).toThrow(SimulationEnvironmentError)
    expect(() => assertSimulationEnvironment("prod")).toThrow(SimulationEnvironmentError)
    expect(() => assertSimulationEnvironment("")).toThrow(SimulationEnvironmentError)
    expect(() => assertSimulationEnvironment("development")).not.toThrow()
    expect(() => assertSimulationEnvironment("staging")).not.toThrow()
  })

  it("runScenario enforces the guard before the driver is touched", async () => {
    const driver: SimulationDriver = { execute: vi.fn(), snapshot: vi.fn() }
    await expect(runScenario(BENIGN_SCENARIOS[0], driver, { environment: "production", invariants: ctx })).rejects.toThrow(SimulationEnvironmentError)
    expect(driver.execute).not.toHaveBeenCalled()
  })

  it("has no HTTP surface: nothing outside the simulation module and the tests imports it", () => {
    const importers = [...files(path.resolve("app")), ...files(path.resolve("lib")), ...files(path.resolve("components"))]
      .filter((f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.includes(`${path.sep}simulation${path.sep}`))
      .filter((f) => /from\s+["'][^"']*simulation["'/]/.test(readFileSync(f, "utf8")))
    expect(importers).toEqual([])
  })

  it("is pure: no datastore, network, environment or clock access in the engine", () => {
    for (const f of files(path.resolve("lib/agent-gateway/simulation"))) {
      const src = readFileSync(f, "utf8")
      expect(src, f).not.toMatch(/@\/lib\/(db|redis|queue)|from\s+["'](?:node:)?(?:https?|net|dns|fs|child_process)["']|process\.env|Date\.now\(|new Date\(|Math\.random/)
    }
  })
})

describe("Phase 14 A2 — deterministic generation and step references", () => {
  it("the PRNG and the fuzzer are reproducible from the seed", () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 50 }, () => a())
    expect(Array.from({ length: 50 }, () => b())).toEqual(seqA)
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(new Set(seqA).size).toBe(50)
    expect(fuzzCases(7, "tickets.get", { ticketId: "x" }, 40)).toEqual(fuzzCases(7, "tickets.get", { ticketId: "x" }, 40))
    expect(fuzzCases(8, "tickets.get", { ticketId: "x" }, 40)).not.toEqual(fuzzCases(7, "tickets.get", { ticketId: "x" }, 40))
  })

  it("covers every mutation strategy, and prototype-key cases survive the wire as own keys", () => {
    const cases = fuzzCases(1, "tickets.create", { subject: "s", description: "d" }, 400)
    expect(new Set(cases.map((c) => c.strategy))).toEqual(
      new Set(["replace-field", "identity-injection", "unknown-field", "drop-field", "deep", "wide", "prototype-key", "type-confusion", "multi-field"])
    )
    const proto = cases.find((c) => c.strategy === "prototype-key")!
    expect(Object.keys(JSON.parse(proto.argsJson)).some((k) => ["__proto__", "constructor", "prototype"].includes(k))).toBe(true)
  })

  it("resolves $ref placeholders from labelled earlier outputs", async () => {
    const seen: unknown[] = []
    const driver: SimulationDriver = {
      execute: async (step, index) => {
        if (step.kind === "tool") seen.push(step.args)
        return obs({ index, label: step.label, output: { taskRef: "atk_abc", n: 3 } })
      },
      snapshot: async () => clean(),
    }
    const result = await runScenario(
      {
        id: "T",
        title: "refs",
        category: "BENIGN",
        steps: [
          { kind: "tool", actor: ALPHA, name: "a", args: {}, label: "first" },
          { kind: "tool", actor: ALPHA, name: "b", args: { ref: "$ref:first.taskRef", nested: ["$ref:first.n"], missing: "$ref:none.x", plain: "$ref is text" } },
        ],
      },
      driver,
      { environment: "development", invariants: ctx }
    )
    expect(seen[1]).toEqual({ ref: "atk_abc", nested: [3], missing: "unresolved", plain: "$ref is text" })
    expect(result.passed).toBe(true)
  })

  it("parses stable error codes", () => {
    expect(errorCodeOf("RESOURCE_NOT_FOUND: No ticket.")).toBe("RESOURCE_NOT_FOUND")
    expect(errorCodeOf("MCP error -32602: Input validation error")).toBe("MCP_PROTOCOL")
    expect(errorCodeOf("Something broke")).toBeNull()
  })
})

describe("Phase 14 A3 — every invariant detects its violation (no vacuous checks)", () => {
  const e = (seq: number, action: string, x: Partial<{ requestId: string; capabilityId: string; riskTier: string; ownerId: string }> = {}) => ({
    sequence: seq,
    action,
    outcome: "SUCCESS",
    requestId: x.requestId ?? "r1",
    connectionId: "conn_1",
    ownerId: x.ownerId ?? "owner_1",
    capabilityId: x.capabilityId ?? "tickets.create",
    riskTier: x.riskTier ?? "LOW_RISK_WRITE",
  })
  const audited = [e(1, "authorization.allowed"), e(2, "execution.started"), e(3, "execution.succeeded")]

  it("clean evidence produces no violation", () => {
    expect(checkInvariants([obs({ text: "ALPHA-PRIVATE-7781" }), obs({ isError: true, text: "RESOURCE_NOT_FOUND: x" })], { ...clean(), ledger: audited, writes: [{ model: "Ticket", id: "t", ownerId: "owner_1", change: "created" }] }, ctx)).toEqual([])
  })

  const cases: Array<[string, Observation[], Partial<WorldSnapshot>]> = [
    ["NO_CROSS_TENANT_LEAK", [obs({ text: "... BRAVO-PRIVATE-9932 ..." })], {}],
    ["NO_SECRET_LEAK", [obs({ text: `token ${PLANTED_SECRET}` })], {}],
    ["STABLE_ERRORS", [obs({ isError: true, text: "Error: boom\n    at Object.<anonymous> (file.ts:1:1)" })], {}],
    ["STABLE_ERRORS", [obs({ isError: true, text: "INTERNAL_ERROR: Invalid `prisma.ticket.create()` invocation" })], {}],
    ["NO_UNAUDITED_WRITE", [], { writes: [{ model: "Ticket", id: "t", ownerId: "owner_1", change: "created" }] }],
    ["NO_UNAUDITED_WRITE", [], { ledger: [e(1, "authorization.allowed"), e(3, "execution.succeeded")] }],
    ["NO_UNAUTHORIZED_WRITE", [], { ledger: [e(2, "execution.started"), e(3, "execution.succeeded")] }],
    ["NO_UNAUTHORIZED_WRITE", [], { ledger: [e(1, "authorization.allowed", { requestId: "other" }), e(2, "execution.started"), e(3, "execution.succeeded")] }],
    ["OWNER_ONLY_WRITES", [], { ledger: audited, writes: [{ model: "Ticket", id: "t", ownerId: "owner_2", change: "created" }] }],
    ["NEVER_EXECUTABLE", [], { ledger: [e(1, "authorization.allowed", { capabilityId: "refunds.process" }), e(2, "execution.started", { capabilityId: "refunds.process" })] }],
    ["APPROVAL_SINGLE_USE", [], { approvals: [{ publicRef: "apr_x", status: "CONSUMED", consumedCount: 2 }] }],
    ["LEDGER_INTEGRITY", [], { ledgerChainValid: false }],
  ]
  it.each(cases)("%s fires on its seeded violation", (invariant, observations, patch) => {
    const found = checkInvariants(observations, { ...clean(), ...patch }, ctx).map((x) => x.invariant)
    expect(found).toContain(invariant)
  })

  it("every declared invariant has a seeded-violation case", () => {
    expect(new Set(cases.map((c) => c[0]))).toEqual(new Set(INVARIANT_IDS))
  })
})

describe("Phase 14 A4 — benign baselines on the real gateway", () => {
  it.each(BENIGN_SCENARIOS.map((s) => [s.id, s] as const))("%s passes every expectation and invariant", async (_id, scenario) => {
    const h = await buildSimulationHarness()
    const result = await runScenario(scenario, h.driver, { environment: "development", invariants: ctx })
    expect([...result.expectationFailures, ...result.violations]).toEqual([])
    expect(result.passed).toBe(true)
  })

  it("BEN-2 leaves exactly the two tickets ALPHA created, one of them closed; BEN-3 one ticket for BRAVO", async () => {
    const h = await buildSimulationHarness()
    await runScenario(BENIGN_SCENARIOS[1], h.driver, { environment: "development", invariants: ctx })
    const created = (await h.driver.snapshot()).writes.filter((w) => w.change === "created")
    expect(created).toHaveLength(2)
    expect(created.every((w) => w.ownerId === ALPHA.ownerId)).toBe(true)
    const h2 = await buildSimulationHarness()
    await runScenario(BENIGN_SCENARIOS[2], h2.driver, { environment: "development", invariants: ctx })
    expect((await h2.driver.snapshot()).writes).toEqual([expect.objectContaining({ change: "created", ownerId: BRAVO.ownerId })])
  })
})
