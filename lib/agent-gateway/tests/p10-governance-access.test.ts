/**
 * Phase 10 A — server-side authorization of Agent Governance, against the
 * REAL lib/admin-auth.ts and Phase 7 human-session checks: every page and
 * every route is SUPER_ADMIN only; sub-admins are refused even holding every
 * sub-admin permission; agent credentials are refused on every mutation.
 * Also J — the closed route inventory (no generic endpoint).
 */
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BANNED, PLAIN_USER, SUB, SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"

// Page modules render the real component tree; the first import is cold.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

let k: GovernanceKit
let ids: { policyId: string; taskRef: string; triggerRef: string }

const PAGE = "@/app/(admin)/admin/agent-governance"

beforeEach(async () => {
  k = await buildGovernanceKit()
  const policy = await k.allowRead("products.get")
  const { task } = await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: "prod_1" } })
  const { trigger } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId: "conn_1", capabilityId: "products.list" }, SUPER)
  ids = { policyId: policy.policyId, taskRef: task.taskRef, triggerRef: trigger.triggerRef }
}, 60_000)

async function pages() {
  return [
    { name: "overview", mod: await import(`${PAGE}/page`) },
    { name: "connections", mod: await import(`${PAGE}/connections/page`) },
    { name: "connection detail", mod: await import(`${PAGE}/connections/[id]/page`), params: { id: "conn_1" } },
    { name: "capabilities", mod: await import(`${PAGE}/capabilities/page`) },
    { name: "policies", mod: await import(`${PAGE}/policies/page`) },
    { name: "policy detail", mod: await import(`${PAGE}/policies/[id]/page`), params: { id: ids.policyId } },
    { name: "autonomy", mod: await import(`${PAGE}/autonomy/page`) },
    { name: "approvals", mod: await import(`${PAGE}/approvals/page`) },
    { name: "tasks", mod: await import(`${PAGE}/tasks/page`) },
    { name: "task detail", mod: await import(`${PAGE}/tasks/[ref]/page`), params: { ref: ids.taskRef } },
    { name: "triggers", mod: await import(`${PAGE}/triggers/page`) },
    { name: "trigger detail", mod: await import(`${PAGE}/triggers/[ref]/page`), params: { ref: ids.triggerRef } },
    { name: "schedules", mod: await import(`${PAGE}/schedules/page`) },
    { name: "webhooks", mod: await import(`${PAGE}/webhooks/page`) },
    { name: "runtime", mod: await import(`${PAGE}/runtime/page`) },
    { name: "release controls", mod: await import(`${PAGE}/release/page`) },
  ] as Array<{ name: string; mod: { default: (p: unknown) => unknown }; params?: Record<string, string> }>
}

const API = "@/app/api/admin/agent-governance"

interface RouteCase {
  name: string
  mod?: unknown
  modPath?: string
  method: "POST" | "PATCH"
  path: string
  params: Record<string, string>
  body: unknown
}

