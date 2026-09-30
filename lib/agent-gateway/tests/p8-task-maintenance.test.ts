/**
 * Phase 8 — sweep / reconcile / retention (H: Redis data loss, worker crash,
 * lost retry step; A.21 retention). Uses the REAL maintenance pass.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildTaskKit } from "./task-test-kit"

beforeEach(() => vi.resetModules())

const DAY = 24 * 60 * 60_000

describe("maintenance — sweep", () => {
  it("expires pending tasks past the queue timeout / deadline and times out abandoned running attempts", async () => {
    const k = await buildTaskKit()
    const pending = await k.submit("fixtures.conditionalWrite", { value: "a" })
    const running = await k.submit("fixtures.conditionalWrite", { value: "b" })
    Object.assign(k.taskByRef(running.task.taskRef)!, { status: "RUNNING", attempts: 1, attemptStartedAt: k.state.now })
    k.advance(k.config.queueTimeoutMs)
    const report = await k.maintenance.runTaskMaintenance({ queue: k.queue, config: k.config, clock: () => k.state.now })
    expect(report).toMatchObject({ expired: 1, timedOut: 1, errors: 0 })
    expect(k.taskByRef(pending.task.taskRef)).toMatchObject({ status: "EXPIRED", errorCode: "TASK_EXPIRED" })
    expect(k.taskByRef(running.task.taskRef)).toMatchObject({ status: "TIMED_OUT", errorCode: "TASK_TIMEOUT" })
  })
})

describe("maintenance — reconcile", () => {
  it("Redis lost the job: a pending task is re-enqueued under its deterministic job id, then runs once", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    k.queue.jobs.clear() // Redis restarted without persistence
    const report = await k.maintenance.runTaskMaintenance({ queue: k.queue, config: k.config, clock: () => k.state.now })
    expect(report.requeued).toBe(1)
    await k.drain()
    expect(k.taskByRef(task.taskRef)!.status).toBe("SUCCEEDED")
    expect(k.calls.count).toBe(1)
    // Idempotent: with the job present nothing is re-added.
    const again = await k.maintenance.runTaskMaintenance({ queue: k.queue, config: k.config, clock: () => k.state.now })
    expect(again.requeued).toBe(0)
  })

  it("a worker that died between claim and dispatch (stale STARTING) is recovered as a retry", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    k.queue.jobs.clear()
    Object.assign(k.taskByRef(task.taskRef)!, { status: "STARTING", attempts: 1, attemptStartedAt: k.state.now })
    k.advance(k.config.startingGraceMs)
    const report = await k.maintenance.runTaskMaintenance({ queue: k.queue, config: k.config, clock: () => k.state.now })
    expect(report.recoveredStarting).toBe(1)
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "SUCCEEDED", attempts: 2 })
    expect(k.calls.count).toBe(1)
  })

  it("a retry whose RETRY_QUEUED step was lost is completed", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.cooperativeRead", { value: "a" })
    k.queue.jobs.clear()
    Object.assign(k.taskByRef(task.taskRef)!, { status: "FAILED", attempts: 1, retryScheduled: true, failedAt: k.state.now })
    k.advance(60_000)
    const report = await k.maintenance.runTaskMaintenance({ queue: k.queue, config: k.config, clock: () => k.state.now })
    expect(report.retriesCompleted).toBe(1)
    expect(k.taskByRef(task.taskRef)!.status).toBe("RETRY_QUEUED")
    await k.drain()
    expect(k.taskByRef(task.taskRef)).toMatchObject({ status: "SUCCEEDED", attempts: 2 })
  })

  it("queue unavailable during reconcile: the pass records the failure and changes nothing unsafe", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    k.queue.jobs.clear()
    k.queue.failEnqueue = true
    const report = await k.maintenance.runTaskMaintenance({ queue: k.queue, config: k.config, clock: () => k.state.now })
    expect(report.errors).toBe(1)
    expect(k.taskByRef(task.taskRef)!.status).toBe("QUEUED")
  })

  it("the worker's MAINTENANCE job runs the same pass", async () => {
    const k = await buildTaskKit()
    const { task } = await k.submit("fixtures.conditionalWrite", { value: "a" })
    k.advance(k.config.queueTimeoutMs)
    await k.worker.process({ name: k.AGENT_TASK_JOBS.MAINTENANCE, data: {} })
    expect(k.taskByRef(task.taskRef)!.status).toBe("EXPIRED")
  })
})

describe("maintenance — retention", () => {
  it("drops old results, then old terminal rows; never touches non-terminal tasks", async () => {
    const k = await buildTaskKit()
    const done = await k.submit("fixtures.conditionalWrite", { value: "a" })
    await k.drain()
    const live = await k.submit("fixtures.conditionalWrite", { value: "b" })
    const me = { connectionId: "conn_1", ownerId: "owner_1" }

    k.advance(8 * DAY)
    Object.assign(k.taskByRef(live.task.taskRef)!, { expiresAt: new Date(k.state.now.getTime() + 60 * 60_000), queuedAt: k.state.now })
    let report = await k.maintenance.runTaskMaintenance({ queue: k.queue, config: k.config, clock: () => k.state.now })
    expect(report.resultsCleared).toBe(1)
    expect(k.taskByRef(done.task.taskRef)).toMatchObject({ status: "SUCCEEDED", result: null })
    const view = await k.service.getStatus(me, done.task.taskRef)
    expect(view.resultUnavailable).toBe("REMOVED")

    k.advance(23 * DAY)
    Object.assign(k.taskByRef(live.task.taskRef)!, { expiresAt: new Date(k.state.now.getTime() + 60 * 60_000), queuedAt: k.state.now })
    report = await k.maintenance.runTaskMaintenance({ queue: k.queue, config: k.config, clock: () => k.state.now })
    expect(report.deleted).toBe(1)
    expect(k.taskByRef(done.task.taskRef)).toBeUndefined()
    expect(k.taskByRef(live.task.taskRef)!.status).toBe("QUEUED")
  })
})
