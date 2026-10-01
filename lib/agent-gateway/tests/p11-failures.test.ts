/**
 * Phase 11 E — failure behaviour: no unaudited mutation (the ledger being
 * down blocks writes but never reads), queued writes that were provably not
 * dispatched are retried rather than failed, telemetry failures never
 * change an operation, and circuit breakers open / half-open / close on
 * infrastructure failures only, in narrow scopes.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { buildRecoveryKit, type RecoveryKit } from "./recovery-test-kit"
import { buildTaskKit } from "./task-test-kit"

let k: RecoveryKit

beforeEach(async () => {
  k = await buildRecoveryKit()
})

/** Makes every ledger read/append fail until `restore()` is called. */
function ledgerOutage(fake: { client: { agentAuditEvent: { findFirst: any } } }) {
  const findFirst = fake.client.agentAuditEvent.findFirst
  const original = findFirst.getMockImplementation()
  let down = true
  findFirst.mockImplementation(async (args: unknown) => {
    if (down) throw new Error("ledger database unavailable")
    return original(args)
  })
  return { restore: () => (down = false) }
}

describe("Phase 11 E — no unaudited mutation", () => {
  it("ledger down: a write is refused BEFORE dispatch (fail closed); a read still works", async () => {
    const { id } = (await k.agentExecute("fixtures.createThing", { name: "alpha" })).output as { id: string }
    const before = k.dispatches.length
    const outage = ledgerOutage(k.fake)

    let refused: unknown
    try {
      await k.agentExecute("fixtures.createThing", { name: "beta" })
    } catch (err) {
      refused = err
    }
    expect(refused).toBeInstanceOf(k.ExecutionError)
    expect(refused).toMatchObject({ code: "EXECUTION_UNAVAILABLE", details: { dispatched: false } })
    expect((refused as Error).message).toMatch(/audit ledger is unavailable/)
    expect(k.dispatches.length).toBe(before)
    expect(Array.from(k.things.values()).map((t) => t.name)).toEqual(["alpha"])

    // READs never depend on the ledger.
    expect((await k.agentExecute("fixtures.readThing", { thingId: id })).output).toMatchObject({ id, name: "alpha" })

    outage.restore()
    await k.agentExecute("fixtures.createThing", { name: "beta" })
    expect(Array.from(k.things.values()).map((t) => t.name)).toEqual(["alpha", "beta"])
  })

  it("an adapter cannot forge a 'not dispatched' claim (only the resolver knows)", async () => {
    k.state.adapterError["fixtures.noSpecWrite"] = new k.ExecutionError("EXECUTION_UNAVAILABLE", "x", { dispatched: false, field: "kept" })
    let caught: unknown
    try {
      await k.agentExecute("fixtures.noSpecWrite", { thingId: "t" })
    } catch (err) {
      caught = err
    }
    expect(k.dispatchesOf("fixtures.noSpecWrite")).toHaveLength(1)
    expect(caught).toMatchObject({ code: "EXECUTION_UNAVAILABLE", details: { field: "kept" } })
    expect((caught as { details?: Record<string, unknown> }).details).not.toHaveProperty("dispatched")
  })

  it("a queued write refused pre-dispatch (ledger down) is retried, not failed, and runs exactly once afterwards", async () => {
    const t = await buildTaskKit()
    const { task } = await t.submit("fixtures.conditionalWrite", { value: "a" })
    const outage = ledgerOutage(t.fake)
    await t.drain(1)
    const afterOutage = t.taskByRef(task.taskRef)!
    expect(afterOutage.status).not.toBe("FAILED")
    expect(afterOutage.attempts).toBe(1)
    expect(t.calls.count).toBe(0)
    outage.restore()
    await t.drain()
    expect(t.taskByRef(task.taskRef)!.status).toBe("SUCCEEDED")
    expect(t.calls.count).toBe(1)
  })

  it("a write that DID dispatch and failed transiently is still never blindly retried (Phase 8 rule unchanged)", async () => {
    const t = await buildTaskKit()
    t.behaviour.run = async () => {
      const { ExecutionError } = await import("../execution/contracts/execution-error")
      throw new ExecutionError("EXECUTION_UNAVAILABLE", "downstream timeout")
    }
    const { task } = await t.submit("fixtures.conditionalWrite", { value: "a" })
    await t.drain()
    expect(t.taskByRef(task.taskRef)!).toMatchObject({ status: "FAILED", errorCode: "EXECUTION_FAILED" })
    expect(t.calls.count).toBe(1)
  })
})

