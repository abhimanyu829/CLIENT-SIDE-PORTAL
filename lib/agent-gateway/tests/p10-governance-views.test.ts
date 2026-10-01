/**
 * Phase 10 — governance read models: C capability catalog, F approvals,
 * G tasks, H trigger detail / schedules / webhooks, I runtime snapshot,
 * plus server-side pagination, allowlisted filters and redaction (no
 * secrets, hashes, inputs or results in any view).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

let k: GovernanceKit

beforeEach(async () => {
  k = await buildGovernanceKit()
})

const MIN = 60_000

describe("Phase 10 — pagination and filter primitives", () => {
  it("parsePage clamps to [1, MAX_PAGE] and ignores junk; pageMeta is exact", () => {
    const { parsePage, pageMeta, MAX_PAGE, PAGE_SIZE } = k.governance
    expect([undefined, "", "0", "-3", "abc", "1.5", "2"].map((v) => parsePage(v))).toEqual([1, 1, 1, 1, 1, 1, 2])
    expect(parsePage("999999")).toBe(MAX_PAGE)
    expect(PAGE_SIZE).toBe(20)
    expect(pageMeta(0, 1)).toMatchObject({ totalPages: 1, hasPrev: false, hasNext: false })
    expect(pageMeta(41, 2)).toMatchObject({ totalPages: 3, hasPrev: true, hasNext: true })
    expect(pageMeta(40, 2)).toMatchObject({ totalPages: 2, hasNext: false })
  })

  it("filters accept allowlisted values only", () => {
    const { pickEnum, pickId } = k.governance
    expect(pickEnum("ACTIVE", ["ACTIVE", "PAUSED"] as const)).toBe("ACTIVE")
    for (const bad of ["active", "ACTIVE'--", { in: ["ACTIVE"] }, ["ACTIVE"], 1]) expect(pickEnum(bad, ["ACTIVE"] as const)).toBeUndefined()
    expect(pickId("conn_1", /^[A-Za-z0-9_-]{1,64}$/)).toBe("conn_1")
    for (const bad of ["../x", "a b", "x".repeat(65), { contains: "a" }]) expect(pickId(bad, /^[A-Za-z0-9_-]{1,64}$/)).toBeUndefined()
  })
})

describe("Phase 10 C — capability governance (the Phase 3 registry is the only source)", () => {
  it("the catalog is exactly the registry, with derived governance metadata", async () => {
    const rows = await k.governance.listCapabilities()
    const registry = k.registry.list({ includeDisabled: true, includeForbidden: true })
    expect(rows.map((r) => `${r.id}@v${r.version}`).sort()).toEqual(registry.map((d) => `${d.id}@v${d.version}`).sort())
    const get = rows.find((r) => r.id === "products.get")!
    expect(get).toMatchObject({ riskTier: "READ", exposure: "AGENT_AVAILABLE", asyncSupported: true, retryClass: "SAFE_RETRY", mandatoryApproval: null })
    const critical = rows.find((r) => r.riskTier === "CRITICAL")
    if (critical) expect(critical.mandatoryApproval).toBe("CRITICAL_RISK_TIER")
  })

  it("filters and live reference counts", async () => {
    expect((await k.governance.listCapabilities({ asyncOnly: true })).every((r) => r.asyncSupported)).toBe(true)
    expect((await k.governance.listCapabilities({ riskTier: "READ" })).every((r) => r.riskTier === "READ")).toBe(true)
    expect((await k.governance.listCapabilities({ exposure: "AGENT_AVAILABLE" })).every((r) => r.exposure === "AGENT_AVAILABLE")).toBe(true)
    await k.allowRead("products.get")
    const { trigger } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.get", bindResource: true }, SUPER)
    await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)
    const get = (await k.governance.listCapabilities()).find((r) => r.id === "products.get")!
    expect(get.references).toEqual({ policies: 1, triggers: 1 })
  })

  it("only async, agent-available, active capabilities are offered to triggers", () => {
    for (const d of k.governance.triggerableCapabilities()) {
      expect(d).toMatchObject({ status: "ACTIVE", exposure: "AGENT_AVAILABLE" })
      expect(d.async.asyncSupported).toBe(true)
    }
  })
})

describe("Phase 10 F — approval management (read-only; deciding stays in the Phase 7 flow)", () => {
  /**
   * Pending requests are bounded per connection (P14-F3,
   * MAX_PENDING_APPROVALS_PER_CONNECTION = 20), so a 25-row page set is
   * seeded across two connections.
   */
  async function seedApprovals(perConnection: Array<[connectionId: string, ownerId: string, count: number]>) {
    await k.allowRead("products.get")
    let i = 0
    for (const [connectionId, ownerId, count] of perConnection) {
      await k.autonomyStore.setAutonomyPolicy({ connectionId, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"], actorId: SUPER })
      for (let n = 0; n < count; n += 1, i += 1) {
        await k.taskService.submit(k.agentCtx(connectionId, ownerId), "development", { capabilityId: "products.get", input: { id: `prod_${i}` } }).catch(() => undefined)
      }
    }
  }

  it("lists with status / connection filters, display-time expiry, and server-side pages", async () => {
    await seedApprovals([
      ["conn_1", "owner_1", 13],
      ["conn_2", "owner_2", 12],
    ])
    const page1 = await k.governance.listApprovals({ status: "PENDING", page: 1 })
    expect(page1.meta).toMatchObject({ total: 25, totalPages: 2, page: 1 })
    expect(page1.rows).toHaveLength(20)
    expect((await k.governance.listApprovals({ status: "PENDING", page: 2 })).rows).toHaveLength(5)
    expect((await k.governance.listApprovals({ connectionId: "conn_1", page: 1 })).meta.total).toBe(13)
    expect((await k.governance.listApprovals({ connectionId: "conn_2", page: 1 })).meta.total).toBe(12)
    const later = new Date(Date.now() + 365 * 24 * 60 * MIN)
    const expired = await k.governance.listApprovals({ status: "EXPIRED", page: 1 }, later)
    expect(expired.meta.total).toBe(25)
    expect(expired.rows.every((r) => r.effectiveStatus === "EXPIRED" && r.status === "PENDING")).toBe(true)
    expect((await k.governance.listApprovals({ status: "PENDING", page: 1 }, later)).meta.total).toBe(0)
    const blob = JSON.stringify(page1)
    expect(blob).not.toMatch(/bindingDigest|displaySummary|stepUpCodeHash/)
  })

  it("governance exposes no approve / decide operation", () => {
    expect(Object.keys(k.governance).filter((name) => /approve|decide|stepup/i.test(name))).toEqual([])
  })
})

