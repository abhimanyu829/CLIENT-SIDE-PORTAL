/**
 * Phase 12 D — tool security: the MCP tool surface is exactly the set of
 * executable, agent-available capabilities (plus the reserved task tools);
 * every tool's schema is closed; tool metadata is static, operator-authored
 * and free of instruction-like text (no tool poisoning); annotations follow
 * Phase 3 metadata; a tool that stops being executable stops being callable.
 * Real MCP server (governance test kit).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"
import { detectInText } from "../security/injection-detector"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

let k: GovernanceKit
type ListedTool = { name: string; title?: string; description?: string; inputSchema: Record<string, any>; outputSchema?: Record<string, any>; annotations?: Record<string, unknown> }

async function listTools(): Promise<ListedTool[]> {
  const out = await k.mcp("tools/list", {})
  return out.result.tools as ListedTool[]
}

beforeEach(async () => {
  k = await buildGovernanceKit()
}, 60_000)

describe("Phase 12 D — executable-only tool surface", () => {
  it("lists exactly the executable agent-available capabilities and the three task tools", async () => {
    const names = (await listTools()).map((t) => t.name).sort()
    const executable = k.registry
      .list()
      .filter((d) => d.exposure === "AGENT_AVAILABLE" && d.status === "ACTIVE" && d.executionReference !== null && k.adapters.has(d.id, d.version))
      .map((d) => d.id)
    expect(names).toEqual([...executable, "agent_task_cancel", "agent_task_status", "agent_task_submit"].sort())
    expect(names).toEqual(["agent_task_cancel", "agent_task_status", "agent_task_submit", "products.get", "products.list", "subscriptions.get", "tickets.list"])
    // Contract-only capabilities (no adapter) and non-agent exposure are never tools.
    for (const hidden of ["products.createDraft", "coupons.create", "products.updatePricing", "refunds.process"]) expect(names).not.toContain(hidden)
  })

  it("an unlisted capability cannot be called by name and creates no approval or task", async () => {
    for (const name of ["coupons.create", "products.createDraft", "products.updatePricing", "refunds.process", "products.get@v1", "../products.get"]) {
      const out = await k.tool(name, {})
      expect(out.isError, name).toBe(true)
    }
    expect(k.approval._requests.size).toBe(0)
    expect(k.approval._tasks.size).toBe(0)
  })

  it("a capability whose adapter is gone is refused at call time even if the server listed it", async () => {
    await k.allowRead("products.get")
    k.exec.seedProduct({ id: "prod_9", name: "Gamma", slug: "gamma", status: "AVAILABLE", type: "SAAS" })
    const { createMcpServerForRequest } = await import("../mcp/server")
    const { AdapterRegistry } = await import("../execution/resolver/adapter-registry")
    const { buildAuthInfoExtra } = await import("../mcp/identity-context")
    const { WebStandardStreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js")
    // A registry view whose `has()` flips to false after tools/list was built.
    let present = true
    const flipping = Object.assign(Object.create(AdapterRegistry.prototype), k.adapters, {
      has: (id: string, v: number) => present && k.adapters.has(id, v),
      get: (id: string, v: number) => (present ? k.adapters.get(id, v) : null),
    })
    const ctx = k.agentCtx()
    const server = createMcpServerForRequest({ capabilityRegistry: k.registry, adapterRegistry: flipping, authorizer: k.gate }, ctx, "development")
    present = false
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    const res = await transport.handleRequest(
      new Request("https://abhibhi.test/api/agent-gateway/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "products.get", arguments: { id: "prod_9" } } }),
      }),
      { authInfo: { token: "", clientId: "conn_1", scopes: [], extra: buildAuthInfoExtra(ctx, "development") } }
    )
    const body = (await res.json()) as { result: { isError: boolean; content: Array<{ text: string }> } }
    await transport.close()
    await server.close()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toMatch(/^CAPABILITY_NOT_FOUND:/)
  })

  it("registering an adapter makes a capability a tool (the rule is about executability, not names)", async () => {
    const { projectTools } = await import("../mcp/tool-projection")
    const before = projectTools(k.registry, k.adapters).map((t) => t.name)
    expect(before).not.toContain("coupons.create")
    k.adapters.register({ capabilityId: "coupons.create", capabilityVersion: 1, execute: async () => ({ output: { id: "c", code: "X", isActive: true }, executionMode: "SYNC", durationMs: 0 }) })
    expect(projectTools(k.registry, k.adapters).map((t) => t.name)).toContain("coupons.create")
    // Without an adapter registry (legacy callers) the Phase 5 contract-level view is unchanged.
    expect(projectTools(k.registry).map((t) => t.name)).toContain("products.createDraft")
  })
})

describe("Phase 12 D — closed schemas and static, clean metadata", () => {
  it("every capability tool takes a closed object schema and declares an output schema", async () => {
    for (const tool of await listTools()) {
      expect(tool.inputSchema.type, tool.name).toBe("object")
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false)
      if (!tool.name.startsWith("agent_task_")) expect(tool.outputSchema, tool.name).toBeDefined()
    }
  })

  it("unknown arguments (including identity fields) are refused before anything runs", async () => {
    await k.allowRead("products.get")
    for (const extra of [{ ownerId: "owner_2" }, { connectionId: "conn_2" }, { role: "SUPER_ADMIN" }, { environment: "production" }]) {
      const out = await k.tool("products.get", { id: "prod_1", ...extra })
      expect(out.isError, JSON.stringify(extra)).toBe(true)
    }
    const { counterTotal } = await import("../observability/agent-metrics")
    expect(counterTotal("agent_execution_total", { capability: "products.get" })).toBe(0)
  })

  it("names, titles and descriptions are short, static and contain nothing instruction-like (no tool poisoning)", async () => {
    const tools = await listTools()
    for (const tool of tools) {
      expect(tool.name).toMatch(/^(?:[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*|agent_task_(?:submit|status|cancel))$/)
      const text = `${tool.title ?? ""}\n${tool.description ?? ""}`
      expect(text.length, tool.name).toBeLessThan(600)
      expect(text, tool.name).not.toMatch(/https?:\/\//)
      // Operator-authored metadata may name a companion tool (agent_task_submit
      // points at agent_task_status); every other signal is forbidden.
      expect(detectInText(text).filter((s) => s !== "TOOL_INVOCATION"), tool.name).toEqual([])
      // ...but never a capability that is not itself a tool.
      expect(text, tool.name).not.toMatch(/refunds\.process|products\.updatePricing|coupons\.create|products\.createDraft/)
    }
    // Every capability in the manifest, listed or not, passes the same check.
    for (const def of k.registry.list({ includeDisabled: true, includeForbidden: true })) {
      expect(detectInText(`${def.name}\n${def.description}`).filter((s) => s !== "TOOL_INVOCATION"), def.id).toEqual([])
    }
  })

  it("annotations follow Phase 3 metadata (hints for clients; never a control)", async () => {
    const tools = await listTools()
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
    for (const name of ["products.get", "products.list", "subscriptions.get", "tickets.list"]) {
      expect(byName[name].annotations, name).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false })
    }
    const { toolAnnotationsFor } = await import("../mcp/tool-projection")
    const irreversibleWrite = { ...k.registry.getVersion("coupons.create", 1)!, rollback: { reversibility: "IRREVERSIBLE" as const, mechanism: "x" } }
    expect(toolAnnotationsFor(irreversibleWrite)).toEqual({ readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false })
  })
})
