/**
 * Phase 9 — cross-phase scenarios, end to end:
 *   arrival -> TriggerRuntime -> Phase 8 submit (Phase 3 validation, Phase 7
 *   ExecutionGate over Phase 6) -> agent-task job -> Phase 8 worker (guard
 *   re-check) -> Phase 4 adapter -> stored result, readable by the owning
 *   connection only.
 *
 *   Scenario 3  internal platform event -> task -> result
 *   Scenario 4  signed webhook -> task -> result
 *   Scenario 5  schedule occurrence -> task -> result (no double fire)
 *   Scenario 11 replayed / duplicated deliveries -> the capability executes once
 * plus: the event-bus hook is wired into emitEvent, and a trigger task is
 * re-verified by the worker like any agent task.
 */
import { describe, expect, it, vi } from "vitest"
import { buildTriggerKit, EVENT_TRIGGER, productEvent, SCHEDULE_TRIGGER, WEBHOOK_TRIGGER } from "./trigger-test-kit"
import { DENY } from "./p7-helpers"

async function kitWithProducts() {
  const k = await buildTriggerKit({ withExecutionDb: true })
  k.execFake!.seedProduct({ id: "prod_1", name: "Alpha", slug: "alpha", status: "AVAILABLE", type: "SAAS" })
  k.execFake!.seedProduct({ id: "prod_2", name: "Beta", slug: "beta", status: "AVAILABLE", type: "SAAS" })
  return k
}

const owner = { connectionId: "conn_1", ownerId: "owner_1" }

