/**
 * Phase 9 C — the signed webhook endpoint (handleAgentWebhook): every edge
 * status, signature binding, replay protection, event-id dedup, body
 * authority, rotation, fail-closed dependencies, and the real route module.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildTriggerKit, WEBHOOK_TRIGGER } from "./trigger-test-kit"

type Kit = Awaited<ReturnType<typeof buildTriggerKit>>
let k: Kit
let ref: string
let secret: string

beforeEach(async () => {
  k = await buildTriggerKit()
  const created = await k.createActive({ ...WEBHOOK_TRIGGER, concurrency: "ALLOW_PARALLEL" })
  ref = created.trigger.triggerRef
  secret = created.webhookSecret!
})

describe("Phase 9 C — accepted deliveries", () => {
  it("a correctly signed delivery -> 202, one run, one task; only the body digest is stored", async () => {
    const body = { resourceId: "ignored", note: "confidential body text" }
    const res = await k.deliver(ref, k.signedRequest(ref, secret, body))
    expect(res).toEqual({ status: 202, json: { accepted: true, duplicate: false, runRef: expect.stringMatching(/^trr_[0-9a-f]{32}$/) } })
    const [run] = k.runsOf(ref)
    expect(run).toMatchObject({ status: "TASK_CREATED", source: "WEBHOOK", deliveryKey: expect.stringMatching(/^webhook:evt_/) })
    expect(run.bodyDigest).toBe(k.secrets.webhookCanonicalMessage({ timestamp: "", nonce: "", eventId: "", method: "", path: "", body: JSON.stringify(body) }).split("\n")[6])
    expect(JSON.stringify(Array.from(k.fake._triggerRuns.values()))).not.toContain("confidential body text")
    expect(JSON.stringify(Array.from(k.fake._tasks.values()))).not.toContain("confidential body text")
    expect(k.tasksOf(ref)).toHaveLength(1)
    expect(k.limiter.calls).toEqual([`agent-webhook:${ref}`])
  })

  it("the body can never choose the capability, input, owner, connection or adapter", async () => {
    const hostile = { capabilityId: "refunds.process", input: { amount: 1_000_000 }, ownerId: "owner_2", connectionId: "conn_2", adapterId: "x", environment: "production" }
    expect((await k.deliver(ref, k.signedRequest(ref, secret, hostile))).status).toBe(202)
    const [task] = k.tasksOf(ref)
    expect(task).toMatchObject({ capabilityId: "products.list", ownerId: "owner_1", connectionId: "conn_1", environment: "development", adapterId: "products.listAdapter" })
    expect(task.input).toEqual({})
  })

  it("a duplicate event id (sender retry with a fresh nonce) -> 200 duplicate, still one task", async () => {
    const first = await k.deliver(ref, k.signedRequest(ref, secret, { a: 1 }, { eventId: "order-42" }))
    const retry = await k.deliver(ref, k.signedRequest(ref, secret, { a: 1 }, { eventId: "order-42" }))
    expect(first.status).toBe(202)
    expect(retry).toEqual({ status: 200, json: { accepted: true, duplicate: true, runRef: first.json.runRef } })
    expect(k.tasksOf(ref)).toHaveLength(1)
  })

  it("resource binding reads ONLY a valid body.resourceId", async () => {
    const bound = await k.createActive({ type: "WEBHOOK", name: "Bound", connectionId: "conn_1", capabilityId: "products.get", bindResource: true })
    const bRef = bound.trigger.triggerRef
    const bSecret = bound.webhookSecret!
    expect((await k.deliver(bRef, k.signedRequest(bRef, bSecret, {}))).status).toBe(400)
    expect((await k.deliver(bRef, k.signedRequest(bRef, bSecret, { resourceId: "../../etc/passwd" }))).status).toBe(400)
    expect((await k.deliver(bRef, k.signedRequest(bRef, bSecret, { resourceId: { $ne: null } }))).status).toBe(400)
    expect((await k.deliver(bRef, k.signedRequest(bRef, bSecret, { resourceId: "prod_7", id: "prod_other" }))).status).toBe(202)
    expect(k.tasksOf(bRef)).toMatchObject([{ input: { id: "prod_7" } }])
  })
})

describe("Phase 9 C — rejected deliveries (stable, non-leaky statuses)", () => {
  it("feature disabled -> 404", async () => {
    const res = await k.handleAgentWebhook(k.signedRequest(ref, secret, {}), ref, { ...k.webhookDeps, enabled: () => false })
    expect(res.status).toBe(404)
    expect(k.fake._triggerRuns.size).toBe(0)
  })

  it("malformed, unknown, non-webhook and inactive refs -> 404 with the same body", async () => {
    const bodies = new Set<string>()
    for (const r of ["trg_x", "../../x", `trg_${"0".repeat(32)}`]) {
      const res = await k.deliver(r, k.signedRequest(r, secret, {}))
      expect(res.status, r).toBe(404)
      bodies.add(JSON.stringify(res.json))
    }
    const ev = await k.createActive({ type: "EVENT", name: "Ev", connectionId: "conn_1", capabilityId: "products.get", bindResource: true, event: { eventType: "PRODUCT_UPDATED" } })
    const evRes = await k.deliver(ev.trigger.triggerRef, k.signedRequest(ev.trigger.triggerRef, secret, {}))
    expect(evRes.status).toBe(404)
    bodies.add(JSON.stringify(evRes.json))
    await k.triggers.transition(ref, k.triggerRow(ref).version, "pause", "admin_1")
    const paused = await k.deliver(ref, k.signedRequest(ref, secret, {}))
    expect(paused.status).toBe(404)
    bodies.add(JSON.stringify(paused.json))
    expect(bodies.size).toBe(1)
    expect(k.fake._triggerRuns.size).toBe(0)
  })

  it("wrong content type -> 415; oversized body (declared or streamed) -> 413", async () => {
    expect((await k.deliver(ref, k.signedRequest(ref, secret, "{}", { contentType: "text/plain" }))).status).toBe(415)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, "{}", { contentType: null }))).status).toBe(415)
    const big = JSON.stringify({ pad: "x".repeat(5_000) })
    expect((await k.deliver(ref, k.signedRequest(ref, secret, big))).status).toBe(413)
    const lying = k.signedRequest(ref, secret, big, { extraHeaders: { "content-length": "10" } })
    expect((await k.deliver(ref, lying)).status).toBe(413)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, "{}", { contentType: "application/json; charset=utf-8" }))).status).toBe(202)
  })

  it("missing or malformed signature headers -> 401", async () => {
    for (const omit of ["timestamp", "nonce", "eventId", "signature"] as const) {
      expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { omit: [omit] }))).status, omit).toBe(401)
    }
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { nonce: "short" }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { eventId: "bad id with spaces" }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { signature: "not-hex" }))).status).toBe(401)
    expect(k.limiter.calls).toHaveLength(0) // rejected before any Redis or database work
  })

  it("timestamps outside the allowed skew -> 401 (both directions, exact boundary accepted)", async () => {
    const now = Math.floor(k.state.now.getTime() / 1000)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { timestamp: String(now - 301) }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { timestamp: String(now + 301) }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { timestamp: "yesterday" }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { timestamp: String(now - 300) }))).status).toBe(202)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { timestamp: new Date(k.state.now).toISOString() }))).status).toBe(202)
  })

  it("any tampered signed part -> 401: body, path, method, event id, wrong secret", async () => {
    expect((await k.deliver(ref, k.signedRequest(ref, secret, { a: 2 }, { signedBody: JSON.stringify({ a: 1 }) }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { signedPath: "/api/agent-webhooks/trg_other" }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { signedMethod: "PUT" }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, k.secrets.generateWebhookSecret(), {}))).status).toBe(401)
    // Event id swapped on a captured request: the signature covers it.
    const captured = k.signedRequest(ref, secret, {}, { eventId: "evt_original" })
    const headers = new Headers(captured.headers)
    headers.set(k.secrets.WEBHOOK_HEADERS.eventId, "evt_swapped")
    const swapped = new Request(captured.url, { method: "POST", headers, body: "{}" })
    expect((await k.deliver(ref, swapped)).status).toBe(401)
    expect(k.fake._triggerRuns.size).toBe(0)
  })

  it("replaying a captured delivery (same nonce) -> 409; nonce store down -> 503 (fail closed)", async () => {
    const original = k.signedRequest(ref, secret, { a: 1 }, { nonce: "nonce-replay-000000000001" })
    const replay = original.clone()
    expect((await k.deliver(ref, original)).status).toBe(202)
    expect((await k.deliver(ref, replay)).status).toBe(409)
    k.nonceStore.down = true
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}))).status).toBe(503)
    expect(k.tasksOf(ref)).toHaveLength(1)
  })

  it("an attacker without the secret cannot burn a sender's nonce", async () => {
    const nonce = "nonce-sender-000000000001"
    expect((await k.deliver(ref, k.signedRequest(ref, k.secrets.generateWebhookSecret(), {}, { nonce }))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}, { nonce }))).status).toBe(202)
  })

  it("rate limited -> 429 with Retry-After; limiter unavailable -> 503 (fail closed)", async () => {
    k.limiter.allowed = false
    const limited = await k.handleAgentWebhook(k.signedRequest(ref, secret, {}), ref, k.webhookDeps)
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0)
    k.limiter.allowed = true
    k.limiter.unavailable = true
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}))).status).toBe(503)
    const throwing = { ...k.webhookDeps, rateLimiter: { check: async () => Promise.reject(new Error("redis down")) } }
    expect((await k.handleAgentWebhook(k.signedRequest(ref, secret, {}), ref, throwing)).status).toBe(503)
    expect(k.fake._triggerRuns.size).toBe(0)
  })

  it("non-object or invalid JSON -> 400 (after authentication)", async () => {
    for (const body of ["[1,2]", '"text"', "null", "{bad json", "42"]) {
      expect((await k.deliver(ref, k.signedRequest(ref, secret, body))).status, body).toBe(400)
    }
  })

  it("an unreadable stored secret -> 503, never a bypass", async () => {
    k.fake._triggers.get(k.triggerRow(ref).id)!.webhookSecretRef = "corrupted"
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}))).status).toBe(503)
  })

  it("rotation: the old secret stops working immediately, the new one works", async () => {
    const rotated = await k.triggers.rotateWebhookSecret(ref, k.triggerRow(ref).version, "admin_1")
    expect((await k.deliver(ref, k.signedRequest(ref, secret, {}))).status).toBe(401)
    expect((await k.deliver(ref, k.signedRequest(ref, rotated.webhookSecret, {}))).status).toBe(202)
  })

  it("transient task-creation failure -> 503; the sender's retry (same event id, new nonce) creates exactly one task", async () => {
    k.queue.configured = false
    const first = await k.deliver(ref, k.signedRequest(ref, secret, {}, { eventId: "evt-retry" }))
    expect(first).toEqual({ status: 503, json: { accepted: false, error: "UNAVAILABLE" } })
    k.queue.configured = true
    const retry = await k.deliver(ref, k.signedRequest(ref, secret, {}, { eventId: "evt-retry" }))
    expect(retry.status).toBe(202)
    const again = await k.deliver(ref, k.signedRequest(ref, secret, {}, { eventId: "evt-retry" }))
    expect(again.status).toBe(200)
    expect(k.tasksOf(ref)).toHaveLength(1)
  })

  it("an authorization denial is accepted (202) but creates nothing; the outcome is visible to admins only", async () => {
    k.state.authz = { decision: "DENY", reasonCode: "POLICY_DENY", message: "denied" }
    const res = await k.deliver(ref, k.signedRequest(ref, secret, {}))
    expect(res.status).toBe(202)
    expect(JSON.stringify(res.json)).not.toMatch(/DENIED|AUTHORIZATION|policy/i)
    expect(k.runsOf(ref)).toMatchObject([{ status: "DENIED", errorCode: "AUTHORIZATION_DENIED" }])
    expect(k.tasksOf(ref)).toHaveLength(0)
  })

  it("responses never contain secrets, internal ids or stack traces", async () => {
    const res = await k.deliver(ref, k.signedRequest(ref, secret, {}))
    const text = JSON.stringify(res.json)
    const row = k.triggerRow(ref)
    for (const forbidden of [secret, row.id, row.webhookSecretRef, "conn_1", "owner_1", "stack"]) expect(text).not.toContain(forbidden)
  })
})

describe("Phase 9 C — the real route module", () => {
  it("fails closed with triggers disabled (default configuration)", async () => {
    vi.stubEnv("AGENT_GATEWAY_TRIGGERS_ENABLED", "")
    const { __resetTriggerConfigForTests } = await import("../triggers/config")
    __resetTriggerConfigForTests()
    const route = await import("@/app/api/agent-webhooks/[ref]/route")
    const res = await route.POST(k.signedRequest(ref, secret, {}), { params: Promise.resolve({ ref }) })
    expect(res.status).toBe(404)
    expect(route.dynamic).toBe("force-dynamic")
    expect(k.fake._triggerRuns.size).toBe(0)
    vi.unstubAllEnvs()
  })

  it("enabled but without Redis: the production limiter and nonce store fail closed (503), nothing runs", async () => {
    vi.stubEnv("AGENT_GATEWAY_TRIGGERS_ENABLED", "true")
    vi.stubEnv("AGENT_GATEWAY_TASKS_ENABLED", "true")
    const { __resetTriggerConfigForTests } = await import("../triggers/config")
    const { __resetTaskEngineConfigForTests } = await import("../tasks/config")
    __resetTaskEngineConfigForTests()
    __resetTriggerConfigForTests()
    const route = await import("@/app/api/agent-webhooks/[ref]/route")
    // The real route uses the real clock for the skew check.
    const req = k.signedRequest(ref, secret, {}, { timestamp: String(Math.floor(Date.now() / 1000)) })
    const res = await route.POST(req, { params: Promise.resolve({ ref }) })
    expect(res.status).toBe(503)
    expect(k.fake._triggerRuns.size).toBe(0)
    vi.unstubAllEnvs()
    __resetTaskEngineConfigForTests()
    __resetTriggerConfigForTests()
  })
})
