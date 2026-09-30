/**
 * Phase 8 — the worker: worker-time re-verification (G, A.17, Scenarios
 * 6/7/8/9), retries (D), timeouts (F), crash recovery / redelivery (H, C),
 * payload tampering and substitution (G), result filtering (A.15).
 * REAL AgentTaskWorker + ExecutionGate + Phase 4 AdapterResolver over the
 * fake DB; fixture adapters script the failures.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildTaskKit } from "./task-test-kit"
import { ALLOW, DENY, UNAVAILABLE, policy } from "./p7-helpers"

beforeEach(() => vi.resetModules())

async function executionError(code: string) {
  const { ExecutionError } = await import("../execution/contracts/execution-error")
  return new ExecutionError(code as never, `fixture ${code}`)
}

describe("worker happy path", () => {
  it("executes the READ through the existing adapter and stores the filtered result", async () => {
    const k = await buildTaskKit({ withExecutionDb: true })
    k.execFake!.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const { task } = await k.submit("products.get", { id: "p1" })
    await k.drain()
    const row = k.taskByRef(task.taskRef)!
    expect(row).toMatchObject({ status: "SUCCEEDED", attempts: 1, errorCode: null, result: { id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" } })
    expect(row.startedAt).toBeInstanceOf(Date)
    expect(row.completedAt).toBeInstanceOf(Date)
    expect(row.finishedAt).toBeInstanceOf(Date)
    expect(row.activeOperationKey).toBeNull()
  })

  it("a duplicate delivery of the same attempt executes the business operation once", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const job = k.queue.enqueued[0]
    await Promise.all([
      k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId }),
      k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId }),
    ])
    expect(k.calls.count).toBe(1)
    expect(k.taskByRef(task.taskRef)!.status).toBe("SUCCEEDED")
  })
})

describe("G — worker-time re-verification (never execute on stale security state)", () => {
  async function queued(capabilityId = "fixtures.conditionalWrite", input: Record<string, unknown> = { value: "a" }) {
    const k = await buildTaskKit()
    const { task } = await k.submit(capabilityId, input)
    return { k, ref: task.taskRef }
  }

  it("Scenario 8: connection revoked / suspended / expired / owner changed -> EXPIRED AUTHORIZATION_REVOKED, not dispatched", async () => {
    for (const patch of [{ status: "REVOKED" }, { status: "SUSPENDED" }, { expiresAt: new Date("2026-10-02T09:00:00.000Z") }, { ownerId: "owner_9" }]) {
      const { k, ref } = await queued()
      k.fake.updateConnection("conn_1", patch)
      await k.drain()
      expect(k.taskByRef(ref)).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED" })
      expect(k.calls.count).toBe(0)
    }
  })

  it("Scenario 6: Phase 6 authorization revoked while queued -> EXPIRED AUTHORIZATION_REVOKED", async () => {
    const { k, ref } = await queued()
    k.state.authz = DENY
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED", errorDetailCode: "AUTHORIZATION_DENIED" })
    expect(k.calls.count).toBe(0)
  })

  it("Scenario 9: autonomy downgraded while queued -> the current policy wins", async () => {
    const { k, ref } = await queued()
    k.state.policy = policy({ autonomyLevel: "OBSERVE_ONLY", maxRiskTier: "READ", version: 2 })
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED", errorDetailCode: "AUTONOMY_DENIED" })
  })

  it("approval newly required for a task that has none -> EXPIRED AUTHORIZATION_REVOKED", async () => {
    const { k, ref } = await queued()
    k.state.policy = policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE", version: 2 })
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED", errorDetailCode: "APPROVAL_NOW_REQUIRED" })
  })

  it("capability disabled after queuing -> EXPIRED CAPABILITY_DISABLED", async () => {
    const { k, ref } = await queued()
    k.registry.disable("fixtures.conditionalWrite", 1)
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "EXPIRED", errorCode: "CAPABILITY_DISABLED" })
    expect(k.calls.count).toBe(0)
  })

  it("environment changed (connection or worker) -> EXPIRED TASK_EXPIRED", async () => {
    const { k, ref } = await queued()
    k.fake.updateConnection("conn_1", { environment: "production" })
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "EXPIRED", errorCode: "TASK_EXPIRED", errorDetailCode: "ENVIRONMENT_MISMATCH" })
  })

  it("tampered stored input -> FAILED EXECUTION_FAILED (security), never retried or dispatched", async () => {
    const { k, ref } = await queued()
    const row = k.taskByRef(ref)!
    row.input = { value: "b" } // attacker edits the stored operation
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "FAILED", errorCode: "EXECUTION_FAILED", errorDetailCode: "INPUT_INTEGRITY", retryScheduled: false })
    expect(k.calls.count).toBe(0)
  })

  it("job payload substitution (other capability / adapter / environment / key) -> FAILED, not dispatched", async () => {
    for (const change of [{ capabilityId: "products.get" }, { adapterId: "products.getAdapter" }, { environment: "production" }, { idempotencyRef: "forged-key-1" }, { capabilityVersion: 2 }]) {
      const { k, ref } = await queued()
      const job = k.queue.take()!
      await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: { ...job.payload, ...change }, id: job.jobId })
      expect(k.taskByRef(ref)).toMatchObject({ status: "FAILED", errorDetailCode: "PAYLOAD_INTEGRITY" })
      expect(k.calls.count).toBe(0)
    }
  })

  it("forged / malformed jobs: unknown taskId, extra fields, wrong attempt -> ignored, nothing dispatched", async () => {
    const { k, ref } = await queued()
    const job = k.queue.take()!
    await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: { ...job.payload, taskId: "task_forged" }, id: "x" })
    await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: { ...job.payload, ownerId: "owner_2" }, id: "x" })
    await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: { ...job.payload, attempt: 3 }, id: "x" })
    await k.worker.process({ name: "some.other.job", data: job.payload, id: "x" })
    expect(k.calls.count).toBe(0)
    expect(k.taskByRef(ref)!.status).toBe("QUEUED")
  })

  it("policy store unavailable at worker time is a transient pre-dispatch failure: retried, then succeeds", async () => {
    const k = await buildTaskKit({ withExecutionDb: true })
    k.execFake!.seedProduct({ id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" })
    const { task } = await k.submit("products.get", { id: "p1" })
    k.state.authz = UNAVAILABLE
    await k.drain(1)
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "RETRY_QUEUED", attempts: 1, errorDetailCode: "POLICY_UNAVAILABLE" })
    expect(k.queue.enqueued.at(-1)).toMatchObject({ payload: { attempt: 2 }, delayMs: 1000 })
    k.state.authz = ALLOW
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "SUCCEEDED", attempts: 2 })
  })

  it("a non-transient adapter answer is final: products.get for a missing product -> FAILED EXECUTION_FAILED", async () => {
    const k = await buildTaskKit({ withExecutionDb: true })
    const { task } = await k.submit("products.get", { id: "missing" })
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "FAILED", attempts: 1, errorCode: "EXECUTION_FAILED", errorDetailCode: "RESOURCE_NOT_FOUND" })
  })
})

describe("Scenario 7 / A.16 — approval-bound tasks", () => {
  async function approvedTask() {
    const k = await buildTaskKit()
    k.state.policy = policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE" })
    const first = await k.submit("fixtures.conditionalWrite", { value: "a" }).catch((e) => e)
    await k.approveFromMessage(first.message)
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    return { k, ref: task.taskRef }
  }

  it("executes exactly the approved operation", async () => {
    const { k, ref } = await approvedTask()
    await k.drain()
    expect(k.taskByRef(ref)!.status).toBe("SUCCEEDED")
    expect(k.calls.count).toBe(1)
  })

  it("approval window passes before the worker runs -> EXPIRED (APPROVAL_EXPIRED or the capped deadline), never executed", async () => {
    const { k, ref } = await approvedTask()
    k.advance(31 * 60_000)
    await k.drain()
    expect(k.taskByRef(ref)!.status).toBe("EXPIRED")
    expect(["APPROVAL_EXPIRED", "TASK_EXPIRED"]).toContain(k.taskByRef(ref)!.errorCode)
    expect(k.calls.count).toBe(0)
  })

  it("policy version changed after approval -> EXPIRED APPROVAL_EXPIRED (APPROVAL_POLICY_CHANGED)", async () => {
    const { k, ref } = await approvedTask()
    k.state.policy = policy({ autonomyLevel: "ASSISTED", maxRiskTier: "LOW_RISK_WRITE", version: 2 })
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "EXPIRED", errorCode: "APPROVAL_EXPIRED", errorDetailCode: "APPROVAL_POLICY_CHANGED" })
    expect(k.calls.count).toBe(0)
  })

  it("bound approval tampered (binding differs from the stored task) -> FAILED security", async () => {
    const { k, ref } = await approvedTask()
    const approval = Array.from(k.fake._requests.values()).find((r) => r.id === k.taskByRef(ref)!.approvalRequestId)! as Record<string, unknown>
    approval.bindingDigest = "f".repeat(64)
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "FAILED", errorDetailCode: "APPROVAL_BINDING_INTEGRITY" })
    expect(k.calls.count).toBe(0)
  })

  it("approval row no longer CONSUMED (e.g. cancelled by a human) -> EXPIRED APPROVAL_EXPIRED", async () => {
    const { k, ref } = await approvedTask()
    const approval = Array.from(k.fake._requests.values()).find((r) => r.id === k.taskByRef(ref)!.approvalRequestId)! as Record<string, unknown>
    approval.status = "CANCELLED"
    await k.drain()
    expect(k.taskByRef(ref)).toMatchObject({ status: "EXPIRED", errorCode: "APPROVAL_EXPIRED" })
  })
})

describe("D — retry policy", () => {
  it("SAFE_RETRY: transient failures retry with 1s/2s backoff and then RETRY_EXHAUSTED", async () => {
    const k = await buildTaskKit()
    const err = await executionError("EXECUTION_UNAVAILABLE")
    k.behaviour.run = async () => {
      throw err
    }
    const { task } = await k.submit("fixtures.cooperativeRead", { value: "a" })
    await k.drain()
    const row = k.taskByRef(task.taskRef)!
    expect(row).toMatchObject({ status: "FAILED", attempts: 3, errorCode: "RETRY_EXHAUSTED", retryScheduled: false })
    expect(k.calls.count).toBe(3)
    expect(k.queue.enqueued.map((j) => [j.payload.attempt, j.delayMs ?? 0])).toEqual([
      [1, 0],
      [2, 1000],
      [3, 2000],
    ])
  })

  it("SAFE_RETRY: a transient failure followed by success ends SUCCEEDED on attempt 2", async () => {
    const k = await buildTaskKit()
    const err = await executionError("INTERNAL_ERROR")
    let n = 0
    k.behaviour.run = async () => {
      n += 1
      if (n === 1) throw err
      return { ok: true }
    }
    const { task } = await k.submit("fixtures.cooperativeRead", { value: "a" })
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "SUCCEEDED", attempts: 2 })
  })

  it("non-transient failure: FAILED EXECUTION_FAILED with no retry", async () => {
    const k = await buildTaskKit()
    const err = await executionError("INVALID_INPUT")
    k.behaviour.run = async () => {
      throw err
    }
    const { task } = await k.submit("fixtures.cooperativeRead", { value: "a" })
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "FAILED", attempts: 1, errorCode: "EXECUTION_FAILED", errorDetailCode: "INVALID_INPUT" })
    expect(k.calls.count).toBe(1)
  })

  it("CONDITIONAL_RETRY: a failure after dispatch is never retried (the mutation may have happened)", async () => {
    const k = await buildTaskKit()
    const err = await executionError("EXECUTION_UNAVAILABLE")
    k.behaviour.run = async () => {
      throw err
    }
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "FAILED", attempts: 1, errorCode: "EXECUTION_FAILED" })
    expect(k.calls.count).toBe(1)
  })

  it("CONDITIONAL_RETRY: a pre-dispatch failure is retried", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    k.state.policyThrows = true
    await k.drain(1)
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "RETRY_QUEUED", attempts: 1 })
    k.state.policyThrows = false
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "SUCCEEDED", attempts: 2 })
    expect(k.calls.count).toBe(1)
  })

  it("NO_RETRY: exactly one attempt, even for a pre-dispatch failure", async () => {
    const k = await buildTaskKit()
    // Irreversible operations always need a human approval first (Phase 7 mandatory gate).
    const first = await k.submit("fixtures.irreversibleWrite", { value: "a" }).catch((e) => e)
    expect(first.code).toBe("APPROVAL_REQUIRED")
    await k.approveFromMessage(first.message)
    const { task } = await k.submit("fixtures.irreversibleWrite", { value: "a" })
    k.state.policyThrows = true
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "FAILED", attempts: 1, maxAttempts: 1, errorCode: "EXECUTION_FAILED" })
    expect(k.calls.count).toBe(0)
  })
})

describe("F — timeouts", () => {
  it("execution timeout -> TIMED_OUT; the late result is discarded", async () => {
    const k = await buildTaskKit({ config: { executionTimeoutMs: 30 } })
    let finish: (() => void) | undefined
    k.behaviour.run = () => new Promise((resolve) => (finish = () => resolve({ ok: true, value: "late" })))
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "TIMED_OUT", errorCode: "TASK_TIMEOUT", result: null })
    finish?.()
    await new Promise((r) => setTimeout(r, 10))
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "TIMED_OUT", result: null })
    const view = await k.service.getStatus({ connectionId: "conn_1", ownerId: "owner_1" }, task.taskRef)
    expect(view.note).toMatch(/may still have completed/)
  })

  it("timeout before execution: queue timeout or deadline reached -> EXPIRED, never dispatched", async () => {
    const k = await buildTaskKit()
    const a = await k.submit("fixtures.conditionalWrite", { value: "a" })
    k.advance(k.config.queueTimeoutMs)
    await k.drain()
    expect(k.taskByRef(a.task.taskRef)).toMatchObject({ status: "EXPIRED", errorCode: "TASK_EXPIRED" })
    expect(k.calls.count).toBe(0)
  })

  it("exact deadline boundary: 1 ms before runs, at the instant expires", async () => {
    const k = await buildTaskKit({ config: { deadlineMs: 60_000, queueTimeoutMs: 120_000 } })
    const a = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const b = await k.submit("fixtures.conditionalWrite", { value: "b" })
    k.advance(59_999)
    await k.drain(1)
    expect(k.taskByRef(a.task.taskRef)!.status).toBe("SUCCEEDED")
    k.advance(1)
    await k.drain()
    expect(k.taskByRef(b.task.taskRef)).toMatchObject({ status: "EXPIRED", errorCode: "TASK_EXPIRED" })
  })

  it("timeout after completion changes nothing", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    await k.drain()
    k.advance(k.config.deadlineMs * 2)
    const view = await k.service.getStatus({ connectionId: "conn_1", ownerId: "owner_1" }, task.taskRef)
    expect(view.status).toBe("SUCCEEDED")
  })
})

describe("A.15 — malformed / oversized results", () => {
  it("output exceeding the size limit -> FAILED RESULT_TOO_LARGE, nothing stored, no retry", async () => {
    const k = await buildTaskKit()
    k.behaviour.run = async () => ({ ok: true, value: "x".repeat(4000) })
    const { task } = await k.submit("fixtures.cooperativeRead", { value: "a" })
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "FAILED", errorCode: "EXECUTION_FAILED", errorDetailCode: "RESULT_TOO_LARGE", result: null })
    expect(k.calls.count).toBe(1)
  })

  it("output violating the Phase 3 contract is rejected by the resolver: nothing stored, ever", async () => {
    // The resolver reports a contract violation as INTERNAL_ERROR, which a
    // SAFE_RETRY read retries; a CONDITIONAL write is never retried after dispatch.
    for (const [capabilityId, calls, code] of [
      ["fixtures.cooperativeRead", 3, "RETRY_EXHAUSTED"],
      ["fixtures.conditionalWrite", 1, "EXECUTION_FAILED"],
    ] as const) {
      const k = await buildTaskKit()
      k.behaviour.run = async () => ({ ok: "yes" })
      const { task } = await k.submit(capabilityId, { value: "a" })
      await k.drain()
      expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "FAILED", errorCode: code, errorDetailCode: "INTERNAL_ERROR", result: null })
      expect(k.calls.count).toBe(calls)
    }
  })
})

describe("H / C — crash recovery without duplicate execution", () => {
  it("store unavailable when the job arrives: the worker throws (BullMQ redelivers) and claims nothing", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const job = k.queue.take()!
    k.fake.client.agentTask.findUnique.mockRejectedValueOnce(new Error("ECONNRESET"))
    await expect(k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId })).rejects.toThrow()
    expect(k.taskByRef(task.taskRef)!.status).toBe("QUEUED")
    await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId })
    expect(k.taskByRef(task.taskRef)!.status).toBe("SUCCEEDED")
    expect(k.calls.count).toBe(1)
  })

  it("redelivery of a claimed-but-never-dispatched attempt (STARTING) is retried", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const row = k.taskByRef(task.taskRef)!
    Object.assign(row, { status: "STARTING", attempts: 1, attemptStartedAt: k.state.now }) // the previous worker died here
    const job = k.queue.take()!
    await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId })
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "RETRY_QUEUED", errorDetailCode: "WORKER_INTERRUPTED" })
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "SUCCEEDED", attempts: 2 })
    expect(k.calls.count).toBe(1)
  })

  it("redelivery mid-run: SAFE_RETRY re-runs; CONDITIONAL_RETRY is marked FAILED instead of executing twice", async () => {
    for (const [capabilityId, expected] of [
      ["fixtures.cooperativeRead", "SUCCEEDED"],
      ["fixtures.conditionalWrite", "FAILED"],
    ] as const) {
      const k = await buildTaskKit()
      const { task } = await k.submit(capabilityId, { value: "a" })
      Object.assign(k.taskByRef(task.taskRef)!, { status: "RUNNING", attempts: 1, attemptStartedAt: k.state.now })
      const job = k.queue.take()!
      await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId })
      await k.drain()
      expect(k.taskByRef(task.taskRef)!.status).toBe(expected)
      if (expected === "FAILED") {
        expect(k.taskByRef(task.taskRef)).toMatchObject({ errorCode: "EXECUTION_FAILED", errorDetailCode: "WORKER_INTERRUPTED" })
        expect(k.calls.count).toBe(0)
      }
    }
  })

  it("a stale job for an old attempt never runs the task again", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const first = k.queue.enqueued[0]
    await k.drain()
    expect(k.calls.count).toBe(1)
    await k.worker.process({ name: k.AGENT_TASK_JOBS.EXECUTE, data: first.payload, id: first.jobId })
    expect(k.calls.count).toBe(1)
    expect(k.taskByRef(task.taskRef)!.status).toBe("SUCCEEDED")
  })
})
