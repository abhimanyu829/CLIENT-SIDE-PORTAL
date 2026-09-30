/**
 * Phase 8 — Section B: REAL BullMQ integration (opt-in; see
 * vitest.integration.config.ts). Real Queue + real Worker on a local
 * Redis-compatible server (Memurai), driving the real task engine, the real
 * worker processor and the real Phase 4 adapters. Postgres is the in-memory
 * fake (no isolated test database exists in this environment).
 *
 * Safety: loopback URL only (never .env REDIS_URL), unique key prefix per
 * run, everything under the prefix is deleted afterwards.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Queue, Worker } from "bullmq"
import IORedis from "ioredis"
import { buildTaskKit, gatewayCtx } from "./task-test-kit"

const REDIS_URL = process.env.AGENT_GATEWAY_IT_REDIS_URL ?? "redis://127.0.0.1:6379"
const host = new URL(REDIS_URL).hostname
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error(`Refusing to run the BullMQ integration suite against a non-loopback host (${host}).`)
}
const PREFIX = `agtest-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const connection = { url: REDIS_URL, maxRetriesPerRequest: null as null }
const opened: Array<{ close: () => Promise<unknown> }> = []

async function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("waitFor timed out")
    await new Promise((r) => setTimeout(r, 50))
  }
}

async function wire(options: { executionTimeoutMs?: number; queueName: string; lockDurationMs?: number }) {
  const k = await buildTaskKit({ withExecutionDb: true, config: { executionTimeoutMs: options.executionTimeoutMs ?? 5_000 } })
  const { BullTaskQueue } = await import("../tasks/queue")
  const { AgentTaskService } = await import("../tasks/engine")
  const { AgentTaskWorker } = await import("../tasks/worker")
  const queue = new Queue(options.queueName, { connection, prefix: PREFIX })
  opened.push(queue)
  const port = new BullTaskQueue(queue, () => true, 3_000)
  const service = new AgentTaskService({ capabilityRegistry: k.registry, adapterRegistry: k.adapters, gate: k.gate, queue: port, config: k.config, clock: () => new Date() })
  const processor = new AgentTaskWorker({ capabilityRegistry: k.registry, adapterRegistry: k.adapters, gate: k.gate, queue: port, config: k.config, clock: () => new Date(), environment: "development" })
  const startWorker = () => {
    const w = new Worker(options.queueName, (job) => processor.process({ name: job.name, data: job.data, id: job.id }), {
      connection,
      prefix: PREFIX,
      concurrency: 2,
      lockDuration: options.lockDurationMs ?? 30_000,
      stalledInterval: Math.max(250, Math.floor((options.lockDurationMs ?? 30_000) / 2)),
    })
    opened.push(w)
    return w
  }
  k.state.now = new Date()
  return { k, queue, port, service, startWorker, submit: (capabilityId: string, input: Record<string, unknown>) => service.submit(gatewayCtx(), "development", { capabilityId, input }) }
}

beforeAll(async () => {
  const probe = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2_000, lazyConnect: true, retryStrategy: () => null })
  try {
    await probe.connect()
    await probe.ping()
  } catch {
    throw new Error(`ENVIRONMENTAL: no Redis-compatible server reachable at ${REDIS_URL} (start Memurai to run this suite).`)
  } finally {
    probe.disconnect()
  }
})

afterAll(async () => {
  for (const c of opened.reverse()) await c.close().catch(() => undefined)
  const cleaner = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1 })
  let cursor = "0"
  do {
    const [next, keys] = await cleaner.scan(cursor, "MATCH", `${PREFIX}:*`, "COUNT", 500)
    if (keys.length) await cleaner.del(...keys)
    cursor = next
  } while (cursor !== "0")
  const left = await cleaner.keys(`${PREFIX}:*`)
  cleaner.disconnect()
  expect(left).toEqual([])
})

describe("B — real BullMQ / worker integration (Memurai)", () => {
  it("task -> BullMQ job -> worker -> Phase 4 adapter -> existing data -> SUCCEEDED", async () => {
    const t = await wire({ queueName: "agent-task-it-1" })
    t.k.execFake!.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    t.startWorker()
    const { task } = await t.submit("products.get", { id: "p1" })
    await waitFor(() => t.k.taskByRef(task.taskRef)?.status === "SUCCEEDED")
    expect(t.k.taskByRef(task.taskRef)!.result).toEqual({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const row = t.k.taskByRef(task.taskRef)!
    const job = await t.queue.getJob(`${row.id}-a1`)
    expect(job?.data).toMatchObject({ taskId: row.id, attempt: 1 })
    expect(JSON.stringify(job?.data)).not.toContain("p1")
  })

  it("the same attempt enqueued twice is one BullMQ job (deterministic job id)", async () => {
    const t = await wire({ queueName: "agent-task-it-2" })
    const { task } = await t.submit("products.get", { id: "p1" })
    const row = t.k.taskByRef(task.taskRef)!
    const { payloadFor } = await import("../tasks/lifecycle")
    await t.port.enqueue(payloadFor(row as never, 1), { jobId: `${row.id}-a1` })
    const counts = await t.queue.getJobCounts("waiting", "delayed", "active")
    expect(counts.waiting + counts.delayed + counts.active).toBe(1)
  })

  it("retry uses a real delayed job with backoff and then succeeds", async () => {
    const t = await wire({ queueName: "agent-task-it-3" })
    const { ExecutionError } = await import("../execution/contracts/execution-error")
    let n = 0
    t.k.behaviour.run = async () => {
      n += 1
      if (n === 1) throw new ExecutionError("EXECUTION_UNAVAILABLE", "transient")
      return { ok: true }
    }
    t.startWorker()
    const started = Date.now()
    const { task } = await t.submit("fixtures.cooperativeRead", { value: "a" })
    await waitFor(() => t.k.taskByRef(task.taskRef)?.status === "SUCCEEDED")
    expect(t.k.taskByRef(task.taskRef)!.attempts).toBe(2)
    expect(Date.now() - started).toBeGreaterThanOrEqual(900)
  })

  it("jobs survive a worker restart: queued while no worker runs, processed once a worker starts", async () => {
    const t = await wire({ queueName: "agent-task-it-4" })
    const { task } = await t.submit("fixtures.conditionalWrite", { value: "a" })
    await new Promise((r) => setTimeout(r, 300))
    expect(t.k.taskByRef(task.taskRef)!.status).toBe("QUEUED")
    t.startWorker()
    await waitFor(() => t.k.taskByRef(task.taskRef)?.status === "SUCCEEDED")
    expect(t.k.calls.count).toBe(1)
  })

  it("worker crash mid-run: the stalled job is recovered; SAFE_RETRY re-runs, CONDITIONAL_RETRY is never executed twice", async () => {
    for (const [capabilityId, expected, calls] of [
      ["fixtures.cooperativeRead", "SUCCEEDED", 2],
      ["fixtures.conditionalWrite", "FAILED", 1],
    ] as const) {
      const t = await wire({ queueName: `agent-task-it-5-${capabilityId.split(".")[1]}`, executionTimeoutMs: 60_000, lockDurationMs: 1_000 })
      let n = 0
      t.k.behaviour.run = () => {
        n += 1
        return n === 1 ? new Promise(() => undefined) : Promise.resolve({ ok: true })
      }
      const crashing = t.startWorker()
      const { task } = await t.submit(capabilityId, { value: "a" })
      await waitFor(() => t.k.calls.count === 1)
      expect(t.k.taskByRef(task.taskRef)!.status).toBe("RUNNING")
      await crashing.close(true) // simulated crash: the active job's lock is never renewed
      t.startWorker()
      await waitFor(() => ["SUCCEEDED", "FAILED"].includes(String(t.k.taskByRef(task.taskRef)?.status)), 20_000)
      expect(t.k.taskByRef(task.taskRef)!.status).toBe(expected)
      expect(t.k.calls.count).toBe(calls)
      if (expected === "FAILED") expect(t.k.taskByRef(task.taskRef)).toMatchObject({ errorCode: "EXECUTION_FAILED", errorDetailCode: "WORKER_INTERRUPTED" })
    }
  })

  it("Redis unreachable: submission fails closed with QUEUE_UNAVAILABLE and the task is never reported QUEUED", async () => {
    const k = await buildTaskKit()
    const { BullTaskQueue } = await import("../tasks/queue")
    const { AgentTaskService } = await import("../tasks/engine")
    const dead = new Queue("agent-task-it-dead", {
      connection: { host: "127.0.0.1", port: 1, maxRetriesPerRequest: 1, enableOfflineQueue: false, retryStrategy: () => null },
      prefix: PREFIX,
    })
    dead.on("error", () => undefined)
    const port = new BullTaskQueue(dead, () => true, 1_000)
    const service = new AgentTaskService({ capabilityRegistry: k.registry, adapterRegistry: k.adapters, gate: k.gate, queue: port, config: k.config, clock: () => k.state.now })
    const err = await service.submit(gatewayCtx(), "development", { capabilityId: "products.get", input: { id: "p1" } }).catch((e) => e)
    expect(err.code).toBe("QUEUE_UNAVAILABLE")
    const [row] = Array.from(k.fake._tasks.values()) as Array<Record<string, unknown>>
    expect(row).toMatchObject({ status: "FAILED", errorCode: "QUEUE_UNAVAILABLE" })
    await dead.disconnect().catch(() => undefined)
    vi.restoreAllMocks()
  })
})
