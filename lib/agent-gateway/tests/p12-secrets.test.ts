/**
 * Phase 12 G — secret protection.
 *
 *   - the gateway logger REDACTS credential- and payload-shaped fields
 *     (enforced by pino, not just by convention);
 *   - at rest: bearer tokens only as SHA-256 hashes, signing and webhook
 *     secrets only encrypted, step-up codes never in plaintext;
 *   - a full flow through the REAL MCP route handler with a real bearer
 *     token (and a forged one) leaves no secret in logs, spans, metrics,
 *     the ledger, AuditLog or any table.
 */
import { createHash } from "crypto"
import { describe, expect, it, vi } from "vitest"
import pino from "pino"
import { buildGovernanceKit, SUPER } from "./governance-test-kit"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

describe("Phase 12 G1 — log redaction is enforced", () => {
  it("credential- and payload-shaped fields are redacted at the top level, one level down and in header bags", async () => {
    const { withGatewayRedaction } = await import("../observability/request-log")
    const lines: string[] = []
    const root = pino({ level: "info" }, { write: (s: string) => void lines.push(s) })
    const log = withGatewayRedaction(root)
    log.info(
      {
        requestId: "req_1",
        errorCode: "AUTH_INVALID",
        authorization: "Bearer agw_" + "a".repeat(64),
        token: "agw_" + "b".repeat(64),
        webhookSecret: "whsec_" + "c".repeat(64),
        stepUpCode: "123456",
        input: { email: "customer@example.com" },
        result: { name: "private" },
        nested: { secret: "s3cret", password: "hunter2", signingSecret: "d".repeat(64), keep: 1 },
        headers: { "x-abhibhi-signature": "e".repeat(64), "content-type": "application/json" },
      },
      "agent_gateway_test"
    )
    const out = JSON.parse(lines[0])
    for (const key of ["authorization", "token", "webhookSecret", "stepUpCode", "input", "result"]) expect(out[key], key).toBe("[redacted]")
    expect(out.nested).toEqual({ secret: "[redacted]", password: "[redacted]", signingSecret: "[redacted]", keep: 1 })
    expect(out.headers).toEqual({ "x-abhibhi-signature": "[redacted]", "content-type": "application/json" })
    expect(out).toMatchObject({ requestId: "req_1", errorCode: "AUTH_INVALID", module: "agent-gateway", msg: "agent_gateway_test" })
    for (const leaked of ["agw_", "whsec_", "123456", "customer@example.com", "hunter2", "s3cret", "e".repeat(64)]) expect(lines[0]).not.toContain(leaked)
  })
})

