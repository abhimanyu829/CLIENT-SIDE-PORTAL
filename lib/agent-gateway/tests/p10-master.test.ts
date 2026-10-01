/**
 * Master tests across Phases 8–10:
 *   - the 19-step master end-to-end scenario (an administrator provisions,
 *     governs and finally revokes an agent; the agent works over MCP,
 *     webhooks, events and schedules in between);
 *   - the master security test (one probe per attack surface, each must fail
 *     closed and leave state unchanged);
 *   - the master performance test (in-memory budgets; numbers reported).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SUB, SUPER, SUPER_2, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 })

let k: GovernanceKit
const API = "@/app/api/admin/agent-governance"
const PAGE = "@/app/(admin)/admin/agent-governance"
const mod = (p: string) => import(p) as Promise<Record<string, unknown>>
const page = (p: string) => import(`${PAGE}/${p}`) as Promise<{ default: (props: unknown) => unknown }>

beforeEach(async () => {
  k = await buildGovernanceKit()
  k.as(SUPER)
})

describe("Master end-to-end scenario (19 steps)", () => {
  it("provision -> govern -> automate -> approve -> conflict -> kill switch -> revoke, with nothing secret leaking anywhere", async () => {
    const secretsSeen: string[] = []
    const responses: string[] = []
    const remember = (r: { text?: string }) => (responses.push(r.text ?? ""), r)

    // 1. A super administrator registers an agent connection; the credential is shown once
    //    (this one response is the only place it may appear, so it is not collected).
    const created = await k.call(await mod("@/app/api/admin/agent-connections/route"), "POST", { path: "/x", body: { name: "Catalog agent", provider: "claude", ownerId: "owner_1" } })
    const token: string = created.json.credential.bearerToken
    const connectionId: string = created.json.connection.id
    secretsSeen.push(token)

    // 2. The agent authenticates with it (Phase 2) — the identity is server-derived.
    const identity = (await k.connectionService().authenticateCredential(token, "BEARER"))!
    expect(identity).toMatchObject({ connectionId, ownerId: "owner_1", connectionStatus: "ACTIVE" })
    const ctx = k.agentCtx(connectionId, "owner_1")

    // 3. Nothing is allowed yet: default deny.
    expect((await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } }, ctx)).text).toMatch(/^AUTHORIZATION_DENIED:/)

    // 4. The administrator publishes Phase 6 allows for two READ capabilities.
    const allowGet = remember(await k.call(await mod(`${API}/policies/route`), "POST", { path: "/x", body: { name: "Catalog reads", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get", riskConstraint: "READ" } }))
    const policyId: string = (allowGet as { json: any }).json.policy.policyId
    remember(await k.call(await mod(`${API}/policies/route`), "POST", { path: "/x", body: { name: "Catalog list", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.list", riskConstraint: "READ" } }))

    // 5. ... and sets the connection's autonomy (v1, optimistic on version 0).
    const autonomy = remember(await k.call(await mod("@/app/api/admin/agent-connections/[id]/autonomy/route"), "PUT", { path: "/x", params: { id: connectionId }, body: { expectedVersion: 0, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ" } }))
    expect((autonomy as { json: any }).json.policy.version).toBe(1)

    // 6. The agent discovers its tools over MCP.
    const tools = await k.mcp("tools/list", {}, ctx)
    const names = (tools.result.tools as Array<{ name: string }>).map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(["products.get", "agent_task_submit", "agent_task_status", "agent_task_cancel"]))

    // 7. The agent submits an async task; the worker runs it through the Phase 4 adapter.
    const submitted = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } }, ctx)
    await k.drain()
    expect((await k.tool("agent_task_status", { taskRef: submitted.json.taskRef }, ctx)).json).toMatchObject({ status: "SUCCEEDED", result: { id: "prod_1" } })

    // 8. The administrator sees the task in governance (state only, no result).
    const tasksPage = await k.render(await page("tasks/page"))
    expect(tasksPage.html).toContain(submitted.json.taskRef)
    expect(tasksPage.html).not.toContain("Alpha")

    // 9. The administrator creates a webhook trigger (secret shown once — not collected) and activates it.
    const hook = await k.call(await mod(`${API}/triggers/route`), "POST", { path: "/x", body: { type: "WEBHOOK", name: "Partner hook", connectionId, capabilityId: "products.get", bindResource: true } })
    const hookRef: string = hook.json.trigger.triggerRef
    const hookSecret: string = hook.json.webhookSecret
    secretsSeen.push(hookSecret, String(k.triggerRow(hookRef)!.webhookSecretRef))
    remember(await k.call(await mod(`${API}/triggers/[ref]/activate/route`), "POST", { path: "/x", params: { ref: hookRef }, body: { expectedVersion: 1 } }))

    // 10. A partner sends a signed delivery -> task -> SUCCEEDED.
    expect((await k.deliver(hookRef, k.signedWebhook(hookRef, hookSecret, { resourceId: "prod_2" }, "partner-1"))).status).toBe(202)
    await k.drain()

    // 11. An event trigger fires on a platform event.
    const ev = remember(await k.call(await mod(`${API}/triggers/route`), "POST", { path: "/x", body: { type: "EVENT", name: "On product update", connectionId, capabilityId: "products.get", bindResource: true, event: { eventType: "PRODUCT_UPDATED", actorScope: "ANY" } } }))
    const evRef: string = (ev as { json: any }).json.trigger.triggerRef
    remember(await k.call(await mod(`${API}/triggers/[ref]/activate/route`), "POST", { path: "/x", params: { ref: evRef }, body: { expectedVersion: 1 } }))
    const { normalizeTriggerEvent } = await import("../triggers/event-catalog")
    await k.runtime.dispatchEvent(normalizeTriggerEvent({ type: "PRODUCT_UPDATED", timestamp: new Date().toISOString(), actorId: "vendor_9", payload: { productId: "prod_1" } } as never)!)
    await k.drain()

    // 12. A schedule trigger fires once for its due occurrence.
    const sch = remember(await k.call(await mod(`${API}/triggers/route`), "POST", { path: "/x", body: { type: "SCHEDULE", name: "Hourly catalog", connectionId, capabilityId: "products.list", input: { limit: 3 }, schedule: { kind: "CRON", cron: "0 * * * *", timezone: "UTC" } } }))
    const schRef: string = (sch as { json: any }).json.trigger.triggerRef
    remember(await k.call(await mod(`${API}/triggers/[ref]/activate/route`), "POST", { path: "/x", params: { ref: schRef }, body: { expectedVersion: 1 } }))
    const schRow = k.triggerRow(schRef)!
    k.approval._triggers.set(schRow.id, { ...schRow, nextRunAt: new Date(Date.now() - 1_000) })
    await k.runtime.runScheduleTick()
    await k.drain()
    const triggerTasks = await k.governance.listTasks({ origin: "TRIGGER", page: 1 })
    expect(triggerTasks.rows).toHaveLength(3)
    expect(triggerTasks.rows.every((t) => t.status === "SUCCEEDED")).toBe(true)

    // 13. The administrator now requires approval for products.get (autonomy v2).
    remember(await k.call(await mod("@/app/api/admin/agent-connections/[id]/autonomy/route"), "PUT", { path: "/x", params: { id: connectionId }, body: { expectedVersion: 1, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"] } }))

    // 14. The next webhook firing does not run: an approval request is filed instead.
    expect((await k.deliver(hookRef, k.signedWebhook(hookRef, hookSecret, { resourceId: "prod_1" }, "partner-2"))).status).toBe(202)
    const pending = await k.governance.listApprovals({ status: "PENDING", page: 1 })
    expect(pending.rows).toHaveLength(1)

    // 15. A human approves through the Phase 7 flow (binding + SMS step-up); the next firing consumes it once.
    await k.approve(pending.rows[0].publicRef)
    expect((await k.deliver(hookRef, k.signedWebhook(hookRef, hookSecret, { resourceId: "prod_1" }, "partner-3"))).status).toBe(202)
    await k.drain()
    const runs = (await k.governance.getTriggerDetail(hookRef, 1))!.runs.rows
    expect(runs.map((r) => r.status)).toEqual(["TASK_CREATED", "APPROVAL_REQUIRED", "TASK_CREATED"])
    expect(runs[0].taskStatus).toBe("SUCCEEDED")

    // 16. A second administrator acting on a stale view gets a CONFLICT; nothing changes.
    k.as(SUPER_2)
    const stale = await k.call(await mod(`${API}/triggers/[ref]/pause/route`), "POST", { path: "/x", params: { ref: hookRef }, body: { expectedVersion: 1 } })
    expect(stale.status).toBe(409)
    expect(k.triggerRow(hookRef)!.status).toBe("ACTIVE")
    k.as(SUPER)

    // 17. Kill switch: the Phase 6 allow is disabled; the next agent request is denied.
    remember(await k.call(await mod(`${API}/policies/[id]/disable/route`), "POST", { path: "/x", params: { id: policyId }, body: { reason: "end of pilot" } }))
    expect((await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_2" } }, ctx)).text).toMatch(/^AUTHORIZATION_DENIED:/)

    // 18. The connection is revoked: credential dead, triggers revoked, webhooks refused.
    remember(await k.call(await mod("@/app/api/admin/agent-connections/[id]/revoke/route"), "POST", { path: "/x", params: { id: connectionId }, body: {} }))
    expect(await k.connectionService().authenticateCredential(token, "BEARER")).toBeNull()
    for (const ref of [hookRef, evRef, schRef]) expect(k.triggerRow(ref)!.status).toBe("REVOKED")
    expect((await k.deliver(hookRef, k.signedWebhook(hookRef, hookSecret, { resourceId: "prod_1" }, "partner-4"))).status).toBe(404)

    // 19. Every governance page renders the final state, and no secret appears anywhere.
    const html: string[] = []
    for (const [p, params] of [
      ["page", {}],
      ["connections/page", {}],
      ["connections/[id]/page", { id: connectionId }],
      ["policies/page", {}],
      ["policies/[id]/page", { id: policyId }],
      ["approvals/page", {}],
      ["tasks/page", {}],
      ["triggers/page", {}],
      ["triggers/[ref]/page", { ref: hookRef }],
      ["webhooks/page", {}],
      ["schedules/page", {}],
      ["runtime/page", {}],
    ] as const) {
      const out = await k.render(await page(p), { params })
      expect(out.html, p).toBeTruthy()
      html.push(out.html!)
    }
    await k.settle()
    const cred = Array.from(k.approval._credentials.values()).find((c) => c.connectionId === connectionId)!
    secretsSeen.push(String(cred.secretHash))
    const everything = [...html, ...responses, JSON.stringify(k.auditEntries())].join("\n")
    for (const s of secretsSeen) expect(everything).not.toContain(s)
    expect(html.join("")).toContain("REVOKED")
  })
})

describe("Master security test", () => {
  it("every probe fails closed and changes nothing", async () => {
    await k.allowRead("products.get")
    const { trigger, webhookSecret } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.get", bindResource: true }, SUPER)
    const ref = trigger.triggerRef
    await k.triggerService.transition(ref, 1, "activate", SUPER)
    const victimTask = (await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" } })).json.taskRef as string
    const snapshot = () =>
      JSON.stringify({
        triggers: Array.from(k.approval._triggers.values()).map((t) => [t.status, t.version]),
        tasks: Array.from(k.approval._tasks.values()).map((t) => [t.taskRef, t.status]),
        policies: Array.from(k.authz._policies.values()).map((p) => p.enabled),
        connections: Array.from(k.approval._connections.values()).map((c) => c.status),
      })
    const before = snapshot()
    const probes: Array<[string, () => Promise<boolean>]> = [
      ["sub-admin with every permission opens governance", async () => (k.as(SUB), (await k.render(await page("triggers/page"))).redirect === "/unauthorized")],
      ["sub-admin with every permission revokes a trigger", async () => (k.as(SUB), (await k.call(await mod(`${API}/triggers/[ref]/revoke/route`), "POST", { path: "/x", params: { ref }, body: { expectedVersion: 2 } })).redirect === "/unauthorized")],
      ["agent bearer token on a governance route", async () => (k.as(SUPER), (await k.call(await mod(`${API}/triggers/[ref]/revoke/route`), "POST", { path: "/x", params: { ref }, body: { expectedVersion: 2 }, headers: { authorization: `Bearer agw_${"c".repeat(64)}` } })).status === 401)],
      ["cross-site form post", async () => (await k.call(await mod(`${API}/policies/route`), "POST", { path: "/x", rawBody: "name=x&effect=ALLOW&scope=GLOBAL", contentType: "application/x-www-form-urlencoded" })).status === 415],
      ["forged owner on a trigger", async () => (await k.call(await mod(`${API}/triggers/route`), "POST", { path: "/x", body: { type: "WEBHOOK", name: "Forged", connectionId: "conn_1", capabilityId: "products.get", ownerId: "owner_2" } })).status === 400],
      ["stale optimistic version", async () => (await k.call(await mod(`${API}/triggers/[ref]/pause/route`), "POST", { path: "/x", params: { ref }, body: { expectedVersion: 1 } })).status === 409],
      ["path traversal in a ref", async () => (await k.call(await mod(`${API}/tasks/[ref]/cancel/route`), "POST", { path: "/x", params: { ref: "../../etc/passwd" }, body: { expectedStatus: "QUEUED" } })).status === 404],
      ["agent reads another tenant's task", async () => (await k.tool("agent_task_status", { taskRef: victimTask }, k.agentCtx("conn_2", "owner_2"))).text.startsWith("TASK_NOT_FOUND:")],
      ["agent cancels another tenant's task", async () => (await k.tool("agent_task_cancel", { taskRef: victimTask }, k.agentCtx("conn_2", "owner_2"))).text.startsWith("TASK_NOT_FOUND:")],
      ["agent claims a trigger's reserved idempotency key", async () => (await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_1" }, idempotencyKey: "trigger.0123456789abcdef" })).text.startsWith("INVALID_INPUT:")],
      ["agent pins a capability version", async () => (await k.tool("agent_task_submit", { capabilityId: "products.get@v1", input: { id: "prod_1" } })).text.startsWith("CAPABILITY_NOT_FOUND:")],
      ["forged webhook signature", async () => (await k.deliver(ref, k.signedWebhook(ref, k.secrets.generateWebhookSecret(), { resourceId: "prod_1" }))).status === 401],
      ["webhook body chooses the capability", async () => {
        const res = await k.deliver(ref, k.signedWebhook(ref, webhookSecret!, { resourceId: "prod_1", capabilityId: "refunds.process", input: { amount: 1 } }, "probe-cap"))
        const run = (await k.governance.getTriggerDetail(ref, 1))!.runs.rows.find((r) => r.taskRef)
        const task = run ? k.taskRow(run.taskRef!) : null
        return res.status === 202 && task?.capabilityId === "products.get"
      }],
      ["webhook replay", async () => {
        const req = k.signedWebhook(ref, webhookSecret!, { resourceId: "prod_1" }, "probe-replay")
        const copy = req.clone()
        await k.deliver(ref, req)
        return (await k.deliver(ref, copy)).status === 409
      }],
    ]
    const failures: string[] = []
    for (const [name, probe] of probes) {
      k.as(SUPER)
      if (!(await probe())) failures.push(name)
    }
    k.as(SUPER)
    expect(failures).toEqual([])
    // The two accepted deliveries (probes 13/14) are the only state change: one run each, same trigger, same capability.
    const after = JSON.parse(snapshot())
    const prior = JSON.parse(before)
    expect(after.policies).toEqual(prior.policies)
    expect(after.connections).toEqual(prior.connections)
    expect(after.triggers).toEqual(prior.triggers)
    expect(k.taskRow(victimTask)!.status).toBe("QUEUED")
  })
})

describe("Master performance test (in-memory; budgets are generous ceilings, numbers are reported)", () => {
  it("submit + execute, webhook intake, schedule ticks and governance pages stay within budget", async () => {
    await k.allowRead("products.get")
    await k.allowRead("products.list")
    const timings: Record<string, number> = {}
    const time = async (label: string, fn: () => Promise<unknown>) => {
      const started = performance.now()
      await fn()
      timings[label] = Math.round(performance.now() - started)
    }

    await time("200 MCP-equivalent submissions", async () => {
      for (let i = 0; i < 200; i += 1) await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: `p${i}` } })
    })
    await time("200 executions (worker + adapter)", () => k.drain(500))
    expect(k.approval._tasks.size).toBe(200)

    const { trigger, webhookSecret } = await k.triggerService.create({ type: "WEBHOOK", name: "Load", connectionId: "conn_1", capabilityId: "products.list", concurrency: "ALLOW_PARALLEL" }, SUPER)
    await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)
    await time("200 signed webhook deliveries", async () => {
      for (let i = 0; i < 200; i += 1) {
        const res = await k.deliver(trigger.triggerRef, k.signedWebhook(trigger.triggerRef, webhookSecret!, {}, `load-${i}`))
        if (res.status !== 202) throw new Error(`delivery ${i}: ${res.status}`)
      }
    })

    for (let i = 0; i < 150; i += 1) {
      const { trigger: s } = await k.triggerService.create({ type: "SCHEDULE", name: `S${i}`, connectionId: "conn_1", capabilityId: "products.list", concurrency: "ALLOW_PARALLEL", schedule: { kind: "CRON", cron: "0 * * * *", timezone: "UTC" } }, SUPER)
      await k.triggerService.transition(s.triggerRef, 1, "activate", SUPER)
      const row = k.triggerRow(s.triggerRef)!
      k.approval._triggers.set(row.id, { ...row, nextRunAt: new Date(Date.now() - 1_000) })
    }
    await time("150 due schedules (2 ticks of 100)", async () => {
      await k.runtime.runScheduleTick()
      await k.runtime.runScheduleTick()
    })
    expect(Array.from(k.approval._triggerRuns.values()).filter((r) => r.source === "SCHEDULE")).toHaveLength(150)

    const findMany = vi.spyOn(k.approval.client.agentTask, "findMany")
    const tasksPage = await page("tasks/page")
    await time("governance tasks page over 550 tasks", () => k.render(tasksPage, { searchParams: { page: "3" } }))
    expect(findMany.mock.calls.at(-1)![0]).toMatchObject({ take: 20, skip: 40 })
    await time("governance overview + runtime pages", async () => {
      await k.render(await page("page"))
      await k.render(await page("runtime/page"))
    })

    const budgets: Record<string, number> = {
      "200 MCP-equivalent submissions": 20_000,
      "200 executions (worker + adapter)": 20_000,
      "200 signed webhook deliveries": 20_000,
      "150 due schedules (2 ticks of 100)": 20_000,
      "governance tasks page over 550 tasks": 5_000,
      "governance overview + runtime pages": 5_000,
    }
    for (const [label, budget] of Object.entries(budgets)) expect(timings[label], label).toBeLessThan(budget)
    console.info(`[phase-10 performance] ${JSON.stringify(timings)}`)
  })
})