describe("Phase 10 G — task views", () => {
  it("filters by status, origin, capability and connection, paginated on the server", async () => {
    await k.allowRead("products.get")
    await k.allowRead("products.list")
    for (let i = 0; i < 45; i += 1) await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: `p${i}` } })
    await k.taskService.submit(k.agentCtx("conn_2", "owner_2"), "development", { capabilityId: "products.list", input: {} })
    const { trigger, webhookSecret } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.list" }, SUPER)
    await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)
    expect((await k.deliver(trigger.triggerRef, k.signedWebhook(trigger.triggerRef, webhookSecret!, {}))).status).toBe(202)

    const all = await k.governance.listTasks({ page: 1 })
    expect(all.meta).toMatchObject({ total: 47, totalPages: 3 })
    expect(all.rows).toHaveLength(20)
    expect((await k.governance.listTasks({ page: 3 })).rows).toHaveLength(7)
    expect((await k.governance.listTasks({ page: 9 })).rows).toHaveLength(0)
    expect((await k.governance.listTasks({ origin: "TRIGGER", page: 1 })).rows.map((r) => r.origin)).toEqual(["TRIGGER"])
    expect((await k.governance.listTasks({ origin: "AGENT", page: 1 })).meta.total).toBe(46)
    expect((await k.governance.listTasks({ capabilityId: "products.list", page: 1 })).meta.total).toBe(2)
    expect((await k.governance.listTasks({ connectionId: "conn_2", page: 1 })).meta.total).toBe(1)
    expect((await k.governance.listTasks({ status: "SUCCEEDED", page: 1 })).meta.total).toBe(0)
  })

  it("the task view never contains the input, result, digests or idempotency scope", async () => {
    await k.allowRead("products.get")
    const { task } = await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: "prod_2" } }, undefined)
    await k.drain()
    const row = k.taskRow(task.taskRef)!
    expect(row.status).toBe("SUCCEEDED")
    const view = (await k.governance.getTaskDetail(task.taskRef))!
    expect(view).toMatchObject({ status: "SUCCEEDED", resultState: "STORED", origin: "AGENT", hasIdempotencyKey: false })
    const blob = JSON.stringify(view)
    for (const forbidden of ["Beta", row.inputDigest, "inputDigest", "idempotencyScope", "activeOperationKey", '"result"', '"input"']) expect(blob).not.toContain(forbidden)
    expect(await k.governance.getTaskDetail(`atk_${"0".repeat(32)}`)).toBeNull()
  })
})