describe("Phase 11 E — telemetry failures never change the operation", () => {
  it("a throwing span observer, metrics exporter or tracer leaves the result intact and runs the operation once", async () => {
    const remove = k.tracing.addSpanObserver(() => {
      throw new Error("observer bug")
    })
    expect((await k.agentExecute("fixtures.createThing", { name: "observed" })).output).toMatchObject({ name: "observed" })
    expect(k.dispatchesOf("fixtures.createThing")).toHaveLength(1)
    k.dispatches.length = 0
    const { trace } = await import("@opentelemetry/api")
    const broken = {
      getTracer: () => ({
        startActiveSpan: () => {
          throw new Error("tracer bug")
        },
        startSpan: () => {
          throw new Error("tracer bug")
        },
      }),
    }
    trace.setGlobalTracerProvider(broken as never)
    try {
      const result = await k.agentExecute("fixtures.createThing", { name: "alpha" })
      expect(result.output).toMatchObject({ name: "alpha" })
      expect(k.dispatchesOf("fixtures.createThing")).toHaveLength(1)
      // Labels from hostile input never throw either.
      expect(() => k.metrics.countMetric("agent_execution_total", { capability: { toString: () => { throw new Error("x") } } as never })).not.toThrow()
    } finally {
      trace.disable()
      remove()
    }
  })

  it("a tracer that throws AFTER running the operation still returns the operation's own result (no double execution)", async () => {
    const { trace } = await import("@opentelemetry/api")
    const lateFailure = {
      getTracer: () => ({
        startActiveSpan: async (_name: string, _opts: unknown, fn: (span: unknown) => Promise<unknown>) => {
          await fn({ setStatus() {}, setAttribute() {}, end() {} })
          throw new Error("export failed after the span")
        },
        startSpan: () => ({ end() {} }),
      }),
    }
    trace.setGlobalTracerProvider(lateFailure as never)
    try {
      const result = await k.agentExecute("fixtures.createThing", { name: "once" })
      expect(result.output).toMatchObject({ name: "once" })
      expect(k.dispatchesOf("fixtures.createThing")).toHaveLength(1)
    } finally {
      trace.disable()
    }
  })
})