describe("Phase 12 G2–G3 — secrets at rest and through a full flow", () => {
  it("nothing secret is stored in plaintext, and a real authenticated flow leaks nothing anywhere", async () => {
    const k = await buildGovernanceKit()
    const ledger = await import("../audit-ledger")
    const { decrypt } = await import("@/lib/encryption")

    // Credentials, shown once.
    const bearer = await k.connectionService().create({ name: "Bearer agent", provider: "claude", ownerId: "owner_1", authMethod: "BEARER", actorId: SUPER })
    const signed = await k.connectionService().create({ name: "Signed agent", provider: "custom", ownerId: "owner_1", authMethod: "SIGNED_REQUEST", actorId: SUPER })
    if (bearer.credential.authMethod !== "BEARER" || signed.credential.authMethod !== "SIGNED_REQUEST") throw new Error("unexpected credential shapes")
    const token = bearer.credential.bearerToken
    const signingSecret = signed.credential.signingSecret
    const { trigger, webhookSecret } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: bearer.connection.id, capabilityId: "products.list" }, SUPER)

    const credentialRows = Array.from(k.approval._credentials.values()) as Array<Record<string, any>>
    const bearerRow = credentialRows.find((c) => c.connectionId === bearer.connection.id)!
    expect(bearerRow.secretHash).toBe(createHash("sha256").update(token, "utf8").digest("hex"))
    const signedRow = credentialRows.find((c) => c.connectionId === signed.connection.id)!
    expect(signedRow.signingSecretRef).not.toContain(signingSecret)
    expect(decrypt(signedRow.signingSecretRef)).toBe(signingSecret)
    const triggerRow = k.triggerRow(trigger.triggerRef)!
    expect(triggerRow.webhookSecretRef).not.toContain(webhookSecret!)
    expect(decrypt(triggerRow.webhookSecretRef)).toBe(webhookSecret)

    // A full flow through the REAL MCP route handler with the real token.
    await k.allowRead("products.get")
    k.exec.seedProduct({ id: "prod_s", name: "Secretive", slug: "secretive", status: "AVAILABLE", type: "SAAS" })
    vi.stubEnv("AGENT_GATEWAY_ENABLED", "1")
    vi.stubEnv("AGENT_GATEWAY_MCP_ENABLED", "1")
    // tests/setup.ts pins the Phase 1 env store; this flow uses the real Phase 2 DB-backed store.
    vi.stubEnv("AGENT_GATEWAY_CREDENTIAL_STORE", "db")
    vi.doMock("../limits/rate-limiter", () => ({
      GatewayRedisRateLimiter: class {
        check = vi.fn(async () => ({ allowed: true, limit: 60, remaining: 59, resetAt: new Date() }))
      },
    }))
    try {
      const { __resetGatewayConfigForTests } = await import("../config")
      const { __resetMcpConfigForTests } = await import("../mcp/config")
      __resetGatewayConfigForTests()
      __resetMcpConfigForTests()
      const { gatewayLogger } = await import("../observability/request-log")
      const logged: string[] = []
      for (const level of ["info", "warn", "error", "debug"] as const) {
        vi.spyOn(gatewayLogger, level).mockImplementation(((...args: unknown[]) => void logged.push(JSON.stringify(args))) as never)
      }
      const tracing = await import("../observability/tracing")
      const spans: unknown[] = []
      const remove = tracing.addSpanObserver((s) => spans.push(s))
      const { handleMcpRequest } = await import("../mcp/route-handler")
      const call = (authorization: string, body: unknown) =>
        handleMcpRequest(
          new Request("https://abhibhideveloper.online/api/agent-gateway/mcp", {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization },
            body: JSON.stringify(body),
          })
        )
      const ok = await call(`Bearer ${token}`, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "products.get", arguments: { id: "prod_s" } } })
      expect(ok.status).toBe(200)
      const okBody = await ok.json()
      expect(okBody.result.structuredContent).toMatchObject({ id: "prod_s" })
      const forged = `agw_${"9".repeat(64)}`
      const denied = await call(`Bearer ${forged}`, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
      expect(denied.status).toBe(401)
      const deniedText = await denied.text()
      remove()

      // Approve something so a step-up code exists in the flow.
      await k.autonomyStore.setAutonomyPolicy({ connectionId: "conn_1", autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "READ", approvalRequiredFor: ["products.get"], actorId: SUPER })
      const needs = await k.tool("products.get", { id: "prod_1" })
      await k.approve(/apr_[0-9a-f]{32}/.exec(needs.text)![0])

      await k.settle()
      await ledger.flushAuditLedger()
      const metrics = await import("../observability/agent-metrics")
      const everything = JSON.stringify({
        logged,
        spans,
        metrics: metrics.getAgentMetricsSnapshot(),
        deniedText,
        okBody,
        tables: [
          k.approval._auditEvents,
          k.approval._auditLogs,
          k.approval._connections,
          k.approval._credentials,
          k.approval._requests,
          k.approval._decisions,
          k.approval._tasks,
          k.approval._triggers,
          k.approval._triggerRuns,
        ].map((m) => Array.from(m.values())),
      })
      for (const secret of [token, forged, signingSecret, webhookSecret!]) expect(everything).not.toContain(secret)
      expect(everything).not.toMatch(/"(?:stepUpCode|otp)"\s*:\s*"123456"/)
      expect(logged.length).toBeGreaterThan(0) // the flow was actually logged, and redacted
    } finally {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    }
  })
})
