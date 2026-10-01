/**
 * Phase 9 — REAL BullMQ integration for triggers (opt-in; see
 * vitest.integration.config.ts). One real Queue + one real Worker whose
 * processor routes exactly like lib/workers.ts: `agent-trigger.*` jobs to the
 * TriggerRuntime, everything else to the Phase 8 task processor.
 *
 * Safety: loopback URL only (never .env REDIS_URL), unique key prefix per
 * run, everything under the prefix is deleted afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Queue, Worker } from "bullmq"
import IORedis from "ioredis"
import { buildTriggerKit, EVENT_TRIGGER, productEvent, SCHEDULE_TRIGGER, TRIGGER_TEST_CONFIG } from "./trigger-test-kit"

const REDIS_URL = process.env.AGENT_GATEWAY_IT_REDIS_URL ?? "redis://127.0.0.1:6379"
const host = new URL(REDIS_URL).hostname
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error(`Refusing to run the BullMQ integration suite against a non-loopback host (${host}).`)
}
const PREFIX = `agtest9-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const connection = { url: REDIS_URL, maxRetriesPerRequest: null as null }
const opened: Array<{ close: () => Promise<unknown> }> = []

async function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("waitFor timed out")
    await new Promise((r) => setTimeout(r, 50))
  }
}

async function wire(queueName: string) {
  const k = await buildTriggerKit({ withExecutionDb: true })
  k.state.now = new Date()
  k.execFake!.seedProduct({ id: "prod_1", name: "Alpha", slug: "alpha", status: "AVAILABLE", type: "SAAS" })
  const { BullTaskQueue } = await import("../tasks/queue")
  const { AgentTaskService } = await import("../tasks/engine")
  const { AgentTaskWorker } = await import("../tasks/worker")
  const { TriggerRuntime } = await import("../triggers/runtime")
  const { AGENT_TASK_JOBS } = await import("@/lib/queue")
  const queue = new Queue(queueName, { connection, prefix: PREFIX })
  opened.push(queue)
  const port = new BullTaskQueue(queue, () => true, 3_000)
  const clock = () => new Date()
  const service = new AgentTaskService({ capabilityRegistry: k.registry, adapterRegistry: k.adapters, gate: k.gate, queue: port, config: k.config, clock })
  const processor = new AgentTaskWorker({ capabilityRegistry: k.registry, adapterRegistry: k.adapters, gate: k.gate, queue: port, config: k.config, clock, environment: "development" })
  const runtime = new TriggerRuntime({ taskService: service, capabilityRegistry: k.registry, config: TRIGGER_TEST_CONFIG, clock, environment: "development" })
  const worker = new Worker(
    queueName,
    (job) => (job.name.startsWith("agent-trigger.") ? runtime.process({ name: job.name, data: job.data, id: job.id }) : processor.process({ name: job.name, data: job.data, id: job.id })),
    { connection, prefix: PREFIX, concurrency: 2 }
  )
  opened.push(worker)
  /** The production intake enqueue, against this queue. */
  const enqueueEvent = (payload: unknown, jobId: string) =>
    queue.add(AGENT_TASK_JOBS.TRIGGER_EVENT, payload, { jobId, attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: { count: 200 }, removeOnFail: { count: 500 } })
  return { k, queue, runtime, enqueueEvent, AGENT_TASK_JOBS }
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

describe("Phase 9 — real BullMQ trigger integration (Memurai)", () => {
  it("event intake -> reference job -> worker -> trigger runtime -> task job -> Phase 4 adapter -> SUCCEEDED; a re-emitted event is one job", async () => {
    const t = await wire("agent-trigger-it-1")
    const { trigger } = await t.k.createActive(EVENT_TRIGGER)
    const deps = { enabled: () => true, enqueue: t.enqueueEvent }
    await t.k.notifyAgentEventTriggers(productEvent("prod_1"), deps)
    await t.k.notifyAgentEventTriggers(productEvent("prod_1"), deps) // exact re-emission
    await waitFor(() => t.k.tasksOf(trigger.triggerRef)[0]?.status === "SUCCEEDED")
    const counts = await t.queue.getJobCounts("completed", "waiting", "active", "delayed", "failed")
    expect(counts.failed).toBe(0)
    const eventJobs = (await t.queue.getJobs(["completed", "waiting", "active", "delayed"])).filter((j) => j.name === t.AGENT_TASK_JOBS.TRIGGER_EVENT)
    expect(eventJobs).toHaveLength(1)
    expect(JSON.stringify(eventJobs[0].data)).not.toContain("Secret Product Name")
    expect(t.k.tasksOf(trigger.triggerRef)).toHaveLength(1)
    expect(t.k.tasksOf(trigger.triggerRef)[0].result).toMatchObject({ id: "prod_1", name: "Alpha" })
  })

  it("a repeatable tick job (the existing repeatable-job mechanism) fires a due schedule once and keeps ticking", async () => {
    const t = await wire("agent-trigger-it-2")
    const { trigger } = await t.k.createActive({ ...SCHEDULE_TRIGGER, concurrency: "ALLOW_PARALLEL" })
    // Make the next occurrence due now (production ticks every minute; this test ticks every 400 ms).
    const row = t.k.fake._triggers.get(t.k.triggerRow(trigger.triggerRef).id)!
    row.nextRunAt = new Date(Date.now() - 1_000)
    await t.queue.add(t.AGENT_TASK_JOBS.TRIGGER_TICK, {}, { jobId: "agent-trigger-tick-it", repeat: { every: 400 } })
    await waitFor(() => t.k.tasksOf(trigger.triggerRef)[0]?.status === "SUCCEEDED")
    const ticksBefore = (await t.queue.getJobCounts("completed")).completed
    await new Promise((r) => setTimeout(r, 1_500))
    const ticksAfter = (await t.queue.getJobCounts("completed")).completed
    expect(ticksAfter).toBeGreaterThan(ticksBefore) // still ticking
    expect(t.k.tasksOf(trigger.triggerRef)).toHaveLength(1) // the occurrence fired once
    expect(t.k.triggerRow(trigger.triggerRef).nextRunAt.getTime()).toBeGreaterThan(Date.now())
    await t.queue.removeRepeatable(t.AGENT_TASK_JOBS.TRIGGER_TICK, { every: 400 }, "agent-trigger-tick-it").catch(() => undefined)
  })

  it("a signed webhook creates a task that the real worker executes", async () => {
    const t = await wire("agent-trigger-it-3")
    const { trigger, webhookSecret } = await t.k.createActive({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.get", bindResource: true })
    const deps = { ...t.k.webhookDeps, clock: () => new Date(), runtime: () => t.runtime }
    t.k.state.now = new Date()
    const res = await t.k.handleAgentWebhook(t.k.signedRequest(trigger.triggerRef, webhookSecret!, { resourceId: "prod_1" }), trigger.triggerRef, deps)
    expect(res.status).toBe(202)
    await waitFor(() => t.k.tasksOf(trigger.triggerRef)[0]?.status === "SUCCEEDED")
    expect(t.k.tasksOf(trigger.triggerRef)[0].result).toMatchObject({ id: "prod_1" })
  })
})