describe("Phase 9 F — cross-phase scenarios", () => {
  it("Scenario 3: a platform event drives an authorized task that the worker executes through the Phase 4 adapter", async () => {
    const k = await kitWithProducts()
    const { trigger } = await k.createActive(EVENT_TRIGGER)
    // The event-bus hook enqueues an id-only reference job; the worker processes it.
    const jobs: Array<{ payload: unknown; jobId: string }> = []
    await k.notifyAgentEventTriggers(productEvent("prod_1"), { enabled: () => true, enqueue: async (payload, jobId) => (jobs.push({ payload, jobId }), { id: jobId }) })
    expect(jobs).toHaveLength(1)
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_EVENT, data: jobs[0].payload, id: jobs[0].jobId })
    expect(await k.drainTasks()).toBe(1)

    const [task] = k.tasksOf(trigger.triggerRef)
    expect(task).toMatchObject({ status: "SUCCEEDED", capabilityId: "products.get", triggerId: k.triggerRow(trigger.triggerRef).id })
    const view = await k.service.getStatus(owner, task.taskRef)
    expect(view).toMatchObject({ status: "SUCCEEDED", origin: "TRIGGER", result: { id: "prod_1", name: "Alpha" } })
    // Owner-scoped: another connection / owner cannot see it.
    expect(await k.catchCode(k.service.getStatus({ connectionId: "conn_2", ownerId: "owner_1" }, task.taskRef))).toBe("TASK_NOT_FOUND")
    expect(await k.catchCode(k.service.getStatus({ connectionId: "conn_1", ownerId: "owner_2" }, task.taskRef))).toBe("TASK_NOT_FOUND")
    expect(k.triggerRow(trigger.triggerRef)).toMatchObject({ failureCount: 0, lastSuccessAt: expect.any(Date) })
  })

  it("Scenario 4: a signed webhook drives a task end to end; the response never carries task data", async () => {
    const k = await kitWithProducts()
    const { trigger, webhookSecret } = await k.createActive({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.get", bindResource: true })
    const res = await k.deliver(trigger.triggerRef, k.signedRequest(trigger.triggerRef, webhookSecret!, { resourceId: "prod_2" }))
    expect(res.status).toBe(202)
    expect(Object.keys(res.json).sort()).toEqual(["accepted", "duplicate", "runRef"])
    await k.drainTasks()
    const [task] = k.tasksOf(trigger.triggerRef)
    expect((await k.service.getStatus(owner, task.taskRef)).result).toMatchObject({ id: "prod_2", name: "Beta" })
  })

  it("Scenario 5: a schedule occurrence drives a task end to end, once per occurrence", async () => {
    const k = await kitWithProducts()
    const { trigger } = await k.createActive({ ...SCHEDULE_TRIGGER, input: { limit: 5 } })
    k.state.now = new Date("2026-10-02T11:00:05.000Z")
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_TICK, data: {} })
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_TICK, data: {} })
    await k.drainTasks()
    const tasks = k.tasksOf(trigger.triggerRef)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].status).toBe("SUCCEEDED")
    expect(((await k.service.getStatus(owner, tasks[0].taskRef)).result as { items: unknown[] }).items).toHaveLength(2)
    k.state.now = new Date("2026-10-02T12:00:01.000Z")
    await k.runtime.runScheduleTick()
    await k.drainTasks()
    expect(k.tasksOf(trigger.triggerRef).map((t) => t.status)).toEqual(["SUCCEEDED", "SUCCEEDED"])
  })

  it("Scenario 11: replays and duplicates of every kind execute the capability exactly once", async () => {
    const k = await kitWithProducts()
    const hook = await k.createActive({ ...WEBHOOK_TRIGGER, concurrency: "ALLOW_PARALLEL" })
    const ref = hook.trigger.triggerRef
    const original = k.signedRequest(ref, hook.webhookSecret!, {}, { eventId: "evt-once", nonce: "nonce-scenario-11-000001" })
    const replay = original.clone()
    expect((await k.deliver(ref, original)).status).toBe(202)
    expect((await k.deliver(ref, replay)).status).toBe(409) // same nonce: replay
    expect((await k.deliver(ref, k.signedRequest(ref, hook.webhookSecret!, {}, { eventId: "evt-once" }))).status).toBe(200) // same event id
    const ev = await k.createActive({ ...EVENT_TRIGGER, concurrency: "ALLOW_PARALLEL" })
    const event = k.normalizeTriggerEvent(productEvent("prod_1"))!
    await Promise.all([k.runtime.dispatchEvent(event), k.runtime.dispatchEvent(event), k.runtime.dispatchEvent(event)])
    // A re-delivered job id is a duplicate at the queue AND at the database.
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_EVENT, data: event })
    const executed = { count: 0 }
    const products = k.execFake!.client.product
    const spy = vi.spyOn(products, "findUnique")
    const listSpy = vi.spyOn(products, "findMany")
    await k.drainTasks()
    executed.count = spy.mock.calls.length + listSpy.mock.calls.length
    expect(k.tasksOf(ref)).toHaveLength(1)
    expect(k.tasksOf(ev.trigger.triggerRef)).toHaveLength(1)
    expect(executed.count).toBe(2) // one webhook task + one event task, each executed once
  })

  it("a trigger-created task is re-verified at execution: revoked authorization between creation and run -> never executed", async () => {
    const k = await kitWithProducts()
    const { trigger, webhookSecret } = await k.createActive(WEBHOOK_TRIGGER)
    expect((await k.deliver(trigger.triggerRef, k.signedRequest(trigger.triggerRef, webhookSecret!, {}))).status).toBe(202)
    k.state.authz = DENY
    const listSpy = vi.spyOn(k.execFake!.client.product, "findMany")
    await k.drainTasks()
    expect(listSpy).not.toHaveBeenCalled()
    expect(k.tasksOf(trigger.triggerRef)[0]).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED" })
  })

  it("emitEvent (the existing event bus) calls the trigger intake hook exactly once per event, after its own work", async () => {
    vi.resetModules()
    const notify = vi.fn(async () => undefined)
    vi.doMock("@/lib/agent-gateway/triggers/event-intake", () => ({ notifyAgentEventTriggers: notify }))
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const trigger = vi.fn(async () => undefined)
    vi.doMock("@/lib/pusher", () => ({ getPusherServer: async () => ({ trigger }) }))
    const { emitEvent, EVENTS } = await import("@/lib/services/event-bus")
    const event = { type: EVENTS.PRODUCT_UPDATED, timestamp: "2026-10-02T10:00:00.000Z", actorId: "owner_1", payload: { productId: "prod_1" } }
    await emitEvent(event)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(event)
    expect(trigger).toHaveBeenCalled() // the existing Pusher broadcast still happens
    vi.doUnmock("@/lib/agent-gateway/triggers/event-intake")
    vi.doUnmock("@/lib/pusher")
  })
})
