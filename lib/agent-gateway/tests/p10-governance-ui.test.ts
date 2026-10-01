/**
 * Phase 10 J — the governance UI, rendered from the REAL page modules to
 * static HTML: accessible markup (captions, column headers, labelled
 * filters, pagination landmark, aria-current), distinct states (empty /
 * unavailable / not found / feature off), server-side pagination links, no
 * secrets in any page, and confirmation on every dangerous action.
 */
import { readFileSync, readdirSync } from "fs"
import path from "path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SUPER, buildGovernanceKit, type GovernanceKit } from "./governance-test-kit"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

let k: GovernanceKit
const PAGE = "@/app/(admin)/admin/agent-governance"
const page = (p: string) => import(`${PAGE}/${p}`) as Promise<{ default: (props: unknown) => unknown }>

beforeEach(async () => {
  k = await buildGovernanceKit()
  k.as(SUPER)
})

function accessibleTables(html: string) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? []
  for (const t of tables) {
    expect(t).toMatch(/<caption[^>]*>[^<]+<\/caption>/)
    const ths = t.match(/<th[\s>][^>]*>/g) ?? []
    expect(ths.length).toBeGreaterThan(0)
    for (const th of ths) expect(th).toContain('scope="col"')
  }
  return tables.length
}

function labelledControls(html: string) {
  const ids = Array.from(html.matchAll(/<(?:select|input|textarea)[^>]*\bid="([^"]+)"/g)).map((m) => m[1])
  for (const id of ids) expect(html, id).toContain(`for="${id}"`)
  return ids.length
}

describe("Phase 10 J — accessible markup", () => {
  it("list pages: captioned tables with column headers, labelled filters, a labelled pagination landmark", async () => {
    await k.allowRead("products.get")
    for (let i = 0; i < 25; i += 1) await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: `p${i}` } })
    for (const [p, pathname] of [
      ["tasks/page", "/admin/agent-governance/tasks"],
      ["connections/page", "/admin/agent-governance/connections"],
      ["capabilities/page", "/admin/agent-governance/capabilities"],
      ["policies/page", "/admin/agent-governance/policies"],
    ] as const) {
      const { html } = await k.render(await page(p), { pathname })
      expect(accessibleTables(html!), p).toBeGreaterThan(0)
      expect(labelledControls(html!), p).toBeGreaterThan(0)
      expect(html).toContain('role="search"')
    }
    const { html } = await k.render(await page("tasks/page"), { pathname: "/admin/agent-governance/tasks" })
    expect(html).toContain('<nav aria-label="Pagination"')
    expect(html).toContain("Page 1 of 2")
  })

  it("the section navigation marks exactly the current section", async () => {
    const layout = await page("layout")
    for (const [pathname, label] of [
      ["/admin/agent-governance", "Overview"],
      ["/admin/agent-governance/triggers/trg_abc", "Triggers"],
      ["/admin/agent-governance/schedules", "Schedules"],
    ] as const) {
      const { html } = await k.render(layout, { layout: true, pathname })
      expect(html).toContain('aria-label="Agent governance sections"')
      const current = Array.from(html!.matchAll(/<a[^>]*aria-current="page"[^>]*>([^<]+)<\/a>/g)).map((m) => m[1])
      expect(current).toEqual([label])
    }
  })

  it("forms label every control (create connection, policy, trigger; autonomy editor)", async () => {
    for (const [p, params] of [
      ["connections/page", {}],
      ["policies/page", {}],
      ["triggers/page", {}],
      ["connections/[id]/page", { id: "conn_1" }],
    ] as const) {
      const { html } = await k.render(await page(p), { params })
      expect(labelledControls(html!), p).toBeGreaterThan(3)
    }
  })
})

describe("Phase 10 J — distinct states", () => {
  it("empty, unavailable, not found and feature-off are different, explicit states", async () => {
    const empty = await k.render(await page("tasks/page"))
    expect(empty.html).toContain("No task matches these filters.")
    expect(empty.html).not.toContain('role="alert"')

    vi.spyOn(k.approval.client.agentTask, "findMany").mockRejectedValueOnce(new Error("db down: password=hunter2"))
    const down = await k.render(await page("tasks/page"))
    expect(down.html).toContain('role="alert"')
    expect(down.html).toContain("could not be loaded")
    expect(down.html).not.toContain("hunter2")

    expect((await k.render(await page("tasks/[ref]/page"), { params: { ref: `atk_${"0".repeat(32)}` } })).notFound).toBe(true)
    expect((await k.render(await page("tasks/[ref]/page"), { params: { ref: "../../etc/passwd" } })).notFound).toBe(true)
    expect((await k.render(await page("triggers/[ref]/page"), { params: { ref: "trg_nope" } })).notFound).toBe(true)
    expect((await k.render(await page("policies/[id]/page"), { params: { id: "missing" } })).notFound).toBe(true)
    expect((await k.render(await page("connections/[id]/page"), { params: { id: "conn_missing" } })).notFound).toBe(true)

    const off = await k.render(await page("triggers/page"))
    expect(off.html).toContain('role="note"')
    expect(off.html).toContain("Triggers are switched off")
  })

  it("unknown filter values are ignored (never passed to a query), known ones are echoed", async () => {
    const findMany = vi.spyOn(k.approval.client.agentTask, "findMany")
    await k.render(await page("tasks/page"), { searchParams: { status: "QUEUED' OR 1=1 --", origin: "TRIGGER" } })
    const where = (findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown> }).where
    expect(where).not.toHaveProperty("status")
    expect(where).toHaveProperty("NOT")
    const { html } = await k.render(await page("tasks/page"), { searchParams: { status: "QUEUED" } })
    expect(html).toMatch(/<option value="QUEUED" selected="">/)
  })
})

