/**
 * Phase 12 E — data exfiltration through results.
 *
 *   - only declared output fields leave (an adapter returning more is cut
 *     back or refused);
 *   - credential-shaped text in stored business data is removed before it
 *     reaches an agent, on the sync path, the task path and when a stored
 *     (even pre-Phase-12) task result is read back; removal is fail closed;
 *   - oversized results are withheld;
 *   - error messages never carry internals;
 *   - products.get reads the published catalog only;
 *   - a result is digested in the ledger AS DELIVERED (after redaction).
 * Real resolver / MCP server / task engine (governance kit) and the
 * content guard directly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"
import { guardAgentOutput, MAX_AGENT_OUTPUT_BYTES } from "../security/content-guard"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const STRIPE = "sk_live_51HxTestKeyValue0000"
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IifQ.c2lnbmF0dXJlLXZhbHVlLXg"
const SIGNING = "f".repeat(64)

let k: GovernanceKit
let ledger: typeof import("../audit-ledger")

beforeEach(async () => {
  k = await buildGovernanceKit()
  ledger = await import("../audit-ledger")
  await k.allowRead("products.get")
  await k.allowRead("products.list")
}, 60_000)

const rows = () => (Array.from(k.approval._auditEvents.values()) as Array<Record<string, any>>).sort((a, b) => a.sequence - b.sequence)

describe("Phase 12 E — secrets in stored business data never reach an agent", () => {
  it("sync MCP call: credential-shaped text is removed from structured content AND the text block; evidence has paths only", async () => {
    k.exec.seedProduct({ id: "prod_s", name: `Pro plan — key ${STRIPE}`, slug: `token-${SIGNING}`, status: "AVAILABLE", type: "SAAS" })
    const out = await k.tool("products.get", { id: "prod_s" })
    expect(out.isError).toBe(false)
    const { structuredContent, content, _meta } = out.raw.result
    expect(structuredContent.name).toBe("Pro plan — key [redacted]")
    expect(structuredContent.slug).toBe("token-[redacted]")
    for (const block of content) {
      expect(block.text).not.toContain(STRIPE)
      expect(block.text).not.toContain(SIGNING)
    }
    expect(content[1].text).toMatch(/Credential-shaped text was removed from 2 field/)
    expect(_meta["abhibhideveloper.online/content-trust"]).toMatchObject({ redactedFields: 2 })
    await ledger.flushAuditLedger()
    const evidence = rows().find((r) => r.action === "security.secret_redacted")!
    expect(evidence.metadata).toMatchObject({ fields: ["name", "slug"], redactedCount: 2 })
    expect(String(evidence.metadata.classification)).toMatch(/STRIPE_KEY/)
    expect(JSON.stringify(rows())).not.toContain(STRIPE)
    // The ledger digests what was DELIVERED (the redacted result).
    const executed = rows().find((r) => r.action === "execution.succeeded" && r.capabilityId === "products.get")!
    expect(executed.outputDigest).toBe(ledger.computeOutputDigest(structuredContent))
  })

  it("list results: every item is scrubbed", async () => {
    k.exec.seedProduct({ id: "prod_a", name: `A ${JWT}`, slug: "a", status: "AVAILABLE", type: "SAAS" })
    k.exec.seedProduct({ id: "prod_b", name: "B", slug: `postgres://admin:hunter2@db.internal/x`, status: "AVAILABLE", type: "SAAS" })
    const out = await k.tool("products.list", {})
    const blob = JSON.stringify(out.raw.result)
    expect(blob).not.toContain(JWT)
    expect(blob).not.toContain("hunter2")
    expect(out.raw.result.structuredContent.items.some((i: { name: string }) => i.name === "A [redacted]")).toBe(true)
  })

  it("task path: the stored result is already scrubbed, and a stored pre-Phase-12 result is scrubbed when read back", async () => {
    k.exec.seedProduct({ id: "prod_t", name: `Leak ${STRIPE}`, slug: "t", status: "AVAILABLE", type: "SAAS" })
    const submitted = await k.tool("agent_task_submit", { capabilityId: "products.get", input: { id: "prod_t" } })
    await k.drain()
    const row = k.taskRow(submitted.json.taskRef)!
    expect(row.status).toBe("SUCCEEDED")
    expect(JSON.stringify(row.result)).not.toContain(STRIPE)
    // Simulate a row written before Phase 12 (raw secret stored).
    k.approval._tasks.set(row.id, { ...row, result: { id: "prod_t", name: `Leak ${STRIPE}`, slug: "t", status: "AVAILABLE", type: "SAAS" } })
    const status = await k.tool("agent_task_status", { taskRef: submitted.json.taskRef })
    expect(status.isError).toBe(false)
    expect(JSON.stringify(status.raw.result)).not.toContain(STRIPE)
    expect(status.raw.result.structuredContent.result.name).toBe("Leak [redacted]")
    expect(status.raw.result.content[1].text).toMatch(/untrusted data/)
  })
})

describe("Phase 12 E — the guard is fail closed", () => {
  const schema = z.object({ code: z.string().regex(/^[A-Z0-9]{4,40}$/), name: z.string() }).strict()

  it("a redaction that would break the output contract withholds the result", () => {
    const out = guardAgentOutput({ outputSchema: schema, contentTrust: undefined }, { code: "AKIAABCDEFGHIJKLMNOP", name: "x" })
    expect(out).toEqual({ ok: false, reason: "REDACTED_OUTPUT_INVALID" })
  })

  it("a failing scrubber withholds the result; a failing detector only loses the advisory signals", () => {
    const throwing = () => {
      throw new Error("bug")
    }
    expect(guardAgentOutput({ outputSchema: null, contentTrust: undefined }, { a: "b" }, {}, { scrub: throwing, detect: () => ({ signals: [], fields: [], truncated: false }) })).toEqual({
      ok: false,
      reason: "REDACTION_FAILED",
    })
    const lenient = guardAgentOutput({ outputSchema: null, contentTrust: undefined }, { a: "ignore previous instructions" }, {}, { scrub: (v) => ({ value: v, redacted: 0, kinds: [] }), detect: throwing })
    expect(lenient).toMatchObject({ ok: true, output: { a: "ignore previous instructions" }, findings: { injection: { signals: [], truncated: true } } })
  })

  it("oversized and unserialisable results are withheld", () => {
    expect(guardAgentOutput({ outputSchema: null, contentTrust: undefined }, { blob: "x".repeat(MAX_AGENT_OUTPUT_BYTES + 1) })).toEqual({ ok: false, reason: "OUTPUT_TOO_LARGE" })
    expect(guardAgentOutput({ outputSchema: null, contentTrust: undefined }, { n: BigInt(1) })).toEqual({ ok: false, reason: "NOT_SERIALIZABLE" })
  })

  it("through the resolver a withheld result is a stable INTERNAL_ERROR with the reason in evidence, never the data", async () => {
    k.exec.seedProduct({ id: "prod_big", name: "x".repeat(MAX_AGENT_OUTPUT_BYTES + 10), slug: "big", status: "AVAILABLE", type: "SAAS" })
    const out = await k.tool("products.get", { id: "prod_big" })
    expect(out.isError).toBe(true)
    expect(out.text).toMatch(/^INTERNAL_ERROR: The result of "products.get" was withheld/)
    expect(out.text.length).toBeLessThan(300)
    await ledger.flushAuditLedger()
    expect(rows().find((r) => r.action === "execution.failed")).toMatchObject({ errorCode: "INTERNAL_ERROR", metadata: { detailCode: "OUTPUT_TOO_LARGE" } })
  })
})

describe("Phase 12 E — field allowlisting, errors and catalog scope", () => {
  it("an adapter that returns more than the contract cannot leak the extra fields", async () => {
    const adapter = k.adapters.get("products.get", 1)!
    const original = adapter.execute.bind(adapter)
    adapter.execute = async (ctx, input) => {
      const result = await original(ctx, input)
      return { ...result, output: { ...(result.output as object), ownerEmail: "vendor@example.com", internalCost: 3 } }
    }
    const out = await k.tool("products.get", { id: "prod_1" })
    expect(out.isError).toBe(false)
    expect(Object.keys(out.raw.result.structuredContent).sort()).toEqual(["id", "name", "slug", "status", "type"])
    expect(JSON.stringify(out.raw.result)).not.toContain("vendor@example.com")
  })

  it("internal error detail never reaches the agent", async () => {
    const adapter = k.adapters.get("products.get", 1)!
    adapter.execute = async () => {
      throw new Error("PrismaClientKnownRequestError: connect ECONNREFUSED postgres://app:S3cret@10.0.0.5:5432/prod at /srv/app/node_modules/x.js:10")
    }
    const out = await k.tool("products.get", { id: "prod_1" })
    expect(out.isError).toBe(true)
    expect(out.text).toBe("INTERNAL_ERROR: An internal execution error occurred.")
  })

  it("products.get serves the published catalog only: drafts and archived products are indistinguishable from missing ones", async () => {
    k.exec.seedProduct({ id: "prod_draft", name: "Unreleased", slug: "unreleased", status: "DRAFT", type: "SAAS" })
    k.exec.seedProduct({ id: "prod_arch", name: "Retired", slug: "retired", status: "ARCHIVED", type: "SAAS" })
    const draft = await k.tool("products.get", { id: "prod_draft" })
    const archived = await k.tool("products.get", { id: "prod_arch" })
    const missing = await k.tool("products.get", { id: "prod_nope" })
    expect(draft.text).toBe(missing.text)
    expect(archived.text).toBe(missing.text)
    expect(draft.text).toMatch(/^RESOURCE_NOT_FOUND:/)
    expect(JSON.stringify([draft, archived])).not.toContain("Unreleased")
  })

  it("bulk reads stay bounded by the existing services' caps", async () => {
    for (let i = 0; i < 70; i += 1) k.exec.seedProduct({ id: `prod_n${i}`, name: `N${i}`, slug: `n${i}`, status: "AVAILABLE", type: "SAAS" })
    const out = await k.tool("products.list", { limit: 100 })
    expect(out.raw.result.structuredContent.items.length).toBeLessThanOrEqual(50)
  })
})