async function routes(): Promise<RouteCase[]> {
  const t = ids.triggerRef
  return [
    { name: "create trigger", mod: await import(`${API}/triggers/route`), method: "POST" as const, path: "/api/admin/agent-governance/triggers", params: {}, body: { type: "WEBHOOK", name: "x", connectionId: "conn_1", capabilityId: "products.list" } },
    { name: "update trigger", mod: await import(`${API}/triggers/[ref]/route`), method: "PATCH" as const, path: `/api/admin/agent-governance/triggers/${t}`, params: { ref: t }, body: { expectedVersion: 1, patch: { name: "renamed" } } },
    ...(["activate", "pause", "resume", "disable", "revoke", "rotate-secret"] as const).map((a) => ({
      name: `${a} trigger`,
      modPath: `${API}/triggers/[ref]/${a}/route`,
      method: "POST" as const,
      path: `/api/admin/agent-governance/triggers/${t}/${a}`,
      params: { ref: t },
      body: { expectedVersion: 1 },
    })),
    { name: "cancel task", mod: await import(`${API}/tasks/[ref]/cancel/route`), method: "POST" as const, path: `/api/admin/agent-governance/tasks/${ids.taskRef}/cancel`, params: { ref: ids.taskRef }, body: { expectedStatus: "QUEUED" } },
    { name: "create policy", mod: await import(`${API}/policies/route`), method: "POST" as const, path: "/api/admin/agent-governance/policies", params: {}, body: { name: "p", effect: "DENY", scope: "GLOBAL" } },
    { name: "publish version", mod: await import(`${API}/policies/[id]/versions/route`), method: "POST" as const, path: `/api/admin/agent-governance/policies/${ids.policyId}/versions`, params: { id: ids.policyId }, body: { effect: "DENY", scope: "GLOBAL", expectedCurrentVersion: 1 } },
    { name: "rollback", mod: await import(`${API}/policies/[id]/rollback/route`), method: "POST" as const, path: `/api/admin/agent-governance/policies/${ids.policyId}/rollback`, params: { id: ids.policyId }, body: { targetVersion: 1, expectedCurrentVersion: 2 } },
    { name: "enable policy", mod: await import(`${API}/policies/[id]/enable/route`), method: "POST" as const, path: `/api/admin/agent-governance/policies/${ids.policyId}/enable`, params: { id: ids.policyId }, body: {} },
    { name: "disable policy", mod: await import(`${API}/policies/[id]/disable/route`), method: "POST" as const, path: `/api/admin/agent-governance/policies/${ids.policyId}/disable`, params: { id: ids.policyId }, body: {} },
    // Phase 15 — release controls
    { name: "activate kill switch", mod: await import(`${API}/kill-switches/route`), method: "POST" as const, path: "/api/admin/agent-governance/kill-switches", params: {}, body: { scope: "GLOBAL", reason: "drill" } },
    { name: "deactivate kill switch", mod: await import(`${API}/kill-switches/[ref]/deactivate/route`), method: "POST" as const, path: `/api/admin/agent-governance/kill-switches/ksw_${"0".repeat(32)}/deactivate`, params: { ref: `ksw_${"0".repeat(32)}` }, body: { expectedVersion: 1, reason: "drill" } },
    { name: "configure rollout", mod: await import(`${API}/rollouts/route`), method: "POST" as const, path: "/api/admin/agent-governance/rollouts", params: {}, body: { capabilityId: "products.get", canaryPercent: 0, allowedConnectionIds: [], reason: "drill" } },
    { name: "transition rollout", mod: await import(`${API}/rollouts/transition/route`), method: "POST" as const, path: "/api/admin/agent-governance/rollouts/transition", params: {}, body: { capabilityId: "products.get", action: "advance", expectedVersion: 1, reason: "drill" } },
    { name: "record attestation", mod: await import(`${API}/attestations/route`), method: "POST" as const, path: "/api/admin/agent-governance/attestations", params: {}, body: { capabilityId: "products.get", confirmed: [], reason: "drill" } },
    { name: "change autonomy", mod: await import(`${API}/connections/[id]/autonomy/route`), method: "POST" as const, path: "/api/admin/agent-governance/connections/conn_1/autonomy", params: { id: "conn_1" }, body: { direction: "promote", reason: "drill" } },
  ]
}

async function routeModule(r: { mod?: unknown; modPath?: string }) {
  return (r.mod ?? (await import(r.modPath!))) as Record<string, unknown>
}

function stateFingerprint() {
  const sizes = [k.approval._triggers, k.approval._tasks, k.approval._autonomy, k.authz._policies, k.authz._versions].map((m) => m.size)
  return JSON.stringify({
    sizes,
    triggers: Array.from(k.approval._triggers.values()).map((t) => [t.status, t.version, t.name]),
    tasks: Array.from(k.approval._tasks.values()).map((t) => t.status),
    policies: Array.from(k.authz._policies.values()).map((p) => [p.enabled, p.currentVersionId]),
  })
}

