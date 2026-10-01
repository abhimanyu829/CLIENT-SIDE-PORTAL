/**
 * Cross-phase scenarios 1–12 (Phases 2–10), each end to end over the REAL
 * stack: MCP server (5) -> identity (2) -> registry (3) -> ExecutionGate
 * (7) over the policy engine (6) -> task engine / worker (8) -> adapters (4),
 * triggers (9) and the governance routes / pages (10).
 *
 *   1 async end to end                   7 approval invalidated by a policy change
 *   2 approval + async, single use       8 connection revoked while pending
 *   3 platform event -> task             9 autonomy narrowed while queued / at firing
 *   4 signed webhook -> task            10 governance actions stop in-flight automation
 *   5 schedule occurrence -> task       11 replays and duplicates execute once
 *   6 authorization revoked while queued 12 isolation (sub-admin, agent credential, tenants)
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SUB, SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

let k: GovernanceKit
const API = "@/app/api/admin/agent-governance"
const mod = (p: string) => import(p) as Promise<Record<string, unknown>>

beforeEach(async () => {
  k = await buildGovernanceKit()
  k.as(SUPER)
})

async function createTrigger(body: Record<string, unknown>) {
  const res = await k.call(await mod(`${API}/triggers/route`), "POST", { path: "/api/admin/agent-governance/triggers", body })
  expect(res.status).toBe(201)
  return res.json as { trigger: { triggerRef: string; version: number }; webhookSecret?: string }
}
async function act(ref: string, action: string, expectedVersion: number) {
  const res = await k.call(await mod(`${API}/triggers/[ref]/${action}/route`), "POST", { path: `/api/admin/agent-governance/triggers/${ref}/${action}`, params: { ref }, body: { expectedVersion } })
  return res
}
async function activeWebhook(capabilityId = "products.get", extra: Record<string, unknown> = { bindResource: true }) {
  const { trigger, webhookSecret } = await createTrigger({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId, ...extra })
  expect((await act(trigger.triggerRef, "activate", 1)).status).toBe(200)
  return { ref: trigger.triggerRef, secret: webhookSecret! }
}
const productReads = (spy = vi.spyOn(k.exec.client.product, "findUnique")) => spy
const approvalRefIn = (text: string) => /apr_[0-9a-f]{32}/.exec(text)?.[0]

describe("Cross-phase scenarios", () => {
  it("1 — async end to end: MCP submit -> queue -> worker -> adapter -> agent reads its result", async () => {
    await k.allowRead("products.get")
    const submitted = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    expect(submitted.isError).toBe(false)
    expect(submitted.json).toMatchObject({ status: "QUEUED", created: true, origin: "AGENT" })
    expect(submitted.text).not.toMatch(/"taskId"|inputDigest/)
    await k.drain()
    const status = await k.tool("agent_task_status", { taskRef: submitted.json.taskRef })
    expect(status.json).toMatchObject({ status: "SUCCEEDED", result: { id: "prod_1", name: "Alpha" } })
    const page = await k.render(await import("@/app/(admin)/admin/agent-governance/tasks/page"))
    expect(page.html).toContain(submitted.json.taskRef)
    expect(page.html).not.toContain("Alpha")
  })

  it("2 — approval + async: required -> human approves (step-up) -> one bound task -> executes once; reuse needs a new approval", async () => {
    await k.allowRead("products.get")
    await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"], actorId: SUPER })
    const first = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    expect(first.text.startsWith("APPROVAL_REQUIRED:")).toBe(true)
    const ref = approvalRefIn(first.text)!
    const listed = await k.governance.listApprovals({ status: "PENDING", page: 1 })
    expect(listed.rows.map((r) => r.publicRef)).toEqual([ref])
    await k.approve(ref)
    const second = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    expect(second.json).toMatchObject({ status: "QUEUED", created: true })
    const reads = productReads()
    await k.drain()
    expect(reads).toHaveBeenCalledTimes(1)
    const detail = await k.governance.getTaskDetail(second.json.taskRef)
    expect(detail).toMatchObject({ status: "SUCCEEDED", approvalRef: ref })
    const third = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    expect(third.text.startsWith("APPROVAL_REQUIRED:")).toBe(true)
  })

  it("3 — platform event -> human-configured trigger -> authorized task -> adapter", async () => {
    await k.allowRead("products.get")
    const { trigger } = await createTrigger({ type: "EVENT", name: "On update", connectionId: "conn_1", capabilityId: "products.get", bindResource: true, event: { eventType: "PRODUCT_UPDATED" } })
    await act(trigger.triggerRef, "activate", 1)
    const { notifyAgentEventTriggers } = await import("../triggers/event-intake")
    const jobs: Array<{ data: unknown; id: string }> = []
    await notifyAgentEventTriggers(
      { type: "PRODUCT_UPDATED", timestamp: new Date().toISOString(), actorId: "owner_1", payload: { productId: "prod_2", productName: "Private name" } } as never,
      { enabled: () => true, enqueue: async (data, id) => (jobs.push({ data, id }), { id }) }
    )
    await k.runtime.process({ name: k.AGENT_TASK_JOBS.TRIGGER_EVENT, data: jobs[0].data, id: jobs[0].id })
    await k.drain()
    const tasks = await k.governance.listTasks({ origin: "TRIGGER", page: 1 })
    expect(tasks.rows).toHaveLength(1)
    expect(tasks.rows[0]).toMatchObject({ status: "SUCCEEDED", resourceType: "Product", resourceId: "prod_2" })
    expect(JSON.stringify(jobs)).not.toContain("Private name")
  })

  it("4 — signed webhook -> task -> adapter; the response carries no task data", async () => {
    await k.allowRead("products.get")
    const { ref, secret } = await activeWebhook()
    const res = await k.deliver(ref, k.signedWebhook(ref, secret, { resourceId: "prod_1", capabilityId: "refunds.process" }))
    expect(res.status).toBe(202)
    expect(Object.keys(res.json).sort()).toEqual(["accepted", "duplicate", "runRef"])
    await k.drain()
    const detail = await k.governance.getTriggerDetail(ref, 1)
    expect(detail!.runs.rows[0]).toMatchObject({ status: "TASK_CREATED", taskStatus: "SUCCEEDED" })
  })

  it("5 — schedule occurrence -> task, once per occurrence", async () => {
    await k.allowRead("products.list")
    const { trigger } = await createTrigger({ type: "SCHEDULE", name: "Hourly", connectionId: "conn_1", capabilityId: "products.list", input: { limit: 5 }, schedule: { kind: "CRON", cron: "0 * * * *", timezone: "UTC" } })
    await act(trigger.triggerRef, "activate", 1)
    const row = k.triggerRow(trigger.triggerRef)!
    k.approval._triggers.set(row.id, { ...row, nextRunAt: new Date(Date.now() - 1_000) })
    await Promise.all([k.runtime.runScheduleTick(), k.runtime.runScheduleTick()])
    await k.drain()
    const tasks = await k.governance.listTasks({ origin: "TRIGGER", page: 1 })
    expect(tasks.rows).toHaveLength(1)
    expect(tasks.rows[0].status).toBe("SUCCEEDED")
    expect(k.triggerRow(trigger.triggerRef)!.nextRunAt.getTime()).toBeGreaterThan(Date.now())
  })

  it("6 — authorization revoked (governance kill switch) while queued -> never executes", async () => {
    const policy = await k.allowRead("products.get")
    const submitted = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    const res = await k.call(await mod(`${API}/policies/[id]/disable/route`), "POST", { path: "/x", params: { id: policy.policyId }, body: { reason: "incident" } })
    expect(res.status).toBe(200)
    const reads = productReads()
    await k.drain()
    expect(reads).not.toHaveBeenCalled()
    expect(k.taskRow(submitted.json.taskRef)).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED" })
  })

  it("7 — an approval-bound task is invalidated when the autonomy policy changes before it runs", async () => {
    await k.allowRead("products.get")
    await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"], actorId: SUPER })
    const first = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    await k.approve(approvalRefIn(first.text)!)
    const queued = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    const put = await k.call(await mod("@/app/api/admin/agent-connections/[id]/autonomy/route"), "PUT", {
      path: "/api/admin/agent-connections/conn_1/autonomy",
      params: { id: "conn_1" },
      body: { expectedVersion: 1, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"], note: "tightened" },
    })
    expect(put.status).toBe(200)
    const reads = productReads()
    await k.drain()
    expect(reads).not.toHaveBeenCalled()
    expect(k.taskRow(queued.json.taskRef)).toMatchObject({ status: "EXPIRED", errorCode: "APPROVAL_EXPIRED", errorDetailCode: "APPROVAL_POLICY_CHANGED" })
  })

  it("8 — connection revoked while work is pending: the task never runs, triggers are revoked, webhooks stop", async () => {
    await k.allowRead("products.get")
    const { ref, secret } = await activeWebhook()
    const submitted = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    const res = await k.call(await mod("@/app/api/admin/agent-connections/[id]/revoke/route"), "POST", { path: "/x", params: { id: "conn_1" }, body: {} })
    expect(res.status).toBe(200)
    const reads = productReads()
    await k.drain()
    expect(reads).not.toHaveBeenCalled()
    expect(k.taskRow(submitted.json.taskRef)).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED" })
    expect(k.triggerRow(ref)!.status).toBe("REVOKED")
    expect((await k.deliver(ref, k.signedWebhook(ref, secret, { resourceId: "prod_1" }))).status).toBe(404)
  })

  it("9 — autonomy narrowed: the current policy wins for queued tasks and new firings", async () => {
    await k.allowRead("products.get")
    const { ref, secret } = await activeWebhook()
    const submitted = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })
    await k.call(await mod("@/app/api/admin/agent-connections/[id]/autonomy/route"), "PUT", {
      path: "/x",
      params: { id: "conn_1" },
      body: { expectedVersion: 0, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", allowedCapabilityIds: ["tickets.list"] },
    })
    await k.drain()
    expect(k.taskRow(submitted.json.taskRef)).toMatchObject({ status: "EXPIRED", errorCode: "AUTHORIZATION_REVOKED" })
    expect((await k.deliver(ref, k.signedWebhook(ref, secret, { resourceId: "prod_2" }))).status).toBe(202)
    const runs = (await k.governance.getTriggerDetail(ref, 1))!.runs.rows
    expect(runs[0]).toMatchObject({ status: "DENIED", errorCode: "AUTHORIZATION_DENIED", taskRef: null })
  })

  it("10 — governance actions stop in-flight automation: cancel the queued task, pause the trigger, kill the policy", async () => {
    const policy = await k.allowRead("products.get")
    const { ref, secret } = await activeWebhook("products.get", { bindResource: true, concurrency: "ALLOW_PARALLEL" })
    await k.deliver(ref, k.signedWebhook(ref, secret, { resourceId: "prod_1" }))
    const taskRef = (await k.governance.getTriggerDetail(ref, 1))!.runs.rows[0].taskRef!
    const cancel = await k.call(await mod(`${API}/tasks/[ref]/cancel/route`), "POST", { path: "/x", params: { ref: taskRef }, body: { expectedStatus: "QUEUED", reason: "stop" } })
    expect(cancel.json).toMatchObject({ outcome: "CANCELLED" })
    const reads = productReads()
    await k.drain()
    expect(reads).not.toHaveBeenCalled()

    expect((await act(ref, "pause", 2)).status).toBe(200)
    expect((await k.deliver(ref, k.signedWebhook(ref, secret, { resourceId: "prod_1" }))).status).toBe(404)
    expect((await act(ref, "resume", 3)).status).toBe(200)

    await k.call(await mod(`${API}/policies/[id]/disable/route`), "POST", { path: "/x", params: { id: policy.policyId }, body: {} })
    expect((await k.deliver(ref, k.signedWebhook(ref, secret, { resourceId: "prod_2" }))).status).toBe(202)
    const runs = (await k.governance.getTriggerDetail(ref, 1))!.runs.rows
    expect(runs[0]).toMatchObject({ status: "DENIED", taskRef: null })
    expect(reads).not.toHaveBeenCalled()
  })

  it("11 — replays and duplicates of every kind execute the capability once", async () => {
    await k.allowRead("products.get")
    const { ref, secret } = await activeWebhook("products.get", { bindResource: true, concurrency: "ALLOW_PARALLEL" })
    const original = k.signedWebhook(ref, secret, { resourceId: "prod_1" }, "evt-once")
    const replay = original.clone()
    expect((await k.deliver(ref, original)).status).toBe(202)
    expect((await k.deliver(ref, replay)).status).toBe(409)
    expect((await k.deliver(ref, k.signedWebhook(ref, secret, { resourceId: "prod_1" }, "evt-once"))).status).toBe(200)
    const a = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_2" }, idempotencyKey: "order-12345" })
    const b = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_2" }, idempotencyKey: "order-12345" })
    expect(b.json).toMatchObject({ taskRef: a.json.taskRef, created: false })
    const reads = productReads()
    await k.drain()
    await k.drain()
    expect(reads).toHaveBeenCalledTimes(2)
  })

  it("12 — isolation: sub-admins and agent credentials cannot govern; agents never see another tenant's tasks", async () => {
    await k.allowRead("products.get")
    const { ref, secret } = await activeWebhook()
    await k.deliver(ref, k.signedWebhook(ref, secret, { resourceId: "prod_1" }))
    const taskRef = (await k.governance.getTriggerDetail(ref, 1))!.runs.rows[0].taskRef!
    // conn_2's agent cannot read conn_1's trigger task.
    const foreign = await k.tool("agent_task_status", { taskRef }, k.agentCtx("conn_2", "owner_2"))
    expect(foreign.text.startsWith("TASK_NOT_FOUND:")).toBe(true)
    const own = await k.tool("agent_task_status", { taskRef })
    expect(own.json).toMatchObject({ taskRef, origin: "TRIGGER" })
    // A sub-admin with every permission cannot open or act.
    k.as(SUB)
    expect((await k.render(await import("@/app/(admin)/admin/agent-governance/tasks/page"))).redirect).toBe("/unauthorized")
    expect((await k.call(await mod(`${API}/tasks/[ref]/cancel/route`), "POST", { path: "/x", params: { ref: taskRef }, body: { expectedStatus: "QUEUED" } })).redirect).toBe("/unauthorized")
    // An agent credential cannot act even with an administrator's session.
    k.as(SUPER)
    const withToken = await k.call(await mod(`${API}/triggers/[ref]/pause/route`), "POST", { path: "/x", params: { ref }, body: { expectedVersion: 2 }, headers: { authorization: `Bearer agw_${"b".repeat(64)}` } })
    expect(withToken.status).toBe(401)
    expect(k.triggerRow(ref)!.status).toBe("ACTIVE")
    expect(k.taskRow(taskRef)!.status).toBe("QUEUED")
  })
})
