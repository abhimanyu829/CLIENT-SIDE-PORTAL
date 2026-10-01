/**
 * Phase 10 — governance mutations through the REAL route modules:
 *   B connections (existing Phase 2 routes, real service), D policies,
 *   E autonomy (existing route + optimistic concurrency), G tasks,
 *   H triggers / webhooks / schedules — strict bodies, optimistic
 *   concurrency (stale = 409, racing admins = one winner), audit entries
 *   without secrets, and the effect on the very next agent request.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SUPER, SUPER_2, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

let k: GovernanceKit

beforeEach(async () => {
  k = await buildGovernanceKit()
  k.as(SUPER)
})

const API = "@/app/api/admin/agent-governance"
const mod = (p: string) => import(p) as Promise<Record<string, unknown>>

async function createTrigger(body: Record<string, unknown>) {
  return k.call(await mod(`${API}/triggers/route`), "POST", { path: "/api/admin/agent-governance/triggers", body })
}
async function transition(ref: string, action: string, expectedVersion: number, extra: Record<string, unknown> = {}) {
  return k.call(await mod(`${API}/triggers/[ref]/${action}/route`), "POST", { path: `/api/admin/agent-governance/triggers/${ref}/${action}`, params: { ref }, body: { expectedVersion, ...extra } })
}
async function patchTrigger(ref: string, expectedVersion: number, patch: Record<string, unknown>) {
  return k.call(await mod(`${API}/triggers/[ref]/route`), "PATCH", { path: `/api/admin/agent-governance/triggers/${ref}`, params: { ref }, body: { expectedVersion, patch } })
}
async function connectionAction(id: string, action: string) {
  return k.call(await mod(`@/app/api/admin/agent-connections/[id]/${action}/route`), "POST", { path: `/api/admin/agent-connections/${id}/${action}`, params: { id }, body: {} })
}
async function putAutonomy(id: string, body: Record<string, unknown>) {
  return k.call(await mod("@/app/api/admin/agent-connections/[id]/autonomy/route"), "PUT", { path: `/api/admin/agent-connections/${id}/autonomy`, params: { id }, body })
}
async function deleteAutonomy(id: string, expectedVersion?: number) {
  const q = expectedVersion === undefined ? "" : `?expectedVersion=${expectedVersion}`
  return k.call(await mod("@/app/api/admin/agent-connections/[id]/autonomy/route"), "DELETE", { path: `/api/admin/agent-connections/${id}/autonomy${q}`, params: { id }, contentType: null })
}
async function createPolicy(body: Record<string, unknown>) {
  return k.call(await mod(`${API}/policies/route`), "POST", { path: "/api/admin/agent-governance/policies", body })
}
async function publish(id: string, body: Record<string, unknown>) {
  return k.call(await mod(`${API}/policies/[id]/versions/route`), "POST", { path: `/api/admin/agent-governance/policies/${id}/versions`, params: { id }, body })
}
async function policyRoute(id: string, action: "enable" | "disable" | "rollback", body: Record<string, unknown> = {}) {
  return k.call(await mod(`${API}/policies/[id]/${action}/route`), "POST", { path: `/api/admin/agent-governance/policies/${id}/${action}`, params: { id }, body })
}
async function cancelTask(ref: string, body: Record<string, unknown>) {
  return k.call(await mod(`${API}/tasks/[ref]/cancel/route`), "POST", { path: `/api/admin/agent-governance/tasks/${ref}/cancel`, params: { ref }, body })
}
const submitRead = (id = "prod_1", ctx = k.agentCtx()) => k.taskService.submit(ctx, "development", { capabilityId: "products.get", input: { id } })
const codeOf = async (p: Promise<unknown>) => p.then(() => "OK").catch((e: { code?: string }) => e.code ?? "THREW")

function assertNoSecrets(values: string[]) {
  const blob = JSON.stringify(k.auditEntries())
  for (const v of values) expect(blob).not.toContain(v)
}

describe("Phase 10 B — connection management (existing Phase 2 routes, real service)", () => {
  it("creates a connection: the credential is returned once, stored only as a hash, authenticates, and never appears in views or audit", async () => {
    const res = await k.call(await mod("@/app/api/admin/agent-connections/route"), "POST", {
      path: "/api/admin/agent-connections",
      body: { name: "Ops agent", provider: "custom", ownerId: "owner_1", environment: "development" },
    })
    expect(res.status).toBe(200)
    const token: string = res.json.credential.bearerToken
    expect(token).toMatch(/^agw_[0-9a-f]{64}$/)
    const connectionId: string = res.json.connection.id
    const cred = Array.from(k.approval._credentials.values()).find((c) => c.connectionId === connectionId)!
    expect(cred.secretHash).not.toBe(token)
    expect(JSON.stringify(cred)).not.toContain(token)
    const identity = await k.connectionService().authenticateCredential(token, "BEARER")
    expect(identity).toMatchObject({ connectionId, ownerId: "owner_1", connectionStatus: "ACTIVE" })
    const detail = await k.governance.getConnectionDetail(connectionId)
    expect(JSON.stringify(detail)).not.toContain(token)
    expect(JSON.stringify(detail)).not.toContain(String(cred.secretHash))
    expect(detail!.credentials[0]).toMatchObject({ status: "ACTIVE", fingerprint: cred.fingerprint })
    await k.settle()
    expect(k.auditEntries().map((a) => a.action)).toEqual(expect.arrayContaining(["AGENT_CONNECTION_CREATED", "AGENT_CREDENTIAL_GENERATED"]))
    assertNoSecrets([token, String(cred.secretHash)])
  })

  it("suspend / reactivate / rotate / revoke: rotation invalidates the old credential; revocation retires approvals and triggers", async () => {
    const created = await k.call(await mod("@/app/api/admin/agent-connections/route"), "POST", {
      path: "/api/admin/agent-connections",
      body: { name: "Rotating agent", provider: "custom", ownerId: "owner_1" },
    })
    const id: string = created.json.connection.id
    const oldToken: string = created.json.credential.bearerToken
    const { trigger } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: id, capabilityId: "products.list" }, SUPER)
    await k.triggerService.transition(trigger.triggerRef, 1, "activate", SUPER)

    expect((await connectionAction(id, "suspend")).status).toBe(200)
    expect(k.approval._connections.get(id)!.status).toBe("SUSPENDED")
    expect(await k.connectionService().authenticateCredential(oldToken, "BEARER")).toBeNull()
    expect((await connectionAction(id, "reactivate")).status).toBe(200)

    const rotated = await connectionAction(id, "rotate")
    expect(rotated.status).toBe(200)
    const newToken: string = rotated.json.credential.bearerToken
    expect(newToken).not.toBe(oldToken)
    expect(await k.connectionService().authenticateCredential(oldToken, "BEARER")).toBeNull()
    expect(await k.connectionService().authenticateCredential(newToken, "BEARER")).toMatchObject({ connectionId: id })

    expect((await connectionAction(id, "revoke")).status).toBe(200)
    expect(k.approval._connections.get(id)!.status).toBe("REVOKED")
    expect(k.triggerRow(trigger.triggerRef)!.status).toBe("REVOKED")
    expect(await k.connectionService().authenticateCredential(newToken, "BEARER")).toBeNull()
    // Terminal: an illegal transition afterwards is a stable 409, not a 500.
    const again = await connectionAction(id, "suspend")
    expect(again.status).toBe(409)
    await k.settle()
    assertNoSecrets([oldToken, newToken])
  })
})

describe("Phase 10 D — policy management", () => {
  it("creates a policy with its first version; strict body; audited without internals", async () => {
    const res = await createPolicy({ name: "Allow product reads", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get", riskConstraint: "READ" })
    expect(res.status).toBe(201)
    expect(res.json.policy).toMatchObject({ version: 1 })
    const policyId: string = res.json.policy.policyId
    expect(k.authz._policies.get(policyId)).toMatchObject({ name: "Allow product reads", enabled: true, createdById: SUPER })
    for (const forged of [{ createdById: "someone" }, { actorId: "x" }, { version: 7 }, { currentVersionId: "v" }, { policyId: "p" }]) {
      const r = await createPolicy({ name: "Forged", effect: "ALLOW", scope: "GLOBAL", ...forged })
      expect(r.status, JSON.stringify(forged)).toBe(400)
      expect(r.json.code).toBe("VALIDATION_FAILED")
    }
    await k.settle()
    expect(k.auditEntries().find((a) => a.action === "AGENT_POLICY_CREATED")).toMatchObject({ userId: SUPER, entity: "AgentPolicy", entityId: policyId })
  })

  it("validates scope / capability / conditions on the server", async () => {
    const bad = [
      { name: "a", effect: "ALLOW", scope: "GLOBAL", scopeValue: "x" },
      { name: "ab", effect: "ALLOW", scope: "CAPABILITY" },
      { name: "ab", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "nope.missing" },
      { name: "ab", effect: "ALLOW", scope: "OWNER" },
      { name: "ab", effect: "ALLOW", scope: "ENVIRONMENT", scopeValue: "mars" },
      { name: "ab", effect: "ALLOW", scope: "OWNER", scopeValue: "../etc" },
      { name: "ab", effect: "ALLOW", scope: "GLOBAL", conditions: { op: "exec", code: "process.exit()" } },
      { name: "ab", effect: "EXECUTE", scope: "GLOBAL" },
    ]
    for (const body of bad) expect((await createPolicy(body)).status, JSON.stringify(body)).toBe(400)
    expect(k.authz._policies.size).toBe(0)
  })

  it("publishing is optimistic: the stale version is a CONFLICT and writes nothing; racing admins -> exactly one winner", async () => {
    const { json } = await createPolicy({ name: "Product reads", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get" })
    const id: string = json.policy.policyId
    const v2 = await publish(id, { effect: "DENY", scope: "CAPABILITY", capabilityId: "products.get", expectedCurrentVersion: 1 })
    expect(v2.status).toBe(201)
    expect(v2.json.policy.version).toBe(2)
    const stale = await publish(id, { effect: "ALLOW", scope: "GLOBAL", expectedCurrentVersion: 1 })
    expect(stale.status).toBe(409)
    expect(stale.json.code).toBe("CONFLICT")
    expect(Array.from(k.authz._versions.values()).filter((v) => v.policyId === id)).toHaveLength(2)

    const results = await Promise.all([
      publish(id, { effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get", expectedCurrentVersion: 2, note: "a" }),
      (async () => {
        k.as(SUPER_2)
        return publish(id, { effect: "DENY", scope: "GLOBAL", expectedCurrentVersion: 2, note: "b" })
      })(),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    const versions = Array.from(k.authz._versions.values()).filter((v) => v.policyId === id)
    expect(versions).toHaveLength(3)
    expect(versions.filter((v) => v.status === "ACTIVE")).toHaveLength(1)
  })

  it("rollback publishes a copy of an earlier version; stale / invalid targets are refused", async () => {
    const { json } = await createPolicy({ name: "Product reads", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get" })
    const id: string = json.policy.policyId
    await publish(id, { effect: "DENY", scope: "CAPABILITY", capabilityId: "products.get", expectedCurrentVersion: 1 })
    expect((await policyRoute(id, "rollback", { targetVersion: 1, expectedCurrentVersion: 1 })).status).toBe(400)
    expect((await policyRoute(id, "rollback", { targetVersion: 9, expectedCurrentVersion: 2 })).status).toBe(404)
    const ok = await policyRoute(id, "rollback", { targetVersion: 1, expectedCurrentVersion: 2, reason: "deny was a mistake" })
    expect(ok.status).toBe(200)
    expect(ok.json.policy.version).toBe(3)
    const v3 = Array.from(k.authz._versions.values()).find((v) => v.policyId === id && v.version === 3)!
    expect(v3).toMatchObject({ effect: "ALLOW", status: "ACTIVE", note: "Rollback to version 1." })
    expect((await policyRoute(id, "rollback", { targetVersion: 1, expectedCurrentVersion: 2 })).status).toBe(409)
    await k.settle()
    expect(k.auditEntries().find((a) => a.action === "AGENT_POLICY_ROLLED_BACK")!.afterJson).toMatchObject({ copiedFrom: 1, version: 3, reason: "deny was a mistake" })
  })

  it("the kill switch applies to the very next authorization and is idempotent", async () => {
    const { json } = await createPolicy({ name: "Reads", effect: "ALLOW", scope: "CAPABILITY", capabilityId: "products.get", riskConstraint: "READ" })
    const id: string = json.policy.policyId
    expect(await codeOf(submitRead("prod_1"))).toBe("OK")
    expect((await policyRoute(id, "disable", { reason: "incident" })).status).toBe(200)
    expect(await codeOf(submitRead("prod_2"))).toBe("AUTHORIZATION_DENIED")
    const before = k.auditEntries().length
    expect((await policyRoute(id, "disable")).status).toBe(200)
    await k.settle()
    expect(k.auditEntries().filter((a) => a.action === "AGENT_POLICY_DISABLED")).toHaveLength(1)
    expect(k.auditEntries().length).toBeGreaterThanOrEqual(before)
    expect((await policyRoute(id, "enable")).status).toBe(200)
    expect(await codeOf(submitRead("prod_2"))).toBe("OK")
    expect((await policyRoute("missing_policy", "enable")).status).toBe(404)
  })
})

describe("Phase 10 E — autonomy management (existing route, optimistic concurrency)", () => {
  it("expectedVersion: 0 creates v1; a stale value is a CONFLICT; DELETE checks the active version", async () => {
    const v1 = await putAutonomy("conn_1", { expectedVersion: 0, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE" })
    expect(v1.status).toBe(200)
    expect(v1.json.policy.version).toBe(1)
    const stale = await putAutonomy("conn_1", { expectedVersion: 0, autonomyLevel: "FULL_SCOPED_AUTONOMY", maxRiskTier: "CRITICAL" })
    expect(stale.status).toBe(409)
    expect(stale.json.code).toBe("CONFLICT")
    expect(Array.from(k.approval._autonomy.values()).filter((r) => r.connectionId === "conn_1")).toHaveLength(1)
    expect((await putAutonomy("conn_1", { expectedVersion: 1, autonomyLevel: "ASSISTED", maxRiskTier: "READ" })).json.policy.version).toBe(2)
    expect((await deleteAutonomy("conn_1", 1)).status).toBe(409)
    expect((await deleteAutonomy("conn_1", 2)).status).toBe(200)
    expect((await deleteAutonomy("conn_1", 2)).status).toBe(200) // nothing active any more: no-op
    expect((await deleteAutonomy("conn_1")).status).toBe(200) // older callers without a version still work
    const raw = await k.call(await mod("@/app/api/admin/agent-connections/[id]/autonomy/route"), "DELETE", { path: "/api/admin/agent-connections/conn_1/autonomy?expectedVersion=abc", params: { id: "conn_1" }, contentType: null })
    expect(raw.status).toBe(400)
  })

  it("two administrators saving on the same version: exactly one wins", async () => {
    const results = await Promise.all([
      putAutonomy("conn_1", { expectedVersion: 0, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ" }),
      putAutonomy("conn_1", { expectedVersion: 0, autonomyLevel: "OBSERVE_ONLY", maxRiskTier: "READ" }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(Array.from(k.approval._autonomy.values()).filter((r) => r.status === "ACTIVE")).toHaveLength(1)
  })

  it("an autonomy change applies to the next agent request (approval now required)", async () => {
    await k.allowRead("products.get")
    expect(await codeOf(submitRead("prod_1"))).toBe("OK")
    await putAutonomy("conn_1", { expectedVersion: 0, autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"] })
    expect(await codeOf(submitRead("prod_2"))).toBe("APPROVAL_REQUIRED")
  })
})

describe("Phase 10 G — task management", () => {
  it("cancels a queued task on behalf of its connection; the worker then never executes it", async () => {
    await k.allowRead("products.get")
    const { task } = await submitRead()
    const res = await cancelTask(task.taskRef, { expectedStatus: "QUEUED", reason: "operator request" })
    expect(res.status).toBe(200)
    expect(res.json).toMatchObject({ success: true, outcome: "CANCELLED", status: "CANCELLED" })
    const findUnique = vi.spyOn(k.exec.client.product, "findUnique")
    await k.drain()
    expect(findUnique).not.toHaveBeenCalled()
    expect(k.taskRow(task.taskRef)!.status).toBe("CANCELLED")
    await k.settle()
    expect(k.auditEntries().find((a) => a.action === "AGENT_TASK_CANCELLED_BY_ADMIN")).toMatchObject({ userId: SUPER, entityId: task.taskRef, afterJson: { outcome: "CANCELLED", reason: "operator request" } })
  })

  it("stale status -> CONFLICT; finished task -> TASK_ALREADY_COMPLETED; bad refs -> 404; bad body -> 400", async () => {
    await k.allowRead("products.get")
    const { task } = await submitRead()
    await k.drain()
    expect(k.taskRow(task.taskRef)!.status).toBe("SUCCEEDED")
    const stale = await cancelTask(task.taskRef, { expectedStatus: "QUEUED" })
    expect(stale.status).toBe(409)
    expect(stale.json.code).toBe("CONFLICT")
    const done = await cancelTask(task.taskRef, { expectedStatus: "SUCCEEDED" })
    expect(done.status).toBe(409)
    expect(done.json.code).toBe("TASK_ALREADY_COMPLETED")
    expect((await cancelTask(`atk_${"0".repeat(32)}`, { expectedStatus: "QUEUED" })).status).toBe(404)
    expect((await cancelTask("../etc", { expectedStatus: "QUEUED" })).status).toBe(404)
    expect((await cancelTask(task.taskRef, { expectedStatus: "WHATEVER" })).status).toBe(400)
    expect((await cancelTask(task.taskRef, { expectedStatus: "QUEUED", connectionId: "conn_2" })).status).toBe(400)
  })
})

describe("Phase 10 H — trigger, schedule and webhook management", () => {
  it("creates a webhook trigger: the secret is returned once, never stored or audited in clear", async () => {
    const res = await createTrigger({ type: "WEBHOOK", name: "Inbound", connectionId: "conn_1", capabilityId: "products.list" })
    expect(res.status).toBe(201)
    const secret: string = res.json.webhookSecret
    expect(secret).toMatch(/^whsec_[0-9a-f]{64}$/)
    const ref: string = res.json.trigger.triggerRef
    expect(res.json.trigger).toMatchObject({ status: "DRAFT", version: 1, ownerId: "owner_1", environment: "development" })
    expect(JSON.stringify(k.triggerRow(ref))).not.toContain(secret)
    const view = await k.governance.getTriggerDetail(ref, 1)
    expect(JSON.stringify(view)).not.toContain(secret)
    expect(JSON.stringify(view)).not.toContain(String(k.triggerRow(ref)!.webhookSecretRef))
    await k.settle()
    expect(k.auditEntries().find((a) => a.action === "AGENT_TRIGGER_CREATED")).toMatchObject({ entityId: ref, userId: SUPER })
    assertNoSecrets([secret, String(k.triggerRow(ref)!.webhookSecretRef)])
  })

  it("rejects forged security fields and invalid configuration", async () => {
    for (const forged of [{ ownerId: "owner_2" }, { status: "ACTIVE" }, { environment: "production" }, { version: 3 }]) {
      const res = await createTrigger({ type: "WEBHOOK", name: "Forged", connectionId: "conn_1", capabilityId: "products.list", ...forged })
      expect(res.status, JSON.stringify(forged)).toBe(400)
      expect(res.json.code).toBe("TRIGGER_VALIDATION_FAILED")
    }
    expect((await createTrigger({ type: "SCHEDULE", name: "Too often", connectionId: "conn_1", capabilityId: "products.list", schedule: { kind: "CRON", cron: "* * * * *", timezone: "UTC" } })).json.code).toBe("SCHEDULE_ERROR")
    expect(k.approval._triggers.size).toBe(0)
  })

  it("lifecycle with optimistic concurrency: stale versions conflict, illegal transitions are refused, racing admins -> one winner", async () => {
    const ref: string = (await createTrigger({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.list" })).json.trigger.triggerRef
    expect((await transition(ref, "pause", 1)).json.code).toBe("TRIGGER_INVALID_TRANSITION")
    const active = await transition(ref, "activate", 1)
    expect(active.json.trigger).toMatchObject({ status: "ACTIVE", version: 2 })
    const stale = await transition(ref, "pause", 1)
    expect(stale.status).toBe(409)
    expect(stale.json.code).toBe("CONFLICT")
    const race = await Promise.all([transition(ref, "pause", 2), transition(ref, "disable", 2, { reason: "maintenance" })])
    expect(race.filter((r) => r.status === 200)).toHaveLength(1)
    expect(race.filter((r) => r.status === 409)).toHaveLength(1)
    const row = k.triggerRow(ref)!
    expect(row.version).toBe(3)
    const revoked = await transition(ref, "revoke", 3, { reason: "done" })
    expect(revoked.json.trigger.status).toBe("REVOKED")
    for (const action of ["activate", "resume", "pause", "disable", "revoke"]) expect((await transition(ref, action, 4)).status, action).toBe(409)
    await k.settle()
    const audits = k.auditEntries().filter((a) => a.action === "AGENT_TRIGGER_STATUS_CHANGED")
    expect(audits.map((a) => a.afterJson.status)).toEqual(expect.arrayContaining(["ACTIVE", "REVOKED"]))
  })

  it("edits only while it cannot fire; strict patch; stale version conflicts", async () => {
    const ref: string = (await createTrigger({ type: "SCHEDULE", name: "Daily", connectionId: "conn_1", capabilityId: "products.list", schedule: { kind: "CRON", cron: "0 9 * * *", timezone: "Asia/Kolkata" } })).json.trigger.triggerRef
    expect((await patchTrigger(ref, 1, { name: "Daily reads", concurrency: "QUEUE_ONE" })).json.trigger).toMatchObject({ name: "Daily reads", concurrency: "QUEUE_ONE", version: 2 })
    await transition(ref, "activate", 2)
    expect((await patchTrigger(ref, 3, { name: "While active" })).json.code).toBe("TRIGGER_INVALID_TRANSITION")
    await transition(ref, "pause", 3)
    expect((await patchTrigger(ref, 3, { name: "Stale" })).json.code).toBe("CONFLICT")
    expect((await patchTrigger(ref, 4, { capabilityId: "products.get" })).status).toBe(400)
    expect((await patchTrigger(ref, 4, { ownerId: "owner_2" })).status).toBe(400)
    const ok = await patchTrigger(ref, 4, { schedule: { kind: "CRON", cron: "30 6 * * 1-5", timezone: "America/New_York", missedRunPolicy: "CATCH_UP_ONCE" } })
    expect(ok.json.trigger.schedule).toMatchObject({ cron: "30 6 * * 1-5", timezone: "America/New_York", missedRunPolicy: "CATCH_UP_ONCE", nextRunAt: null })
  })

  it("rotating a webhook secret: returned once; the old secret stops verifying immediately; audit has the version only", async () => {
    const created = await createTrigger({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.list" })
    const ref: string = created.json.trigger.triggerRef
    const oldSecret: string = created.json.webhookSecret
    await transition(ref, "activate", 1)
    await k.allowRead("products.list")
    expect((await k.deliver(ref, k.signedWebhook(ref, oldSecret, {}))).status).toBe(202)
    const rotated = await k.call(await mod(`${API}/triggers/[ref]/rotate-secret/route`), "POST", { path: `/api/admin/agent-governance/triggers/${ref}/rotate-secret`, params: { ref }, body: { expectedVersion: 2, reason: "suspected leak" } })
    expect(rotated.status).toBe(200)
    const newSecret: string = rotated.json.webhookSecret
    expect(newSecret).not.toBe(oldSecret)
    expect((await k.deliver(ref, k.signedWebhook(ref, oldSecret, {}))).status).toBe(401)
    expect((await k.deliver(ref, k.signedWebhook(ref, newSecret, {}))).status).toBe(202)
    await k.settle()
    expect(k.auditEntries().find((a) => a.action === "AGENT_TRIGGER_SECRET_ROTATED")!.afterJson).toEqual({ secretVersion: 2, reason: "suspected leak" })
    assertNoSecrets([oldSecret, newSecret])
    expect((await k.call(await mod(`${API}/triggers/[ref]/rotate-secret/route`), "POST", { path: "/x", params: { ref }, body: { expectedVersion: 2 } })).json.code).toBe("CONFLICT")
  })

  it("an oversized or malformed body is refused before any service call", async () => {
    const big = { type: "WEBHOOK", name: "x".repeat(40_000), connectionId: "conn_1", capabilityId: "products.list" }
    expect((await createTrigger(big)).status).toBe(413)
    const malformed = await k.call(await mod(`${API}/triggers/route`), "POST", { path: "/api/admin/agent-governance/triggers", rawBody: "{not json" })
    expect(malformed.status).toBe(400)
    expect(malformed.json.code).toBe("VALIDATION_FAILED")
    expect(k.approval._triggers.size).toBe(0)
  })
})