describe("Phase 11 E — circuit breakers", () => {
  async function scripted(config = { failureThreshold: 3, windowMs: 10_000, cooldownMs: 5_000, halfOpenProbes: 1 }) {
    const clock = { now: 1_000_000 }
    const registry = new k.breakers.CircuitBreakerRegistry(config, () => clock.now, { CONNECTION: { failureThreshold: 6 } })
    k.breakers.__setCircuitBreakersForTests(registry)
    return { registry, clock }
  }

  it("opens after repeated infrastructure failures, refuses without dispatching, half-opens after the cooldown and closes on a successful probe", async () => {
    const { registry, clock } = await scripted()
    const { id } = (await k.agentExecute("fixtures.createThing", { name: "alpha" })).output as { id: string }
    k.state.failAdapter["fixtures.readThing"] = "INTERNAL_ERROR"
    for (let i = 0; i < 3; i += 1) expect(await k.catchCode(k.agentExecute("fixtures.readThing", { thingId: id }))).toBe("INTERNAL_ERROR")
    expect(k.dispatchesOf("fixtures.readThing")).toHaveLength(3)
    expect(registry.snapshot()).toEqual(expect.arrayContaining([expect.objectContaining({ scope: "CAPABILITY", key: "fixtures.readThing", state: "OPEN" })]))

    // Open: refused before dispatch, with the stable code.
    expect(await k.catchCode(k.agentExecute("fixtures.readThing", { thingId: id }))).toBe("EXECUTION_UNAVAILABLE")
    expect(k.dispatchesOf("fixtures.readThing")).toHaveLength(3)

    // Narrow scope: the same connection's other capabilities keep working.
    await k.agentExecute("fixtures.createThing", { name: "beta" })

    // Cooldown elapsed and the dependency recovered: one probe closes it.
    clock.now += 5_001
    k.state.failAdapter["fixtures.readThing"] = undefined
    expect((await k.agentExecute("fixtures.readThing", { thingId: id })).output).toMatchObject({ id })
    expect(registry.snapshot().find((s) => s.key === "fixtures.readThing")).toBeUndefined()

    await k.flush()
    const transitions = k.events().filter((e) => e.category === "FAILURE" && (e.metadata as Record<string, unknown>)?.breakerKey === "fixtures.readThing").map((e) => e.action)
    expect(transitions).toEqual(expect.arrayContaining(["failure.circuit_opened", "failure.circuit_rejected", "failure.circuit_half_open", "failure.circuit_closed"]))
    expect(k.metrics.counterTotal("agent_circuit_transition_total", { scope: "CAPABILITY", state: "OPEN" })).toBeGreaterThanOrEqual(1)
  })

  it("a failed half-open probe re-opens the breaker; concurrent calls during the probe are refused", async () => {
    const { registry, clock } = await scripted()
    const { id } = (await k.agentExecute("fixtures.createThing", { name: "alpha" })).output as { id: string }
    k.state.failAdapter["fixtures.readThing"] = "TIMEOUT"
    for (let i = 0; i < 3; i += 1) await k.catchCode(k.agentExecute("fixtures.readThing", { thingId: id }))
    clock.now += 5_001
    expect(registry.check("CAPABILITY", "fixtures.readThing")).toMatchObject({ allowed: true, probe: true })
    expect(registry.check("CAPABILITY", "fixtures.readThing")).toMatchObject({ allowed: false })
    registry.recordFailure("CAPABILITY", "fixtures.readThing")
    expect(registry.snapshot().find((s) => s.key === "fixtures.readThing")?.state).toBe("OPEN")
    expect(await k.catchCode(k.agentExecute("fixtures.readThing", { thingId: id }))).toBe("EXECUTION_UNAVAILABLE")
  })

  it("caller errors (not found, invalid input, denials) never count toward a breaker", async () => {
    const { registry } = await scripted()
    for (let i = 0; i < 10; i += 1) expect(await k.catchCode(k.agentExecute("fixtures.readThing", { thingId: `missing_${i}` }))).toBe("RESOURCE_NOT_FOUND")
    for (let i = 0; i < 5; i += 1) expect(await k.catchCode(k.resolver.execute("fixtures.readThing", { thingId: 42 }, k.gatewayCtx()))).toBe("INVALID_INPUT")
    expect(registry.snapshot()).toEqual([])
  })

  it("the connection breaker needs failures across capabilities; other connections are unaffected", async () => {
    const { registry } = await scripted()
    const { id } = (await k.agentExecute("fixtures.createThing", { name: "alpha" })).output as { id: string }
    k.state.failAdapter["fixtures.readThing"] = "INTERNAL_ERROR"
    k.state.failAdapter["fixtures.noSpecWrite"] = "INTERNAL_ERROR"
    for (let i = 0; i < 3; i += 1) await k.catchCode(k.agentExecute("fixtures.readThing", { thingId: id }))
    // readThing is open; its refusals do not feed the connection counter.
    for (let i = 0; i < 5; i += 1) expect(await k.catchCode(k.agentExecute("fixtures.readThing", { thingId: id }))).toBe("EXECUTION_UNAVAILABLE")
    expect(registry.snapshot().find((s) => s.scope === "CONNECTION")?.state ?? "CLOSED").toBe("CLOSED")
    for (let i = 0; i < 3; i += 1) await k.catchCode(k.agentExecute("fixtures.noSpecWrite", { thingId: "t" }))
    expect(registry.snapshot().find((s) => s.scope === "CONNECTION" && s.key === "conn_1")?.state).toBe("OPEN")
    // Every capability of conn_1 is now refused...
    expect(await k.catchCode(k.agentExecute("fixtures.createThing", { name: "gamma" }))).toBe("EXECUTION_UNAVAILABLE")
    // ...while another connection is not affected.
    const other = k.gatewayCtx({ connectionId: "conn_2", ownerId: "owner_2", agentId: "agent_2" })
    k.state.policy = { ...k.state.policy!, connectionId: "conn_2" }
    await k.agentExecute("fixtures.createThing", { name: "delta" }, { ctx: other })
    expect(Array.from(k.things.values()).map((t) => t.name)).toContain("delta")
  })

  it("the default configuration keeps the connection threshold well above the capability threshold", () => {
    const registry = new k.breakers.CircuitBreakerRegistry()
    expect(registry.configFor("CONNECTION").failureThreshold).toBeGreaterThan(registry.configFor("CAPABILITY").failureThreshold * 2)
    expect(k.breakers.isBreakerFailure("RESOURCE_NOT_FOUND")).toBe(false)
    expect(k.breakers.isBreakerFailure("FORBIDDEN")).toBe(false)
    expect(k.breakers.isBreakerFailure("TIMEOUT")).toBe(true)
  })
})