describe("Phase 10 A — governance pages are SUPER_ADMIN only", () => {
  it("a super administrator can open every page and the layout", async () => {
    k.as(SUPER)
    for (const p of await pages()) {
      const out = await k.render(p.mod, { params: p.params })
      expect(out.redirect, p.name).toBeUndefined()
      expect(out.notFound, p.name).toBeUndefined()
      expect(out.html, p.name).toBeTruthy()
    }
    const layout = await k.render(await import(`${PAGE}/layout`), { layout: true })
    expect(layout.html).toContain("Agent Governance")
    expect(layout.html).toContain("page-content")
  })

  it.each([
    ["a sub-admin holding EVERY sub-admin permission", SUB, "/unauthorized"],
    ["a regular user", PLAIN_USER, "/unauthorized"],
    ["a banned super administrator", BANNED, "/unauthorized"],
    ["an anonymous visitor", null, "/login"],
  ])("%s is redirected from every page and the layout", async (_label, user, target) => {
    k.as(user)
    for (const p of await pages()) {
      const out = await k.render(p.mod, { params: p.params })
      expect(out.redirect, p.name).toBe(target)
      expect(out.html, p.name).toBeUndefined()
    }
    expect((await k.render(await import(`${PAGE}/layout`), { layout: true })).redirect).toBe(target)
  })

  it("the admin root layout's requireAdmin() also refuses sub-admins here (governance is not a sub-admin resource)", async () => {
    const policy = await import("@/lib/subadmin-permission-policy")
    expect(policy.resourceForAdminPath("/admin/agent-governance")).toBeNull()
    expect(policy.resourceForAdminPath("/admin/agent-governance/triggers/trg_x")).toBeNull()
    expect(policy.resourceForAdminApiPath("/api/admin/agent-governance/triggers")).toBeNull()
    const source = readFileSync(path.resolve("lib/subadmin-permission-policy.ts"), "utf8")
    expect(source).not.toMatch(/agent-governance|agent-connections|agent-approvals/)
    // What proxy.ts sets for this path: protected scope, no resource.
    k.requestHeaders.set("x-nexusai-admin-permission-scope", "true")
    k.requestHeaders.set("x-nexusai-admin-action", "VIEW")
    k.as(SUB)
    const { requireAdmin } = await import("@/lib/admin-auth")
    const err = await requireAdmin().catch((e) => e)
    expect((err as { digest?: string }).digest).toContain("/unauthorized")
  })

  it("the sidebar entry is super-admin only", () => {
    const source = readFileSync(path.resolve("components/admin/AdminLayoutClient.tsx"), "utf8")
    expect(source).toMatch(/name: "Agent Governance",\s+path: "\/admin\/agent-governance",[^}]*superAdminOnly: true/)
  })
})

describe("Phase 10 A — governance mutations are SUPER_ADMIN only and refuse agent credentials", () => {
  it.each([
    ["a sub-admin holding every permission", SUB, "/unauthorized"],
    ["a regular user", PLAIN_USER, "/unauthorized"],
    ["an anonymous caller", null, "/login"],
  ])("%s is redirected by every route and nothing changes", async (_label, user, target) => {
    const before = stateFingerprint()
    k.as(user)
    for (const r of await routes()) {
      const res = await k.call(await routeModule(r), r.method, { path: r.path, params: r.params, body: r.body })
      expect(res.redirect, r.name).toBe(target)
    }
    await k.settle()
    expect(stateFingerprint()).toBe(before)
    expect(k.auditEntries()).toHaveLength(0)
  })

  it("an agent credential is refused even alongside a super-admin session (bearer or signed-request headers)", async () => {
    const before = stateFingerprint()
    k.as(SUPER)
    const headerSets: Array<Record<string, string>> = [{ authorization: "Bearer agw_" + "a".repeat(64) }, { "x-abhibhi-key-id": "key_1", "x-abhibhi-signature": "0".repeat(64) }]
    for (const headers of headerSets) {
      for (const r of await routes()) {
        const res = await k.call(await routeModule(r), r.method, { path: r.path, params: r.params, body: r.body, headers })
        expect(res.status, r.name).toBe(401)
        expect(res.json, r.name).toMatchObject({ success: false, code: "HUMAN_APPROVAL_INVALID" })
      }
    }
    await k.settle()
    expect(stateFingerprint()).toBe(before)
  })

  it("a super administrator without a live Clerk session is refused", async () => {
    k.as(SUPER, null)
    for (const r of await routes()) {
      const res = await k.call(await routeModule(r), r.method, { path: r.path, params: r.params, body: r.body })
      expect(res.status, r.name).toBe(401)
    }
  })

  it("non-JSON bodies (the shape of a cross-site form post) are refused with 415 after authentication", async () => {
    const before = stateFingerprint()
    k.as(SUPER)
    for (const r of await routes()) {
      const res = await k.call(await routeModule(r), r.method, { path: r.path, params: r.params, rawBody: "expectedVersion=1", contentType: "application/x-www-form-urlencoded" })
      expect(res.status, r.name).toBe(415)
      expect(res.json.code).toBe("UNSUPPORTED_MEDIA_TYPE")
    }
    expect(stateFingerprint()).toBe(before)
  })

  it("the existing connection and autonomy routes keep their SUPER_ADMIN gate", async () => {
    k.as(SUB)
    for (const action of ["suspend", "reactivate", "revoke", "rotate"]) {
      const mod = await import(`@/app/api/admin/agent-connections/[id]/${action}/route`)
      const res = await k.call(mod, "POST", { path: `/api/admin/agent-connections/conn_1/${action}`, params: { id: "conn_1" }, body: {} })
      expect(res.redirect, action).toBe("/unauthorized")
    }
    const autonomy = await import("@/app/api/admin/agent-connections/[id]/autonomy/route")
    expect((await k.call(autonomy, "PUT", { path: "/api/admin/agent-connections/conn_1/autonomy", params: { id: "conn_1" }, body: { autonomyLevel: "FULL_SCOPED_AUTONOMY", maxRiskTier: "CRITICAL" } })).redirect).toBe("/unauthorized")
    expect(k.connectionService).toBeTypeOf("function")
    expect(k.approval._connections.get("conn_1")!.status).toBe("ACTIVE")
  })
})

