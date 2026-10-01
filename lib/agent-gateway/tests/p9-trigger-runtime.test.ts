/**
 * Phase 9 — TriggerRuntime: event matching, dedup, concurrency modes,
 * re-authorization of every firing (Phase 6 / Phase 7), failure handling,
 * the schedule tick (missed runs, one-time, expiry, concurrent ticks) and
 * the event-bus intake hook.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildTriggerKit, EVENT_TRIGGER, productEvent, SCHEDULE_TRIGGER, WEBHOOK_TRIGGER } from "./trigger-test-kit"
import { DENY, policy } from "./p7-helpers"

type Kit = Awaited<ReturnType<typeof buildTriggerKit>>
let k: Kit

beforeEach(async () => {
  // With the Phase 4 execution fake, so tasks run to SUCCEEDED through the real adapters.
  k = await buildTriggerKit({ withExecutionDb: true })
})

const HOUR = 3_600_000

function normalized(productId: string, actorId = "owner_1", timestamp = "2026-10-02T10:00:00.000Z", type = "PRODUCT_UPDATED") {
  return k.normalizeTriggerEvent(productEvent(productId, actorId, timestamp, type))!
}

async function fireWebhook(ref: string, eventId: string) {
  const row = k.triggerRow(ref)
  return k.runtime.fire({ id: row.id }, { source: "WEBHOOK", deliveryKey: `webhook:${eventId}`, bodyDigest: "0".repeat(64) })
}

describe("Phase 9 B — event triggers", () => {
  it("a matching event creates exactly one authorized task with the bound resource", async () => {
    const { trigger } = await k.createActive(EVENT_TRIGGER)
    const results = await k.runtime.dispatchEvent(normalized("prod_1"))
    expect(results).toEqual([{ outcome: "TASK_CREATED", runRef: expect.stringMatching(/^trr_/) }])
    const [task] = k.tasksOf(trigger.triggerRef)
    expect(task).toMatchObject({ capabilityId: "products.get", capabilityVersion: 1, connectionId: "conn_1", ownerId: "owner_1", environment: "development", status: "QUEUED" })
    expect(task.input).toEqual({ id: "prod_1" })
    expect(task.idempotencyKey).toMatch(/^trigger\.[0-9a-f]{32}$/)
    expect(k.runsOf(trigger.triggerRef)[0]).toMatchObject({ status: "TASK_CREATED", taskId: task.id, resourceId: "prod_1", source: "EVENT" })
    expect(k.decide).toHaveBeenCalledTimes(1)
    expect(k.queue.enqueued).toHaveLength(1)
    // The job carries references only; the event payload never reaches the queue or the task.
    expect(JSON.stringify(k.queue.enqueued[0].payload)).not.toContain("Secret Product Name")
    expect(JSON.stringify(task)).not.toContain("Secret Product Name")
  })

  it("does not fire on a mismatch: resource filter, actor scope, environment, status", async () => {
    const filtered = await k.createActive({ ...EVENT_TRIGGER, name: "Only p9", event: { eventType: "PRODUCT_UPDATED", resourceId: "prod_9" } })
    await k.runtime.dispatchEvent(normalized("prod_1"))
    expect(k.runsOf(filtered.trigger.triggerRef)).toHaveLength(0)
    await k.runtime.dispatchEvent(normalized("prod_9", "someone_else"))
    expect(k.runsOf(filtered.trigger.triggerRef)).toHaveLength(0) // OWNER scope: the actor is not the owner
    await k.runtime.dispatchEvent(normalized("prod_9"))
    expect(k.runsOf(filtered.trigger.triggerRef)).toHaveLength(1)

    const paused = await k.createActive({ ...EVENT_TRIGGER, name: "Paused" })
    await k.triggers.transition(paused.trigger.triggerRef, paused.trigger.version, "pause", "admin_1")
    k.fake._triggers.get(k.triggerRow(filtered.trigger.triggerRef).id)!.environment = "production"
    await k.runtime.dispatchEvent(normalized("prod_9", "owner_1", "2026-10-02T10:05:00.000Z"))
    expect(k.runsOf(paused.trigger.triggerRef)).toHaveLength(0)
    expect(k.runsOf(filtered.trigger.triggerRef)).toHaveLength(1)
  })

  it("ANY-scoped product triggers fire for any actor; events about a user only fire that user's triggers", async () => {
    const any = await k.createActive({ ...EVENT_TRIGGER, event: { eventType: "PRODUCT_UPDATED", actorScope: "ANY" } })
    await k.runtime.dispatchEvent(normalized("prod_1", "vendor_7"))
    expect(k.runsOf(any.trigger.triggerRef)).toHaveLength(1)

    const sub = await k.createActive({ ...EVENT_TRIGGER, capabilityId: "subscriptions.get", event: { eventType: "SUBSCRIPTION_ACTIVATED" } })
    const other = k.normalizeTriggerEvent({ type: "SUBSCRIPTION_ACTIVATED", timestamp: "t1", actorId: "owner_1", payload: { subscriptionId: "sub_1", userId: "user_9" } } as never)!
    await k.runtime.dispatchEvent(other)
    expect(k.runsOf(sub.trigger.triggerRef)).toHaveLength(0) // about user_9, not the owner
    const mine = k.normalizeTriggerEvent({ type: "SUBSCRIPTION_ACTIVATED", timestamp: "t2", payload: { subscriptionId: "sub_1", userId: "owner_1" } } as never)!
    await k.runtime.dispatchEvent(mine)
    expect(k.runsOf(sub.trigger.triggerRef)).toMatchObject([{ status: "TASK_CREATED", resourceId: "sub_1" }])
  })

  it("the same event delivered twice is one run and one task", async () => {
    const { trigger } = await k.createActive({ ...EVENT_TRIGGER, concurrency: "ALLOW_PARALLEL" })
    const event = normalized("prod_1")
    const first = await k.runtime.dispatchEvent(event)
    const second = await k.runtime.dispatchEvent(event)
    expect(first[0].outcome).toBe("TASK_CREATED")
    expect(second[0]).toMatchObject({ outcome: "DUPLICATE", runRef: first[0].runRef })
    expect(k.runsOf(trigger.triggerRef)).toHaveLength(1)
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(1)
  })

  it("an event whose resource id cannot be bound is a CONDITION_ERROR, not a task", async () => {
    const { trigger } = await k.createActive(EVENT_TRIGGER)
    await k.runtime.dispatchEvent({ ...normalized("prod_1"), resourceId: null })
    expect(k.runsOf(trigger.triggerRef)).toMatchObject([{ status: "FAILED", errorCode: "CONDITION_ERROR" }])
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(0)
  })
})

describe("Phase 9 E — concurrency modes", () => {
  it("DROP_WHILE_RUNNING: a second firing while the task is live is dropped; after it finishes, the next one runs", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    expect((await fireWebhook(trigger.triggerRef, "e1")).outcome).toBe("TASK_CREATED")
    expect(await fireWebhook(trigger.triggerRef, "e2")).toMatchObject({ outcome: "DROPPED", errorCode: "CONCURRENCY_LIMIT" })
    await k.drainTasks()
    expect(k.tasksOf(trigger.triggerRef)[0].status).toBe("SUCCEEDED")
    expect((await fireWebhook(trigger.triggerRef, "e3")).outcome).toBe("TASK_CREATED")
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(2)
  })

  it("DROP_WHILE_RUNNING under a 10-way race: exactly one task", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => fireWebhook(trigger.triggerRef, `race-${i}`)))
    expect(results.filter((r) => r.outcome === "TASK_CREATED")).toHaveLength(1)
    expect(results.filter((r) => r.outcome === "DROPPED")).toHaveLength(9)
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(1)
  })

  it("QUEUE_ONE: one runs, one waits, the rest coalesce; the waiting run starts when the slot frees", async () => {
    const { trigger } = await k.createActive({ ...WEBHOOK_TRIGGER, concurrency: "QUEUE_ONE" })
    expect((await fireWebhook(trigger.triggerRef, "q1")).outcome).toBe("TASK_CREATED")
    expect((await fireWebhook(trigger.triggerRef, "q2")).outcome).toBe("PENDING")
    expect(await fireWebhook(trigger.triggerRef, "q3")).toMatchObject({ outcome: "DROPPED", errorCode: "COALESCED" })
    expect(await k.runtime.releasePending()).toBe(0) // first task still live
    await k.drainTasks()
    expect(await k.runtime.releasePending()).toBe(1)
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(2)
    expect(k.runsOf(trigger.triggerRef).map((r) => r.status).sort()).toEqual(["DROPPED", "TASK_CREATED", "TASK_CREATED"])
  })

  it("ALLOW_PARALLEL: every distinct delivery creates its own task", async () => {
    const { trigger } = await k.createActive({ ...WEBHOOK_TRIGGER, concurrency: "ALLOW_PARALLEL" })
    for (const id of ["p1", "p2", "p3"]) expect((await fireWebhook(trigger.triggerRef, id)).outcome).toBe("TASK_CREATED")
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(3)
  })

  it("a stale slot holder (firing process died) is recovered, never blocking the trigger forever", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    const row = k.triggerRow(trigger.triggerRef)
    await k.triggerStore.createRun({ triggerId: row.id, deliveryKey: "webhook:crashed", source: "WEBHOOK", status: "PENDING" })
    const crashed = Array.from(k.fake._triggerRuns.values()).find((r) => r.deliveryKey === "webhook:crashed")!
    await k.triggerStore.claimActiveSlot(crashed.id as string, row.id, k.state.now)
    expect((await fireWebhook(trigger.triggerRef, "while-in-flight")).outcome).toBe("DROPPED")
    k.advance(11 * 60_000)
    expect((await fireWebhook(trigger.triggerRef, "after-stale")).outcome).toBe("TASK_CREATED")
    expect(k.fake._triggerRuns.get(crashed.id as string)).toMatchObject({ status: "FAILED", errorCode: "TASK_CREATION_FAILED", activeSlotKey: null })
  })
})

describe("Phase 9 F — every firing is re-authorized (a trigger grants nothing)", () => {
  it("Phase 6 denial -> DENIED, no task, failure recorded", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    k.state.authz = DENY
    expect(await fireWebhook(trigger.triggerRef, "d1")).toMatchObject({ outcome: "DENIED", errorCode: "AUTHORIZATION_DENIED" })
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(0)
    expect(k.triggerRow(trigger.triggerRef)).toMatchObject({ failureCount: 1 })
    expect(k.queue.enqueued).toHaveLength(0)
  })

  it("Scenario 9: autonomy downgraded after the trigger was created -> denied at firing (current policy wins)", async () => {
    // Write fixture (write paths are proven with fixtures only): OBSERVE_ONLY forbids it.
    const write = await k.createActive({ type: "WEBHOOK", name: "Fixture write", connectionId: "conn_1", capabilityId: "fixtures.conditionalWrite", input: { value: "a" } })
    expect((await fireWebhook(write.trigger.triggerRef, "w1")).outcome).toBe("TASK_CREATED")
    await k.drainTasks()
    k.state.policy = policy({ autonomyLevel: "OBSERVE_ONLY", maxRiskTier: "READ", version: 2 })
    expect((await fireWebhook(write.trigger.triggerRef, "w2")).outcome).toBe("DENIED")
    // READ trigger: the connection's capability scope was narrowed.
    const read = await k.createActive(WEBHOOK_TRIGGER)
    k.state.policy = policy({ autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE", allowedCapabilityIds: ["tickets.list"], version: 3 })
    expect((await fireWebhook(read.trigger.triggerRef, "r1")).outcome).toBe("DENIED")
    expect(k.tasksOf(write.trigger.triggerRef)).toHaveLength(1)
    expect(k.tasksOf(read.trigger.triggerRef)).toHaveLength(0)
  })

  it("approval required -> APPROVAL_REQUIRED (request filed, nothing runs); once approved, the next firing consumes it once", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    k.state.policy = policy({ autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE", approvalRequiredFor: ["products.list"] })
    expect(await fireWebhook(trigger.triggerRef, "a1")).toMatchObject({ outcome: "APPROVAL_REQUIRED", errorCode: "APPROVAL_REQUIRED" })
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(0)
    const request = Array.from(k.fake._requests.values())[0]
    expect(request).toMatchObject({ status: "PENDING", connectionId: "conn_1", capabilityId: "products.list" })
    expect(k.triggerRow(trigger.triggerRef).failureCount).toBe(0)

    await k.approveFromMessage(`ref ${request.publicRef}`)
    expect((await fireWebhook(trigger.triggerRef, "a2")).outcome).toBe("TASK_CREATED")
    const [task] = k.tasksOf(trigger.triggerRef)
    expect(task.approvalRequestId).toBe(request.id)
    await k.drainTasks()
    expect(k.tasksOf(trigger.triggerRef)[0].status).toBe("SUCCEEDED")
    // Single use: the next firing needs a new approval.
    expect((await fireWebhook(trigger.triggerRef, "a3")).outcome).toBe("APPROVAL_REQUIRED")
  })

  it("connection suspended -> DENIED (trigger kept); revoked -> DENIED and the trigger is revoked", async () => {
    const { trigger } = await k.createActive({ ...WEBHOOK_TRIGGER, concurrency: "ALLOW_PARALLEL" })
    k.fake.updateConnection("conn_1", { status: "SUSPENDED" })
    expect((await fireWebhook(trigger.triggerRef, "c1")).outcome).toBe("DENIED")
    expect(k.triggerRow(trigger.triggerRef).status).toBe("ACTIVE")
    k.fake.updateConnection("conn_1", { status: "REVOKED" })
    expect((await fireWebhook(trigger.triggerRef, "c2")).outcome).toBe("DENIED")
    expect(k.triggerRow(trigger.triggerRef).status).toBe("REVOKED")
    expect((await fireWebhook(trigger.triggerRef, "c3")).outcome).toBe("INACTIVE")
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(0)
  })

  it("connection expired -> the trigger expires", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    k.fake.updateConnection("conn_1", { expiresAt: new Date(k.state.now.getTime() - 1) })
    expect((await fireWebhook(trigger.triggerRef, "x1")).outcome).toBe("DENIED")
    expect(k.triggerRow(trigger.triggerRef).status).toBe("EXPIRED")
  })

  it("owner or environment drift -> DENIED", async () => {
    const { trigger } = await k.createActive({ ...WEBHOOK_TRIGGER, concurrency: "ALLOW_PARALLEL" })
    k.fake.updateConnection("conn_1", { ownerId: "owner_2" })
    expect((await fireWebhook(trigger.triggerRef, "o1")).outcome).toBe("DENIED")
    k.fake.updateConnection("conn_1", { ownerId: "owner_1", environment: "production" })
    expect((await fireWebhook(trigger.triggerRef, "o2")).outcome).toBe("DENIED")
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(0)
  })

  it("the pinned capability version is no longer current -> FAILED TRIGGER_VALIDATION_FAILED and the trigger is disabled", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    k.registry.register({ ...k.registry.get("products.list")!, version: 2 })
    expect(await fireWebhook(trigger.triggerRef, "v1")).toMatchObject({ outcome: "FAILED", errorCode: "TRIGGER_VALIDATION_FAILED" })
    expect(k.triggerRow(trigger.triggerRef).status).toBe("DISABLED")
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(0)
  })

  it("an expired trigger never fires and is moved to EXPIRED", async () => {
    const { trigger } = await k.createActive({ ...WEBHOOK_TRIGGER, expiresAt: new Date(k.state.now.getTime() + 60_000).toISOString() })
    k.advance(60_000)
    expect((await fireWebhook(trigger.triggerRef, "late")).outcome).toBe("INACTIVE")
    expect(k.triggerRow(trigger.triggerRef).status).toBe("EXPIRED")
  })
})

describe("Phase 9 G — failure handling", () => {
  it("queue unavailable: FAILED QUEUE_UNAVAILABLE (retryable), no approval consumed; a re-delivery succeeds once", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    k.queue.configured = false
    expect(await fireWebhook(trigger.triggerRef, "q")).toMatchObject({ outcome: "FAILED", errorCode: "QUEUE_UNAVAILABLE", retryable: true })
    expect(k.decide).not.toHaveBeenCalled() // queue checked before the gate
    k.queue.configured = true
    expect((await fireWebhook(trigger.triggerRef, "q")).outcome).toBe("TASK_CREATED")
    expect(await fireWebhook(trigger.triggerRef, "q")).toMatchObject({ outcome: "DUPLICATE" })
    expect(k.runsOf(trigger.triggerRef)).toHaveLength(1)
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(1)
  })

  it("enqueue failing after the task row was written: the re-delivery reuses the same task identity", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    k.queue.failEnqueue = true
    expect((await fireWebhook(trigger.triggerRef, "f")).errorCode).toBe("QUEUE_UNAVAILABLE")
    k.queue.failEnqueue = false
    expect((await fireWebhook(trigger.triggerRef, "f")).outcome).toBe("TASK_CREATED")
    const live = k.tasksOf(trigger.triggerRef).filter((t) => t.status !== "FAILED")
    expect(live).toHaveLength(1)
  })

  it("policy store down -> DENIED (fail closed), never a task", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    k.state.authzThrows = true
    expect((await fireWebhook(trigger.triggerRef, "p")).outcome).toBe("DENIED")
    expect(k.tasksOf(trigger.triggerRef)).toHaveLength(0)
  })

  it("trigger store unreachable before the delivery is recorded -> throws (the caller retries)", async () => {
    const { trigger } = await k.createActive(WEBHOOK_TRIGGER)
    k.fake.client.agentTriggerRun.create.mockRejectedValueOnce(new Error("db down"))
    await expect(fireWebhook(trigger.triggerRef, "s")).rejects.toThrow()
    expect((await fireWebhook(trigger.triggerRef, "s")).outcome).toBe("TASK_CREATED")
  })
})

describe("Phase 9 D — schedule tick", () => {
  async function schedule(extra: Record<string, unknown> = {}) {
    return (await k.createActive({ ...SCHEDULE_TRIGGER, ...extra })).trigger
  }

  it("fires exactly at the occurrence, not before; the next occurrence is scheduled", async () => {
    const t = await schedule()
    k.state.now = new Date("2026-10-02T10:59:59.999Z")
    expect((await k.runtime.runScheduleTick()).fired).toBe(0)
    k.state.now = new Date("2026-10-02T11:00:00.000Z")
    expect((await k.runtime.runScheduleTick()).fired).toBe(1)
    expect(k.runsOf(t.triggerRef)).toMatchObject([{ status: "TASK_CREATED", source: "SCHEDULE", deliveryKey: "schedule:2026-10-02T11:00:00.000Z" }])
    expect(k.triggerRow(t.triggerRef).nextRunAt.toISOString()).toBe("2026-10-02T12:00:00.000Z")
    expect((await k.runtime.runScheduleTick()).fired).toBe(0)
  })

  it("two concurrent ticks claim an occurrence once", async () => {
    const t = await schedule({ concurrency: "ALLOW_PARALLEL" })
    k.state.now = new Date("2026-10-02T11:00:10.000Z")
    const reports = await Promise.all([k.runtime.runScheduleTick(), k.runtime.runScheduleTick(), k.runtime.runScheduleTick()])
    expect(reports.reduce((n, r) => n + r.fired, 0)).toBe(1)
    expect(k.tasksOf(t.triggerRef)).toHaveLength(1)
  })

  it("SKIP after an outage: no backlog, the schedule resumes at the next future occurrence", async () => {
    const t = await schedule()
    k.state.now = new Date("2026-10-02T15:30:00.000Z") // 11:00 .. 15:00 missed
    const report = await k.runtime.runScheduleTick()
    expect(report).toMatchObject({ fired: 0, skipped: 1 })
    expect(k.runsOf(t.triggerRef)).toMatchObject([{ status: "SKIPPED_MISSED", errorCode: "MISSED_RUN" }])
    expect(k.tasksOf(t.triggerRef)).toHaveLength(0)
    expect(k.triggerRow(t.triggerRef).nextRunAt.toISOString()).toBe("2026-10-02T16:00:00.000Z")
  })

  it("CATCH_UP_ONCE after an outage: exactly one run for the newest missed occurrence", async () => {
    const t = await schedule({ schedule: { kind: "CRON", cron: "0 * * * *", timezone: "UTC", missedRunPolicy: "CATCH_UP_ONCE" } })
    k.state.now = new Date("2026-10-02T15:30:00.000Z")
    expect((await k.runtime.runScheduleTick()).fired).toBe(1)
    expect((await k.runtime.runScheduleTick()).fired).toBe(0)
    expect(k.runsOf(t.triggerRef)).toMatchObject([{ status: "TASK_CREATED", deliveryKey: "schedule:2026-10-02T15:00:00.000Z" }])
    expect(k.tasksOf(t.triggerRef)).toHaveLength(1)
  })

  it("a one-time schedule fires once and then expires", async () => {
    const t = await schedule({ schedule: { kind: "ONCE", runAt: "2026-10-02T12:00:00.000Z", timezone: "UTC" } })
    k.state.now = new Date("2026-10-02T12:00:30.000Z")
    const report = await k.runtime.runScheduleTick()
    expect(report).toMatchObject({ fired: 1, expired: 1 })
    expect(k.triggerRow(t.triggerRef)).toMatchObject({ status: "EXPIRED", nextRunAt: null })
    k.advance(HOUR)
    expect((await k.runtime.runScheduleTick()).fired).toBe(0)
    expect(k.tasksOf(t.triggerRef)).toHaveLength(1)
  })

  it("paused schedules never fire; resuming does not replay the paused period", async () => {
    const t = await schedule()
    await k.triggers.transition(t.triggerRef, t.version, "pause", "admin_1")
    k.state.now = new Date("2026-10-02T14:00:00.000Z")
    expect((await k.runtime.runScheduleTick()).due).toBe(0)
    const resumed = await k.triggers.transition(t.triggerRef, t.version + 1, "resume", "admin_1")
    expect(resumed.schedule!.nextRunAt).toBe("2026-10-02T15:00:00.000Z")
    expect((await k.runtime.runScheduleTick()).fired).toBe(0)
    expect(k.runsOf(t.triggerRef)).toHaveLength(0)
  })

  it("expiresAt ends the schedule (tick sweep)", async () => {
    const t = await schedule({ expiresAt: "2026-10-02T11:30:00.000Z" })
    k.state.now = new Date("2026-10-02T11:00:00.000Z")
    await k.runtime.runScheduleTick()
    expect(k.triggerRow(t.triggerRef).status).toBe("EXPIRED") // no occurrence left before expiresAt
    expect(k.tasksOf(t.triggerRef)).toHaveLength(1)
  })

  it("a schedule that cannot be evaluated is disabled (SCHEDULE_ERROR), never run", async () => {
    const t = await schedule()
    const row = k.fake._triggers.get(k.triggerRow(t.triggerRef).id)!
    row.nextRunAt = new Date("2026-10-02T11:00:00.000Z")
    row.cronExpression = null
    row.scheduleKind = "CRON"
    k.state.now = new Date("2026-10-02T11:00:00.000Z")
    await k.runtime.runScheduleTick()
    expect(k.triggerRow(t.triggerRef).status).toBe("DISABLED")
    expect(k.runsOf(t.triggerRef)).toMatchObject([{ status: "FAILED", errorCode: "SCHEDULE_ERROR" }])
    expect(k.tasksOf(t.triggerRef)).toHaveLength(0)
  })

  it("the tick job routes through process(); malformed and unknown jobs are ignored", async () => {
    await schedule()
    k.state.now = new Date("2026-10-02T11:00:00.000Z")
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_TICK, data: {} })
    expect(k.fake._triggerRuns.size).toBe(1)
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_EVENT, data: { eventType: "PAYMENT_SUCCESS", digest: "0".repeat(64) } })
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_EVENT, data: { ...normalized("p1"), extra: "field" } })
    await k.runtime.process({ name: "agent-trigger.unknown", data: {} })
    expect(k.fake._triggerRuns.size).toBe(1)
  })
})

describe("Phase 9 B — event-bus intake hook", () => {
  it("is a no-op when disabled or for non-allowlisted events", async () => {
    const enqueue = vi.fn(async () => ({ id: "job" }))
    await k.notifyAgentEventTriggers(productEvent("p1"), { enabled: () => false, enqueue })
    await k.notifyAgentEventTriggers({ type: "PAYMENT_SUCCESS", timestamp: "t", payload: { productId: "p1" } } as never, { enabled: () => true, enqueue })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it("enqueues ONE id-only reference job with a deterministic id", async () => {
    const enqueue = vi.fn(async (_payload: unknown, jobId: string) => ({ id: jobId }))
    await k.notifyAgentEventTriggers(productEvent("prod_1"), { enabled: () => true, enqueue })
    expect(enqueue).toHaveBeenCalledTimes(1)
    const [payload, jobId] = enqueue.mock.calls[0]
    expect(jobId).toMatch(/^evt-[0-9a-f]{64}$/)
    expect(payload).toEqual({
      eventType: "PRODUCT_UPDATED",
      digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      resourceType: "Product",
      resourceId: "prod_1",
      actorId: "owner_1",
      subjectUserId: null,
      occurredAt: "2026-10-02T10:00:00.000Z",
    })
    expect(JSON.stringify(payload)).not.toContain("Secret Product Name")
  })

  it("never throws: queue errors, lazy no-op queues and hangs are all absorbed", async () => {
    await expect(k.notifyAgentEventTriggers(productEvent("p1"), { enabled: () => true, enqueue: async () => { throw new Error("redis down") } })).resolves.toBeUndefined()
    await expect(k.notifyAgentEventTriggers(productEvent("p1"), { enabled: () => true, enqueue: async () => undefined })).resolves.toBeUndefined()
    await expect(k.notifyAgentEventTriggers(null as never, { enabled: () => true })).resolves.toBeUndefined()
  })

  it("an intake job processed by the runtime fires the matching trigger", async () => {
    const { trigger } = await k.createActive(EVENT_TRIGGER)
    let job: { payload: unknown } | null = null
    await k.notifyAgentEventTriggers(productEvent("prod_5"), { enabled: () => true, enqueue: async (payload) => ((job = { payload }), { id: "j1" }) })
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_EVENT, data: job!.payload })
    expect(k.tasksOf(trigger.triggerRef)).toMatchObject([{ input: { id: "prod_5" } }])
  })
})