describe("Phase 11 E — metrics never become an exfiltration or cardinality channel", () => {
  it("unknown capability ids, free text and ids collapse to bounded label values", () => {
    k.metrics.__resetAgentMetricsForTests()
    for (let i = 0; i < 500; i += 1) {
      k.metrics.countMetric("agent_execution_total", { capability: `evil.cap${i}`, outcome: `owner_${i}`, risk_tier: "READ" })
      k.metrics.countMetric("agent_task_failed_total", { capability: "fixtures.createThing", reason: `user ${i}@example.com` })
    }
    const snap = k.metrics.getAgentMetricsSnapshot()
    expect(Object.keys(snap.counters.agent_execution_total)).toEqual(["capability=other,outcome=other,risk_tier=READ"])
    expect(Object.keys(snap.counters.agent_task_failed_total)).toEqual(["capability=fixtures.createThing,reason=other"])
    expect(JSON.stringify(snap)).not.toMatch(/example\.com|owner_\d|evil\.cap/)
    k.metrics.observeMetric("agent_execution_duration_ms", Number.NaN, { capability: "fixtures.createThing", outcome: "SUCCESS" })
    k.metrics.observeMetric("agent_execution_duration_ms", -5, { capability: "fixtures.createThing", outcome: "SUCCESS" })
    expect(k.metrics.getAgentMetricsSnapshot().histograms.agent_execution_duration_ms).toBeUndefined()
  })

  it("real executions produce labelled counters and duration histograms", async () => {
    k.metrics.__resetAgentMetricsForTests()
    await k.agentExecute("fixtures.createThing", { name: "alpha" })
    await k.catchCode(k.agentExecute("fixtures.readThing", { thingId: "missing" }))
    expect(k.metrics.counterTotal("agent_execution_total", { capability: "fixtures.createThing", outcome: "SUCCESS", risk_tier: "LOW_RISK_WRITE" })).toBe(1)
    expect(k.metrics.counterTotal("agent_execution_total", { capability: "fixtures.readThing", outcome: "FAILURE" })).toBe(1)
    expect(k.metrics.counterTotal("agent_authorization_total", { decision: "ALLOWED" })).toBe(2)
    const hist = k.metrics.getAgentMetricsSnapshot().histograms.agent_execution_duration_ms
    expect(hist["capability=fixtures.createThing,outcome=SUCCESS"].count).toBe(1)
    expect(hist["capability=fixtures.createThing,outcome=SUCCESS"].buckets).toHaveLength(k.metrics.DURATION_BUCKETS_MS.length + 1)
  })
})

describe("Phase 11 E — evidence is never written for a mutation that was not attempted", () => {
  it("an unknown capability, invalid input or missing idempotency key records no execution.started intent", async () => {
    await k.catchCode(k.resolver.execute("fixtures.nope", {}, k.gatewayCtx()))
    await k.catchCode(k.resolver.execute("fixtures.createThing", { name: 5 }, k.gatewayCtx()))
    await k.catchCode(k.resolver.execute("fixtures.archiveThing", { thingId: "t" }, k.gatewayCtx()))
    await k.flush()
    expect(k.eventsFor("execution.started")).toHaveLength(0)
    expect(k.dispatches).toHaveLength(0)
  })
})