describe("Phase 10 J — closed route inventory (no generic endpoint)", () => {
  function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) return routeFiles(full)
      return entry === "route.ts" ? [full] : []
    })
  }

  it("exactly the named operations exist, each with exactly one mutating method and no catch-all segment", async () => {
    const root = path.resolve("app/api/admin/agent-governance")
    const files = routeFiles(root).map((f) => path.relative(root, f).split(path.sep).join("/")).sort()
    expect(files).toEqual(
      [
        // Phase 11: chain verification and capability-aware recovery requests.
        "ledger/verify/route.ts",
        "recoveries/route.ts",
        // Phase 15: release controls (kill switches, rollouts, attestations, guarded autonomy).
        "kill-switches/route.ts",
        "kill-switches/[ref]/deactivate/route.ts",
        "rollouts/route.ts",
        "rollouts/transition/route.ts",
        "attestations/route.ts",
        "connections/[id]/autonomy/route.ts",
        "policies/[id]/disable/route.ts",
        "policies/[id]/enable/route.ts",
        "policies/[id]/rollback/route.ts",
        "policies/[id]/versions/route.ts",
        "policies/route.ts",
        "tasks/[ref]/cancel/route.ts",
        "triggers/[ref]/activate/route.ts",
        "triggers/[ref]/disable/route.ts",
        "triggers/[ref]/pause/route.ts",
        "triggers/[ref]/resume/route.ts",
        "triggers/[ref]/revoke/route.ts",
        "triggers/[ref]/rotate-secret/route.ts",
        "triggers/[ref]/route.ts",
        "triggers/route.ts",
      ].sort()
    )
    for (const f of files) {
      expect(f).not.toMatch(/\[\.\.\./)
      const mod = (await import(`${API}/${f.replace(/\.ts$/, "")}`)) as Record<string, unknown>
      const methods = Object.keys(mod).filter((key) => ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(key))
      expect(methods, f).toEqual([f === "triggers/[ref]/route.ts" ? "PATCH" : "POST"])
      expect(mod.dynamic, f).toBe("force-dynamic")
    }
  })

  it("no governance code exposes an agent-callable path (no MCP tool, gateway route or capability for governance)", () => {
    const mcpTools = readFileSync(path.resolve("lib/agent-gateway/mcp/task-tools.ts"), "utf8")
    expect(mcpTools).not.toMatch(/governance|trigger|policy/i)
    const manifest = readFileSync(path.resolve("lib/agent-gateway/capabilities/manifest.ts"), "utf8")
    expect(manifest).not.toMatch(/governance|agentTrigger|autonomy\./i)
  })
})