describe("Phase 10 J — pagination is server-side and keeps filters", () => {
  it("links to the neighbouring pages carry the active filters", async () => {
    await k.allowRead("products.get")
    for (let i = 0; i < 45; i += 1) await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: `p${i}` } })
    const findMany = vi.spyOn(k.approval.client.agentTask, "findMany")
    const { html } = await k.render(await page("tasks/page"), { searchParams: { page: "2", status: "QUEUED" } })
    expect(findMany.mock.calls.at(-1)![0]).toMatchObject({ skip: 20, take: 20 })
    expect(html).toContain("Page 2 of 3")
    expect(html).toContain('href="/admin/agent-governance/tasks?status=QUEUED&amp;page=1"')
    expect(html).toContain('href="/admin/agent-governance/tasks?status=QUEUED&amp;page=3"')
  })
})

describe("Phase 10 J — no secret ever reaches a page", () => {
  it("credential hashes, webhook secrets and ciphertexts never appear in any governance page", async () => {
    const created = await k.call(await import("@/app/api/admin/agent-connections/route"), "POST", {
      path: "/api/admin/agent-connections",
      body: { name: "Agent X", provider: "custom", ownerId: "owner_1" },
    })
    const token: string = created.json.credential.bearerToken
    const connectionId: string = created.json.connection.id
    const cred = Array.from(k.approval._credentials.values()).find((c) => c.connectionId === connectionId)!
    const { trigger, webhookSecret } = await k.triggerService.create({ type: "WEBHOOK", name: "Hook", connectionId, capabilityId: "products.list" }, SUPER)
    const ciphertext = String(k.triggerRow(trigger.triggerRef)!.webhookSecretRef)
    const forbidden = [token, String(cred.secretHash), webhookSecret!, ciphertext]
    for (const [p, params] of [
      ["page", {}],
      ["connections/page", {}],
      ["connections/[id]/page", { id: connectionId }],
      ["triggers/page", {}],
      ["triggers/[ref]/page", { ref: trigger.triggerRef }],
      ["webhooks/page", {}],
      ["runtime/page", {}],
      ["autonomy/page", {}],
    ] as const) {
      const { html } = await k.render(await page(p), { params })
      expect(html, p).toBeTruthy()
      for (const f of forbidden) expect(html, `${p} leaks a secret`).not.toContain(f)
    }
  })
})

describe("Phase 10 J — dangerous operations are confirmed", () => {
  const dir = path.resolve("components/admin/agent-governance")
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => ({ file: f, text: readFileSync(path.join(dir, f), "utf8") }))
    .concat(
      ["tasks/[ref]/page.tsx"].map((f) => ({ file: f, text: readFileSync(path.resolve("app/(admin)/admin/agent-governance", f), "utf8") }))
    )

  it("every ActionButton carries a confirmation", () => {
    let count = 0
    for (const { file, text } of sources) {
      if (file === "ActionButton.tsx") continue
      for (const usage of text.split("<ActionButton").slice(1)) {
        count += 1
        const props = usage.slice(0, usage.indexOf("/>"))
        expect(props, file).toContain("confirm={")
      }
    }
    expect(count).toBeGreaterThanOrEqual(15)
  })

  it("destructive / terminal actions require a reason, and forms confirm before publishing", () => {
    const all = sources.map((s) => s.text).join("\n")
    for (const label of ["Revoke", "Disable policy", "Rotate signing secret", "Cancel task", "Roll back"]) {
      const at = all.indexOf(`label="${label}"`)
      expect(at, label).toBeGreaterThan(-1)
      const block = all.slice(at, all.indexOf("/>", at))
      expect(block, label).toMatch(/requireReason: true|destructive: true/)
    }
    for (const form of ["AutonomyEditor.tsx", "PolicyForm.tsx", "CreateTriggerForm.tsx"]) {
      expect(sources.find((s) => s.file === form)!.text, form).toContain("<ConfirmDialog")
    }
  })

  it("task detail offers cancellation only while a task can still be cancelled", async () => {
    await k.allowRead("products.get")
    const { task } = await k.taskService.submit(k.agentCtx(), "development", { capabilityId: "products.get", input: { id: "prod_1" } })
    const before = await k.render(await page("tasks/[ref]/page"), { params: { ref: task.taskRef } })
    expect(before.html).toContain("Cancel task")
    await k.drain()
    const after = await k.render(await page("tasks/[ref]/page"), { params: { ref: task.taskRef } })
    expect(after.html).not.toContain("Cancel task")
    expect(after.html).toContain("SUCCEEDED")
  })

  it("connection actions follow the connection state", async () => {
    const active = await k.render(await page("connections/[id]/page"), { params: { id: "conn_1" } })
    expect(active.html).toContain(">Suspend<")
    expect(active.html).toContain(">Revoke<")
    expect(active.html).not.toContain(">Reactivate<")
    k.approval.updateConnection("conn_1", { status: "REVOKED" })
    const revoked = await k.render(await page("connections/[id]/page"), { params: { id: "conn_1" } })
    expect(revoked.html).not.toContain(">Suspend<")
    expect(revoked.html).not.toContain(">Revoke<")
  })
})
