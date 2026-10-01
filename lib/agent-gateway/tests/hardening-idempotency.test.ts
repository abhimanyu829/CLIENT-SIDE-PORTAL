/**
 * Known-issue fix after Phase 15 — synchronous-path duplicate protection.
 *
 * The idempotency cache is the ONLY duplicate protection a synchronous keyed
 * write has, so on that path (STRICT) it now:
 *   - refuses the write when the store errors, or is absent in production;
 *   - reserves the key atomically (SET NX) before the write runs, so two
 *     concurrent identical calls can never both execute;
 *   - releases the reservation only when the write provably took no effect.
 * The task worker and recovery (BEST_EFFORT) keep their behaviour: they have
 * a durable dedupe of their own and must keep working through an outage.
 *
 * A: the guard itself.  B: the real resolver with a scripted adapter.
 * C: the real MCP chain and task engine (governance kit) with a fake Redis.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AgentGatewayRequestContext } from "../shared/types"
import { createApprovalFakeDb } from "./approval-fake-db"
import { createExecutionFakeDb } from "./execution-fake-db"
import { createFakeRedis } from "./fake-redis"
import { SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"
import { IDEMPOTENCY_META_KEY } from "../mcp/request-meta"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const RESULT = { output: { ok: true }, executionMode: "SYNC" as const, durationMs: 1 }
const TICKET = { subject: "Invoice missing", description: "The October invoice is not in my dashboard." }

function keyedWrite(): CapabilityDefinition {
  return {
    id: "test.write",
    version: 1,
    domain: "test",
    name: "n",
    description: "d",
    status: "ACTIVE",
    operationType: "LOW_RISK_WRITE",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({}).strict(),
    errorContract: [],
    requiredIdentityContext: [],
    resource: { resourceType: "Test" },
    permission: { permission: null },
    sideEffects: { effects: [] },
    idempotency: { requiresIdempotencyKey: true, retrySafe: false, duplicateBehavior: "x", class: "NON_IDEMPOTENT" },
    async: { executionMode: "SYNC" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "x" },
    executionReference: { adapterKey: "test.writeAdapter" },
  }
}

async function loadGuard(redis: unknown) {
  vi.resetModules()
  vi.doMock("@/lib/redis", () => ({ redis }))
  return import("../execution/idempotency/idempotency-guard")
}

const isLock = (key: string) => key.includes(":idem-lock:")

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("A — the guard", () => {
  beforeEach(() => vi.resetModules())
  const def = keyedWrite()

  it("STRICT reserves the key atomically: a concurrent duplicate is IN_FLIGHT, and once the result is recorded it is a REPLAY", async () => {
    const fake = createFakeRedis()
    const g = await loadGuard(fake.redis)
    expect(await g.checkIdempotency(def, "conn_1", "key-0001")).toEqual({ kind: "NEW_KEY", reserved: true })
    expect(fake.redis.set).toHaveBeenCalledWith(expect.stringContaining(":idem-lock:test.write:conn_1:key-0001"), "1", { nx: true, ex: 600 })
    expect(await g.checkIdempotency(def, "conn_1", "key-0001")).toEqual({ kind: "IN_FLIGHT" })

    await g.recordIdempotencyResult(def, "conn_1", "key-0001", RESULT, { reserved: true })
    expect(fake.keys().filter(isLock)).toEqual([])
    expect(await g.checkIdempotency(def, "conn_1", "key-0001")).toEqual({ kind: "REPLAY", result: RESULT })
    // The same key on another connection is an unrelated operation.
    expect(await g.checkIdempotency(def, "conn_2", "key-0001")).toEqual({ kind: "NEW_KEY", reserved: true })
  })

  it("STRICT fails closed on every store error: the lookup, the reservation and the re-check", async () => {
    const fake = createFakeRedis()
    const g = await loadGuard(fake.redis)
    fake.outage.failWhen = (op) => op === "get"
    expect((await g.checkIdempotency(def, "c", "k-get")).kind).toBe("UNAVAILABLE")
    fake.outage.failWhen = (op) => op === "set"
    expect((await g.checkIdempotency(def, "c", "k-set")).kind).toBe("UNAVAILABLE")

    fake.outage.failWhen = null
    await g.checkIdempotency(def, "c", "k-recheck") // reserved by someone
    let gets = 0
    fake.outage.failWhen = (op) => op === "get" && ++gets === 2 // the lookup works, the re-check fails
    expect((await g.checkIdempotency(def, "c", "k-recheck")).kind).toBe("UNAVAILABLE")
  })

  it("without Redis: STRICT is refused in production and best-effort elsewhere; BEST_EFFORT always proceeds", async () => {
    let g = await loadGuard(null)
    vi.stubEnv("NODE_ENV", "production")
    expect(await g.checkIdempotency(def, "c", "k")).toEqual({ kind: "UNAVAILABLE" })
    expect(await g.checkIdempotency(def, "c", "k", "BEST_EFFORT")).toEqual({ kind: "NEW_KEY", reserved: false })
    vi.stubEnv("NODE_ENV", "development")
    expect(await g.checkIdempotency(def, "c", "k")).toEqual({ kind: "NEW_KEY", reserved: false })

    // A gateway configured for production counts too, whatever NODE_ENV says.
    vi.stubEnv("AGENT_GATEWAY_ENVIRONMENT", "production")
    g = await loadGuard(null) // fresh (unmemoized) gateway config
    expect(await g.checkIdempotency(def, "c", "k")).toEqual({ kind: "UNAVAILABLE" })
  })

  it("BEST_EFFORT never reserves, still replays, and fails open (the task worker and recovery are unchanged)", async () => {
    const fake = createFakeRedis()
    const g = await loadGuard(fake.redis)
    expect(await g.checkIdempotency(def, "c", "k", "BEST_EFFORT")).toEqual({ kind: "NEW_KEY", reserved: false })
    expect(fake.redis.set).not.toHaveBeenCalled()
    await g.recordIdempotencyResult(def, "c", "k", RESULT)
    expect(await g.checkIdempotency(def, "c", "k", "BEST_EFFORT")).toEqual({ kind: "REPLAY", result: RESULT })
    fake.outage.failWhen = () => true
    expect(await g.checkIdempotency(def, "c", "k2", "BEST_EFFORT")).toEqual({ kind: "NEW_KEY", reserved: false })
  })

  it("a result that cannot be recorded KEEPS the reservation, so a retry is IN_FLIGHT instead of a duplicate", async () => {
    const fake = createFakeRedis()
    const g = await loadGuard(fake.redis)
    await g.checkIdempotency(def, "c", "k")
    fake.outage.failWhen = (op, key) => op === "set" && key.includes(":idem:")
    await expect(g.recordIdempotencyResult(def, "c", "k", RESULT, { reserved: true })).resolves.toBeUndefined()
    fake.outage.failWhen = null
    expect(fake.redis.del).not.toHaveBeenCalled()
    expect(await g.checkIdempotency(def, "c", "k")).toEqual({ kind: "IN_FLIGHT" })
  })

  it("releasing frees the key for a retry and never throws", async () => {
    const fake = createFakeRedis()
    const g = await loadGuard(fake.redis)
    await g.checkIdempotency(def, "c", "k")
    await g.releaseIdempotencyReservation(def, "c", "k")
    expect(await g.checkIdempotency(def, "c", "k")).toEqual({ kind: "NEW_KEY", reserved: true })
    fake.outage.failWhen = (op) => op === "del"
    await expect(g.releaseIdempotencyReservation(def, "c", "k")).resolves.toBeUndefined()
  })

  it("an abandoned reservation (crashed process) blocks the key only until its 10-minute expiry", async () => {
    let now = 0
    const fake = createFakeRedis(() => now)
    const g = await loadGuard(fake.redis)
    await g.checkIdempotency(def, "c", "k")
    now = 599_000
    expect(await g.checkIdempotency(def, "c", "k")).toEqual({ kind: "IN_FLIGHT" })
    now = 600_000
    expect(await g.checkIdempotency(def, "c", "k")).toEqual({ kind: "NEW_KEY", reserved: true })
  })
})

// ── B: the real resolver, with a scripted tickets.create adapter ─────────────

function gatewayCtx(): AgentGatewayRequestContext {
  return {
    requestId: `req_${Math.random().toString(16).slice(2)}`,
    receivedAt: new Date(),
    authenticated: true,
    machine: { connectionId: "conn_1", credentialId: "cred_1", ownerId: "owner_1", connectionStatus: "ACTIVE", authenticatedAt: new Date() },
    protocol: "MCP",
    signal: new AbortController().signal,
  }
}

async function setupResolver(redis: unknown) {
  vi.resetModules()
  const approval = createApprovalFakeDb()
  const exec = createExecutionFakeDb()
  const db = { ...exec.client, ...approval.client }
  vi.doMock("@/lib/db", () => ({ db }))
  vi.doMock("@/lib/redis", () => ({ redis }))
  vi.doMock("../identity/connection-service", () => ({
    getAgentConnectionService: () => ({ getById: vi.fn(async (id: string) => ({ id, environment: "development" })) }),
  }))
  const { CapabilityRegistry } = await import("../capabilities/registry")
  const { registerCoreCapabilities } = await import("../capabilities/manifest")
  const { AdapterRegistry } = await import("../execution/resolver/adapter-registry")
  const { AdapterResolver } = await import("../execution/resolver/adapter-resolver")
  const { ExecutionError } = await import("../execution/contracts/execution-error")

  const capabilities = new CapabilityRegistry()
  registerCoreCapabilities(capabilities)
  const behaviour: { next: (() => Promise<void>) | null } = { next: null }
  let created = 0
  const execute = vi.fn(async () => {
    const step = behaviour.next
    behaviour.next = null
    if (step) await step()
    created += 1
    return {
      output: { id: `tk_${created}`, subject: TICKET.subject, status: "OPEN", priority: "MEDIUM", category: "GENERAL", createdAt: new Date(0).toISOString() },
      executionMode: "SYNC" as const,
      durationMs: 1,
    }
  })
  const adapters = new AdapterRegistry()
  adapters.register({ capabilityId: "tickets.create", capabilityVersion: 1, execute })
  const resolver = new AdapterResolver(capabilities, adapters)

  async function run(key: string, options?: { idempotency?: "STRICT" | "BEST_EFFORT" }) {
    try {
      const result = await resolver.execute("tickets.create", TICKET, gatewayCtx(), key, options)
      return { ok: true as const, output: result.output as Record<string, unknown> }
    } catch (err) {
      const e = err as InstanceType<typeof ExecutionError>
      return { ok: false as const, code: e.code, message: e.message, details: e.details }
    }
  }
  return { run, execute, behaviour, ExecutionError, approval }
}

describe("B — the resolver (sync path is STRICT by default)", () => {
  beforeEach(() => vi.resetModules())

  it("a concurrent duplicate is refused with IDEMPOTENCY_CONFLICT while the first runs; later retries replay its result", async () => {
    const fake = createFakeRedis()
    const t = await setupResolver(fake.redis)
    let release!: () => void
    t.behaviour.next = () => new Promise<void>((resolve) => (release = resolve))
    const first = t.run("dup-key-0001")
    await vi.waitFor(() => expect(t.execute).toHaveBeenCalledTimes(1))

    const second = await t.run("dup-key-0001")
    expect(second).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" })

    release()
    const done = await first
    expect(done.ok).toBe(true)
    const replay = await t.run("dup-key-0001")
    expect(replay).toEqual(done)
    expect(t.execute).toHaveBeenCalledTimes(1)
  })

  it("a definitive refusal by the adapter (no effect) releases the key", async () => {
    const fake = createFakeRedis()
    const t = await setupResolver(fake.redis)
    t.behaviour.next = async () => {
      throw new t.ExecutionError("RESOURCE_NOT_FOUND", "gone")
    }
    expect(await t.run("key-0002")).toMatchObject({ ok: false, code: "RESOURCE_NOT_FOUND" })
    expect(fake.keys().filter(isLock)).toEqual([])
    expect(await t.run("key-0002")).toMatchObject({ ok: true })
    expect(t.execute).toHaveBeenCalledTimes(2)
  })

  it("an ambiguous failure after dispatch keeps the key blocked, so a blind retry cannot run it twice", async () => {
    const fake = createFakeRedis()
    const t = await setupResolver(fake.redis)
    t.behaviour.next = async () => {
      throw new Error("connection reset")
    }
    expect(await t.run("key-0003")).toMatchObject({ ok: false, code: "INTERNAL_ERROR" })
    const retry = await t.run("key-0003")
    expect(retry).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" })
    expect(retry.ok === false && retry.message).toMatch(/check whether the operation took effect/)
    expect(t.execute).toHaveBeenCalledTimes(1)
    // A new key is, by definition, a new operation.
    expect(await t.run("key-0004")).toMatchObject({ ok: true })
  })

  it("a store outage refuses the write BEFORE dispatch (EXECUTION_UNAVAILABLE, dispatched: false); BEST_EFFORT callers still execute", async () => {
    const fake = createFakeRedis()
    const t = await setupResolver(fake.redis)
    fake.outage.failWhen = (_op, key) => key.startsWith("agent-gateway:idem")
    const refused = await t.run("key-0005")
    expect(refused).toMatchObject({ ok: false, code: "EXECUTION_UNAVAILABLE", details: { dispatched: false } })
    expect(refused.ok === false && refused.message).toMatch(/Duplicate protection/)
    expect(t.execute).not.toHaveBeenCalled()

    expect(await t.run("key-0005", { idempotency: "BEST_EFFORT" })).toMatchObject({ ok: true })
    expect(t.execute).toHaveBeenCalledTimes(1)
  })

  it("a refusal between the reservation and dispatch (audit ledger down) releases the key", async () => {
    const fake = createFakeRedis()
    const t = await setupResolver(fake.redis)
    const spy = vi.spyOn(t.approval.client.agentAuditEvent, "create").mockRejectedValue(new Error("ledger down"))
    expect(await t.run("key-0006")).toMatchObject({ ok: false, code: "EXECUTION_UNAVAILABLE" })
    expect(t.execute).not.toHaveBeenCalled()
    expect(fake.keys().filter(isLock)).toEqual([])
    spy.mockRestore()
    expect(await t.run("key-0006")).toMatchObject({ ok: true })
  })
})

// ── C: the real MCP chain and task engine ────────────────────────────────────

async function allowWrites(k: GovernanceKit) {
  for (const capabilityId of ["tickets.create", "tickets.close"]) {
    await k.policyStore.createPolicyVersion({ name: `allow ${capabilityId}`, effect: "ALLOW", scope: "CAPABILITY", capabilityId, riskConstraint: "LOW_RISK_WRITE", actorId: SUPER })
  }
  await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE", actorId: SUPER })
}

async function callWithKey(k: GovernanceKit, args: Record<string, unknown>, key: string) {
  const out = await k.mcp("tools/call", { name: "tickets.create", arguments: args, _meta: { [IDEMPOTENCY_META_KEY]: key } })
  const text: string = out.result?.content?.[0]?.text ?? ""
  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { text, json, isError: out.result?.isError === true }
}

describe("C — end to end (MCP tools/call and agent_task_submit)", () => {
  it("two concurrent identical sync creates produce exactly one ticket", async () => {
    const fake = createFakeRedis()
    const k = await buildGovernanceKit({ redis: fake.redis })
    await allowWrites(k)
    const create = k.exec.client.ticket.create
    const original = create.getMockImplementation()!
    let release!: () => void
    create.mockImplementationOnce(async (args) => {
      await new Promise<void>((resolve) => (release = resolve))
      return original(args)
    })

    const first = callWithKey(k, TICKET, "e2e-dup-0001")
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    const second = await callWithKey(k, TICKET, "e2e-dup-0001")
    expect(second.text).toMatch(/^IDEMPOTENCY_CONFLICT:/)

    release()
    const one = await first
    expect(one.isError).toBe(false)
    const replay = await callWithKey(k, TICKET, "e2e-dup-0001")
    expect(replay.json?.id).toBe(one.json?.id)
    expect(k.exec._tickets.size).toBe(1)
  })

  it("during a Redis outage the sync write is refused before anything runs, and the task path still executes it exactly once", async () => {
    const fake = createFakeRedis()
    const k = await buildGovernanceKit({ redis: fake.redis })
    await allowWrites(k)
    fake.outage.failWhen = (_op, key) => key.startsWith("agent-gateway:idem")

    const sync = await callWithKey(k, TICKET, "e2e-outage-0001")
    expect(sync.text).toMatch(/^EXECUTION_UNAVAILABLE:/)
    expect(k.exec._tickets.size).toBe(0)

    const submitted = await k.tool("agent_task_submit", { capabilityId: "tickets.create", input: TICKET, idempotencyKey: "e2e-outage-task-0001" })
    expect(submitted.isError).toBe(false)
    await k.drain()
    expect(k.taskRow(submitted.json.taskRef)?.status).toBe("SUCCEEDED")
    expect(k.exec._tickets.size).toBe(1)
  })
})
