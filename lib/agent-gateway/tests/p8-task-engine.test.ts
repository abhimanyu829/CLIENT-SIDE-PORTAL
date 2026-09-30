/**
 * Phase 8 — task creation through the gate (A.1, A.6–A.9, A.16, A.17),
 * idempotency (C), cancellation (E), queue failure (H) and ownership /
 * forgery (G), using the REAL AgentTaskService + ExecutionGate over the
 * Phase 7 fake DB and an in-memory queue.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildTaskKit, gatewayCtx, T0 } from "./task-test-kit"
import { ALLOW, DENY, REQUIRES_APPROVAL, policy } from "./p7-helpers"

beforeEach(() => vi.resetModules())

describe("A — task creation", () => {
  it("creates a QUEUED task with a server-derived security context and enqueues attempt 1", async () => {
    const k = await buildTaskKit()
    const { task, created } = await k.submit("products.get", { id: "p1" })
    expect(created).toBe(true)
    expect(task.status).toBe("QUEUED")
    expect(task.taskRef).toMatch(/^atk_[0-9a-f]{32}$/)
    const row = k.taskByRef(task.taskRef)!
    expect(row).toMatchObject({
      connectionId: "conn_1",
      ownerId: "owner_1",
      agentId: "agent_1",
      capabilityId: "products.get",
      capabilityVersion: 1,
      adapterId: "products.getAdapter",
      environment: "development",
      resourceType: "Product",
      resourceId: "p1",
      retryClass: "SAFE_RETRY",
      maxAttempts: 3,
      attempts: 0,
      authorizationPolicyRef: "polver_1@v1",
      autonomyPolicyVersion: 1,
    })
    expect(row.id).not.toBe(task.taskRef)
    expect(row.requestId).toBe("req_1")
    expect(row.expiresAt.getTime()).toBe(T0.getTime() + k.config.deadlineMs)
    expect(k.queue.enqueued).toHaveLength(1)
    expect(k.queue.enqueued[0]).toMatchObject({ jobId: `${row.id}-a1`, payload: { taskId: row.id, attempt: 1, capabilityId: "products.get", adapterId: "products.getAdapter", environment: "development", idempotencyRef: null } })
    // The payload never carries input or identity.
    expect(JSON.stringify(k.queue.enqueued[0].payload)).not.toMatch(/p1|owner_1|conn_1/)
  })

  it("the agent-facing view exposes no input, digest, internal id or approval id", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("products.get", { id: "p1" })
    const text = JSON.stringify(task)
    const row = k.taskByRef(task.taskRef)!
    expect(text).not.toContain(row.id)
    expect(text).not.toContain(row.inputDigest)
    expect(text).not.toContain("\"input\"")
    expect(text).not.toMatch(/approval|idempotencyScope/)
  })

  it("unknown / unexposed capabilities are CAPABILITY_NOT_FOUND; sync-only ones are ASYNC_NOT_SUPPORTED; nothing is created", async () => {
    const k = await buildTaskKit()
    expect(await k.catchCode(k.submit("nope.missing"))).toBe("CAPABILITY_NOT_FOUND")
    expect(await k.catchCode(k.submit("refunds.process"))).toBe("CAPABILITY_NOT_FOUND")
    expect(await k.catchCode(k.submit("products.updatePricing"))).toBe("CAPABILITY_NOT_FOUND")
    expect(await k.catchCode(k.submit("coupons.create", { code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10 }))).toBe("ASYNC_NOT_SUPPORTED")
    expect(await k.catchCode(k.submit("products.createDraft"))).toBe("ASYNC_NOT_SUPPORTED")
    expect(k.fake._tasks.size).toBe(0)
    expect(k.decide).not.toHaveBeenCalled()
  })

  it("invalid input (schema, oversize, bad idempotency key) is INVALID_INPUT and never reaches the gate", async () => {
    const k = await buildTaskKit()
    expect(await k.catchCode(k.submit("products.get", { id: "p1", extra: 1 }))).toBe("INVALID_INPUT")
    expect(await k.catchCode(k.submit("fixtures.conditionalWrite", { value: "x".repeat(200), big: 1 }))).toBe("OK")
    expect(await k.catchCode(k.submit("products.get", { id: "p1" }, "bad key!"))).toBe("INVALID_INPUT")
    k.config.maxInputBytes = 10
    expect(await k.catchCode(k.submit("products.get", { id: "p2" }))).toBe("INVALID_INPUT")
    expect(k.decide).toHaveBeenCalledTimes(1)
  })

  it("a capability that requires an idempotency key rejects a key-less submission", async () => {
    const k = await buildTaskKit()
    expect(await k.catchCode(k.submit("fixtures.keyedWrite", { value: "a" }))).toBe("IDEMPOTENCY_KEY_REQUIRED")
    expect(await k.catchCode(k.submit("fixtures.keyedWrite", { value: "a" }, "key-000001"))).toBe("OK")
  })

  it("gate denials propagate with their own codes and create no task", async () => {
    const k = await buildTaskKit()
    k.state.authz = DENY
    expect(await k.catchCode(k.submit("products.get", { id: "p1" }))).toBe("AUTHORIZATION_DENIED")
    k.state.authz = ALLOW
    k.state.policy = null
    expect(await k.catchCode(k.submit("fixtures.conditionalWrite", { value: "a" }))).toBe("AUTONOMY_DENIED")
    k.state.policyThrows = true
    expect(await k.catchCode(k.submit("products.get", { id: "p1" }))).toBe("POLICY_UNAVAILABLE")
    expect(k.fake._tasks.size).toBe(0)
  })

  it("an inactive identity or a connection registered for another environment is refused", async () => {
    const k = await buildTaskKit()
    expect(await k.catchCode(k.submit("products.get", { id: "p1" }, undefined, gatewayCtx({ status: "SUSPENDED" })))).toBe("AUTHORIZATION_REVOKED")
    k.fake.updateConnection("conn_1", { environment: "production" })
    expect(await k.catchCode(k.submit("products.get", { id: "p1" }))).toBe("ENVIRONMENT_MISMATCH")
    expect(k.fake._tasks.size).toBe(0)
  })
})

describe("C — idempotency", () => {
  it("same key + same operation returns the same task; no second task or job", async () => {
    const k = await buildTaskKit()
    const a = await k.submit("products.get", { id: "p1" }, "key-000001")
    const b = await k.submit("products.get", { id: "p1" }, "key-000001")
    expect(b.created).toBe(false)
    expect(b.task.taskRef).toBe(a.task.taskRef)
    expect(k.fake._tasks.size).toBe(1)
    expect(k.queue.enqueued).toHaveLength(1)
  })

  it("same key + different input / capability is IDEMPOTENCY_CONFLICT", async () => {
    const k = await buildTaskKit()
    await k.submit("products.get", { id: "p1" }, "key-000001")
    expect(await k.catchCode(k.submit("products.get", { id: "p2" }, "key-000001"))).toBe("IDEMPOTENCY_CONFLICT")
    expect(await k.catchCode(k.submit("products.list", {}, "key-000001"))).toBe("IDEMPOTENCY_CONFLICT")
    expect(k.fake._tasks.size).toBe(1)
  })

  it("keys are scoped per connection: the same key from another connection is a different task", async () => {
    const k = await buildTaskKit()
    k.fake.seedConnection({ id: "conn_2", ownerId: "owner_2" })
    const a = await k.submit("products.get", { id: "p1" }, "key-000001")
    const b = await k.submit("products.get", { id: "p1" }, "key-000001", gatewayCtx({ connectionId: "conn_2", ownerId: "owner_2" }))
    expect(b.created).toBe(true)
    expect(b.task.taskRef).not.toBe(a.task.taskRef)
  })

  it("key-less identical submissions return the in-flight task; after it finishes a new one is created", async () => {
    const k = await buildTaskKit({ withExecutionDb: true })
    k.execFake!.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const a = await k.submit("products.get", { id: "p1" })
    const b = await k.submit("products.get", { id: "p1" })
    expect(b.created).toBe(false)
    expect(b.task.taskRef).toBe(a.task.taskRef)
    await k.drain()
    expect(k.taskByRef(a.task.taskRef)!.status).toBe("SUCCEEDED")
    const c = await k.submit("products.get", { id: "p1" })
    expect(c.created).toBe(true)
  })

  for (const keyed of [true, false]) {
    it(`10 concurrent identical submissions (${keyed ? "keyed" : "key-less"}) create exactly one task and one job`, async () => {
      const k = await buildTaskKit()
      const results = await Promise.all(Array.from({ length: 10 }, () => k.submit("products.get", { id: "p1" }, keyed ? "key-000001" : undefined)))
      expect(new Set(results.map((r) => r.task.taskRef)).size).toBe(1)
      expect(results.filter((r) => r.created).length).toBe(1)
      expect(k.fake._tasks.size).toBe(1)
      expect(k.queue.jobs.size).toBe(1)
    })
  }

  it("a DB-enforced identity survives a restart: a fresh service instance still returns the same task", async () => {
    const k = await buildTaskKit()
    const a = await k.submit("products.get", { id: "p1" }, "key-000001")
    const { AgentTaskService } = await import("../tasks/engine")
    const restarted = new AgentTaskService({ capabilityRegistry: k.registry, adapterRegistry: k.adapters, gate: k.gate, queue: k.queue, config: k.config, clock: () => k.state.now })
    const b = await restarted.submit(gatewayCtx(), "development", { capabilityId: "products.get", input: { id: "p1" }, idempotencyKey: "key-000001" })
    expect(b.task.taskRef).toBe(a.task.taskRef)
  })
})

describe("H — queue unavailable fails closed", () => {
  it("no queue configured: QUEUE_UNAVAILABLE before the gate runs (no approval consumed, no task)", async () => {
    const k = await buildTaskKit()
    k.queue.configured = false
    expect(await k.catchCode(k.submit("products.get", { id: "p1" }))).toBe("QUEUE_UNAVAILABLE")
    expect(k.decide).not.toHaveBeenCalled()
    expect(k.fake._tasks.size).toBe(0)
  })

  it("enqueue fails after creation: the task is FAILED/QUEUE_UNAVAILABLE (never reported QUEUED) and the key is released", async () => {
    const k = await buildTaskKit()
    k.queue.failEnqueue = true
    expect(await k.catchCode(k.submit("products.get", { id: "p1" }, "key-000001"))).toBe("QUEUE_UNAVAILABLE")
    const [row] = Array.from(k.fake._tasks.values()) as Array<Record<string, any>>
    expect(row).toMatchObject({ status: "FAILED", errorCode: "QUEUE_UNAVAILABLE", retryScheduled: false, idempotencyScope: null })
    k.queue.failEnqueue = false
    const retry = await k.submit("products.get", { id: "p1" }, "key-000001")
    expect(retry.created).toBe(true)
    expect(retry.task.taskRef).not.toBe(row.taskRef)
  })
})

describe("A.16 / G — approval binding", () => {
  it("an approval-required async write: APPROVAL_REQUIRED, then after human approval exactly one task bound to that approval", async () => {
    const k = await buildTaskKit()
    k.state.policy = policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE" })
    const first = await k.submit("fixtures.conditionalWrite", { value: "a" }).catch((e) => e)
    expect(first.code).toBe("APPROVAL_REQUIRED")
    expect(k.fake._tasks.size).toBe(0)
    const ref = await k.approveFromMessage(first.message)
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const row = k.taskByRef(task.taskRef)!
    const approval = Array.from(k.fake._requests.values()).find((r) => r.publicRef === ref)! as Record<string, any>
    expect(approval.status).toBe("CONSUMED")
    expect(row.approvalRequestId).toBe(approval.id)
    expect(row.expiresAt.getTime()).toBeLessThanOrEqual(approval.expiresAt.getTime())
    // The approval was single-use: a second, different-key submission needs a new approval.
    expect(await k.catchCode(k.submit("fixtures.conditionalWrite", { value: "a" }, "key-000002"))).toBe("APPROVAL_REQUIRED")
  })

  it("an approval for input A never lets a task for input B be created", async () => {
    const k = await buildTaskKit()
    k.state.policy = policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE" })
    // Same resource ("a"), different input: the approval does not cover it.
    const first = await k.submit("fixtures.conditionalWrite", { value: "a", big: 1 }).catch((e) => e)
    await k.approveFromMessage(first.message)
    expect(await k.catchCode(k.submit("fixtures.conditionalWrite", { value: "a", big: 2 }))).toBe("APPROVAL_BINDING_MISMATCH")
    // A different resource needs its own approval.
    expect(await k.catchCode(k.submit("fixtures.conditionalWrite", { value: "b", big: 1 }))).toBe("APPROVAL_REQUIRED")
    expect(k.fake._tasks.size).toBe(0)
  })

  it("Phase 6 REQUIRES_APPROVAL is honoured for async submissions too", async () => {
    const k = await buildTaskKit()
    k.state.authz = REQUIRES_APPROVAL
    expect(await k.catchCode(k.submit("products.get", { id: "p1" }))).toBe("APPROVAL_REQUIRED")
  })
})

describe("G — status is owner-scoped and tamper-proof", () => {
  it("unknown, malformed and foreign references all get the identical TASK_NOT_FOUND", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("products.get", { id: "p1" })
    const errors: string[] = []
    for (const [identity, ref] of [
      [{ connectionId: "conn_2", ownerId: "owner_1" }, task.taskRef],
      [{ connectionId: "conn_1", ownerId: "owner_2" }, task.taskRef],
      [{ connectionId: "conn_1", ownerId: "owner_1" }, "atk_" + "0".repeat(32)],
      [{ connectionId: "conn_1", ownerId: "owner_1" }, "not-a-ref"],
      [{ connectionId: "conn_1", ownerId: "owner_1" }, { $ne: null }],
    ] as const) {
      const err = await k.service.getStatus(identity, ref).catch((e) => e)
      errors.push(`${err.code}:${err.message}`)
    }
    expect(new Set(errors)).toEqual(new Set(["TASK_NOT_FOUND:Task not found."]))
  })

  it("status applies time rules lazily: a task past its deadline reads as EXPIRED", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("products.get", { id: "p1" })
    k.advance(k.config.deadlineMs)
    const view = await k.service.getStatus({ connectionId: "conn_1", ownerId: "owner_1" }, task.taskRef)
    expect(view.status).toBe("EXPIRED")
    expect(view.errorCode).toBe("TASK_EXPIRED")
  })

  it("a stored result is withheld once the caller is no longer authorized for that operation", async () => {
    const k = await buildTaskKit({ withExecutionDb: true })
    k.execFake!.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const { task } = await k.submit("products.get", { id: "p1" })
    await k.drain()
    const me = { connectionId: "conn_1", ownerId: "owner_1" }
    expect((await k.service.getStatus(me, task.taskRef)).result).toEqual({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    k.state.authz = DENY
    const after = await k.service.getStatus(me, task.taskRef)
    expect(after.status).toBe("SUCCEEDED")
    expect(after.result).toBeUndefined()
    expect(after.resultUnavailable).toBe("AUTHORIZATION_REVOKED")
  })
})

describe("E — cancellation", () => {
  const me = { connectionId: "conn_1", ownerId: "owner_1" }

  it("cancelling a QUEUED task cancels it and removes its pending job; the job, if it still runs, does nothing", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const row = k.taskByRef(task.taskRef)!
    const res = await k.service.cancel(me, task.taskRef)
    expect(res.outcome).toBe("CANCELLED")
    expect(res.task.status).toBe("CANCELLED")
    expect(k.queue.removed).toContain(`${row.id}-a1`)
    await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: k.queue.enqueued[0].payload, id: `${row.id}-a1` })
    expect(k.calls.count).toBe(0)
  })

  it("cancelling a terminal task returns the matching code and changes nothing", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    await k.service.cancel(me, task.taskRef)
    expect(await k.catchCode(k.service.cancel(me, task.taskRef))).toBe("TASK_CANCELLED")
    const done = await k.submit("fixtures.conditionalWrite", { value: "b" })
    await k.drain()
    expect(await k.catchCode(k.service.cancel(me, done.task.taskRef))).toBe("TASK_ALREADY_COMPLETED")
    const late = await k.submit("fixtures.conditionalWrite", { value: "c" })
    k.advance(k.config.deadlineMs)
    expect(await k.catchCode(k.service.cancel(me, late.task.taskRef))).toBe("TASK_EXPIRED")
  })

  it("a RUNNING task whose adapter cannot be interrupted: CANCELLATION_UNAVAILABLE (never faked)", async () => {
    const k = await buildTaskKit()
    let release: (() => void) | undefined
    k.behaviour.run = () => new Promise((resolve) => (release = () => resolve({ ok: true })))
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const running = k.drain(1)
    await vi.waitFor(() => expect(typeof release).toBe("function"))
    expect(k.taskByRef(task.taskRef)!.status).toBe("RUNNING")
    const res = await k.service.cancel(me, task.taskRef)
    expect(res.outcome).toBe("CANCELLATION_UNAVAILABLE")
    expect(res.task.status).toBe("RUNNING")
    release!()
    await running
    expect(k.taskByRef(task.taskRef)!.status).toBe("SUCCEEDED")
  })

  it("a RUNNING cooperative task: CANCELLATION_REQUESTED, then CANCELLED once the adapter stops", async () => {
    const k = await buildTaskKit()
    k.behaviour.run = (_input, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
      }).catch(async () => {
        const { ExecutionError } = await import("../execution/contracts/execution-error")
        throw new ExecutionError("CANCELLED", "stopped")
      })
    const { task } = await k.submit("fixtures.cooperativeRead", { value: "a" })
    const running = k.drain(1)
    await vi.waitFor(() => expect(k.calls.count).toBe(1))
    expect(k.taskByRef(task.taskRef)!.status).toBe("RUNNING")
    const res = await k.service.cancel(me, task.taskRef)
    expect(res.outcome).toBe("CANCELLATION_REQUESTED")
    await running
    expect(k.taskByRef(task.taskRef)!.status).toBe("CANCELLED")
  })

  it("concurrent cancel + claim: exactly one wins; a cancelled task is never dispatched", async () => {
    for (let i = 0; i < 5; i += 1) {
      const k = await buildTaskKit()
      const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
      const [cancel] = await Promise.allSettled([k.service.cancel(me, task.taskRef), k.drain(1)])
      const status = k.taskByRef(task.taskRef)!.status
      if (cancel.status === "fulfilled" && cancel.value.outcome === "CANCELLED") {
        expect(status).toBe("CANCELLED")
        expect(k.calls.count).toBe(0)
      } else {
        expect(["SUCCEEDED", "RUNNING"]).toContain(status)
        expect(k.calls.count).toBe(1)
      }
    }
  })
})