describe("Phase 10 H — trigger detail, schedules and webhooks views", () => {
  it("trigger detail: run pages with linked task refs; webhook secret never present", async () => {
    await k.allowRead("products.list")
    const { trigger, webhookSecret } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.list", concurrency: "ALLOW_PARALLEL" }, SUPER)
    await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)
    for (let i = 0; i < 23; i += 1) await k.deliver(trigger.triggerRef, k.signedWebhook(trigger.triggerRef, webhookSecret!, {}, `evt_${i}`))
    const first = (await k.governance.getTriggerDetail(trigger.triggerRef, 1))!
    expect(first.runs.meta).toMatchObject({ total: 23, totalPages: 2 })
    expect(first.runs.rows).toHaveLength(20)
    expect(first.runs.rows.every((r) => r.status === "TASK_CREATED" && /^atk_/.test(r.taskRef ?? ""))).toBe(true)
    expect((await k.governance.getTriggerDetail(trigger.triggerRef, 2))!.runs.rows).toHaveLength(3)
    const blob = JSON.stringify(first)
    expect(blob).not.toContain(webhookSecret!)
    expect(blob).not.toContain(String(k.triggerRow(trigger.triggerRef)!.webhookSecretRef))
    const webhooks = await k.governance.listWebhooks({ page: 1 })
    expect(webhooks.rows[0]).toMatchObject({ runsLast24h: 23 })
    expect(await k.governance.getTriggerDetail(`trg_${"0".repeat(32)}`, 1)).toBeNull()
  })

  it("schedules show the next occurrences in the schedule's timezone", async () => {
    const { trigger } = await k.triggerService.create(
      { type: "SCHEDULE", name: "Weekday mornings", connectionId: "conn_1", capabilityId: "products.list", schedule: { kind: "CRON", cron: "0 9 * * 1-5", timezone: "Asia/Kolkata" } },
      SUPER
    )
    const active = await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)
    const rows = (await k.governance.listSchedules({ page: 1 })).rows
    expect(rows).toHaveLength(1)
    expect(rows[0].upcoming).toHaveLength(3)
    expect(rows[0].upcoming[0]).toBe(active.schedule!.nextRunAt)
    // 09:00 in Asia/Kolkata is 03:30 UTC, on weekdays only.
    for (const iso of rows[0].upcoming) {
      expect(iso.slice(11, 16)).toBe("03:30")
      expect([1, 2, 3, 4, 5]).toContain(new Date(iso).getUTCDay())
    }
  })
})

describe("Phase 10 I — runtime / health snapshot", () => {
  it("degrades per dependency (not configured / unreachable / ok) and never leaks connection strings", async () => {
    const notConfigured = await k.governance.getRuntimeSnapshot(new Date(), { queueConfigured: () => false, gatewayHealth: async () => ({ status: "ok", gateway: "ready", dependencies: { redis: "disabled", backend: "ok" } }) })
    expect(notConfigured.queue).toEqual({ state: "not-configured", counts: null })
    expect(notConfigured.redisControls).toBe("not-configured")
    const down = await k.governance.getRuntimeSnapshot(new Date(), { queueConfigured: () => true, queueCounts: async () => Promise.reject(new Error("ECONNREFUSED redis://secret-host:6379")) })
    expect(down.queue.state).toBe("unavailable")
    const ok = await k.governance.getRuntimeSnapshot(new Date(), { queueConfigured: () => true, queueCounts: async () => ({ waiting: 3, active: 1, delayed: 2, failed: 0, completed: 9 }) })
    expect(ok.queue).toEqual({ state: "ok", counts: { waiting: 3, active: 1, delayed: 2, failed: 0, completed: 9 } })
    const blob = JSON.stringify([notConfigured, down, ok])
    for (const forbidden of ["secret-host", "redis://", "postgresql://", process.env.DATABASE_URL ?? "postgresql://"]) expect(blob).not.toContain(forbidden)
  })

  it("detects stuck tasks, overdue schedules and the approval backlog", async () => {
    await k.allowRead("products.get")
    const { task } = await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: "prod_1" } })
    const row = k.taskRow(task.taskRef)!
    k.approval._tasks.set(row.id, { ...row, status: "STARTING", attempts: 1, attemptStartedAt: new Date(Date.now() - 30 * MIN) })
    const { trigger } = await k.triggerService.create({ type: "SCHEDULE", name: "Hourly", connectionId: "conn_1", capabilityId: "products.list", schedule: { kind: "CRON", cron: "0 * * * *", timezone: "UTC" } }, SUPER)
    await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)
    const t = k.triggerRow(trigger.triggerRef)!
    k.approval._triggers.set(t.id, { ...t, nextRunAt: new Date(Date.now() - 20 * MIN) })
    const snap = await k.governance.getRuntimeSnapshot(new Date(), { queueConfigured: () => false })
    expect(snap.tasks).toMatchObject({ stuckStarting: 1, stuckRefs: [task.taskRef] })
    expect(snap.schedules.overdue).toBe(1)
    expect(snap.flags).toMatchObject({ tasks: false, triggers: false })
  })

  it("the overview counts reflect live state", async () => {
    await k.allowRead("products.get")
    await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: "prod_1" } })
    const { trigger } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.list" }, SUPER)
    await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)
    k.approval.updateConnection("conn_2", { status: "SUSPENDED" })
    const o = await k.governance.getOverview()
    expect(o.connections).toMatchObject({ ACTIVE: 1, SUSPENDED: 1 })
    expect(o.tasks.QUEUED).toBe(1)
    expect(o.tasksLast24h).toBe(1)
    expect(o.triggers.ACTIVE).toBe(1)
    expect(o.triggersByType.WEBHOOK).toBe(1)
  })
})
