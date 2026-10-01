/**
 * Phase 12 H — supply chain and code integrity.
 *
 *   - the capability surface is pinned: manifest.lock.json must equal the
 *     live summary, and the fingerprint moves with every security-relevant
 *     attribute (never with prose);
 *   - the fingerprint in force is ledger evidence, recorded only on change;
 *   - the dependencies the gateway introduced are exact-pinned and
 *     integrity-locked;
 *   - static scans of the gateway sources: no dynamic code, no raw unsafe
 *     SQL, no insecure randomness, no console logging, env read only by the
 *     config modules, no HTML injection in the agent admin UI, static
 *     adapter wiring only.
 */
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createApprovalFakeDb } from "./approval-fake-db"
import { CORE_CAPABILITY_MANIFEST } from "../capabilities/manifest"
import { manifestFingerprint, summarizeManifest, MANIFEST_SUMMARY_VERSION } from "../capabilities/manifest-summary"
import type { CapabilityDefinition } from "../capabilities/types"

const lock = JSON.parse(readFileSync(path.resolve("lib/agent-gateway/capabilities/manifest.lock.json"), "utf8")) as {
  summaryVersion: number
  fingerprint: string
  capabilities: unknown[]
}

function files(dir: string, ext: RegExp, skipTests = true): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return skipTests && entry === "tests" ? [] : files(full, ext, skipTests)
    return ext.test(entry) ? [full] : []
  })
}
const rel = (f: string) => path.relative(process.cwd(), f).split(path.sep).join("/")
const GATEWAY = files(path.resolve("lib/agent-gateway"), /\.ts$/)

describe("Phase 12 H1 — the capability surface is pinned", () => {
  it("manifest.lock.json equals the live core manifest summary (update the lock in the same reviewed change)", () => {
    expect(lock.summaryVersion).toBe(MANIFEST_SUMMARY_VERSION)
    expect(summarizeManifest(CORE_CAPABILITY_MANIFEST)).toEqual(lock.capabilities)
    expect(manifestFingerprint(CORE_CAPABILITY_MANIFEST)).toBe(lock.fingerprint)
  })

  it("the fingerprint moves with every security-relevant attribute and never with prose", () => {
    const base = manifestFingerprint(CORE_CAPABILITY_MANIFEST)
    const get = CORE_CAPABILITY_MANIFEST.find((d) => d.id === "products.get")!
    const variants: Array<[string, Partial<CapabilityDefinition>]> = [
      ["exposure", { exposure: "INTERNAL_ONLY" }],
      ["risk tier", { operationType: "LOW_RISK_WRITE" }],
      ["status", { status: "DEPRECATED" }],
      ["adapter binding", { executionReference: { adapterKey: "products.otherAdapter" } }],
      ["new input field", { inputSchema: z.object({ id: z.string().min(1).max(64), ownerId: z.string().optional() }).strict() }],
      ["removed input bound", { inputSchema: z.object({ id: z.string().min(1) }).strict() }],
      ["non-strict input", { inputSchema: z.object({ id: z.string().min(1).max(64) }) }],
      ["new output field", { outputSchema: z.object({ id: z.string(), name: z.string(), slug: z.string(), status: z.string(), type: z.string(), email: z.string() }) }],
      ["content trust", { contentTrust: "SYSTEM_GENERATED" }],
      ["identity context", { requiredIdentityContext: [] }],
      ["idempotency", { idempotency: { ...get.idempotency, requiresIdempotencyKey: true } }],
      ["async support", { async: { ...get.async, asyncSupported: false } }],
      ["permission", { permission: { permission: "write:products" } }],
    ]
    for (const [name, patch] of variants) {
      const changed = CORE_CAPABILITY_MANIFEST.map((d) => (d.id === "products.get" ? { ...d, ...patch } : d))
      expect(manifestFingerprint(changed), name).not.toBe(base)
    }
    const prose = CORE_CAPABILITY_MANIFEST.map((d) => (d.id === "products.get" ? { ...d, description: "Reworded.", name: "Renamed", securityClassification: "x" } : d))
    expect(manifestFingerprint(prose)).toBe(base)
    expect(manifestFingerprint([...CORE_CAPABILITY_MANIFEST].reverse())).toBe(base) // order-independent
  })
})

describe("Phase 12 H2 — the capability surface in force is ledger evidence", () => {
  async function setup() {
    vi.resetModules()
    const fake = createApprovalFakeDb()
    vi.doMock("@/lib/db", () => ({ db: fake.client }))
    vi.doMock("@/lib/redis", () => ({ redis: null }))
    const evidence = await import("../capabilities/registry-evidence")
    const { CapabilityRegistry } = await import("../capabilities/registry")
    const { registerCoreCapabilities } = await import("../capabilities/manifest")
    const ledger = await import("../audit-ledger")
    const registry = new CapabilityRegistry()
    registerCoreCapabilities(registry)
    const loaded = () => Array.from(fake._auditEvents.values()).filter((r) => r.action === "capability_registry.loaded") as Array<Record<string, any>>
    return { fake, evidence, registry, ledger, loaded, CapabilityRegistry, registerCoreCapabilities }
  }

  it("records the fingerprint once, not again while unchanged, and again when the surface changes", async () => {
    const t = await setup()
    t.evidence.recordRegistryFingerprint(t.registry)
    await t.ledger.flushAuditLedger()
    expect(t.loaded()).toHaveLength(1)
    expect(t.loaded()[0]).toMatchObject({ category: "CAPABILITY", actorType: "SYSTEM", inputDigest: lock.fingerprint, resourceType: "CapabilityRegistry" })
    expect(t.loaded()[0].metadata).toMatchObject({ capabilityCount: CORE_CAPABILITY_MANIFEST.length, registryFingerprint: lock.fingerprint.slice(0, 32) })

    t.evidence.recordRegistryFingerprint(t.registry)
    await t.ledger.flushAuditLedger()
    expect(t.loaded()).toHaveLength(1)

    const widened = new t.CapabilityRegistry()
    t.registerCoreCapabilities(widened)
    widened.disable("products.list", 1)
    t.evidence.recordRegistryFingerprint(widened)
    await t.ledger.flushAuditLedger()
    expect(t.loaded()).toHaveLength(2)
    expect(t.loaded()[1].inputDigest).not.toBe(lock.fingerprint)
    expect(await t.ledger.verifyAuditChain()).toMatchObject({ ok: true })
  })

  it("is scheduled once per process from the request entry point, and a ledger outage is harmless", async () => {
    const t = await setup()
    t.evidence.__resetRegistryFingerprintForTests()
    const { withRequestTrace } = await import("../observability/request-evidence")
    for (let i = 0; i < 3; i += 1) await withRequestTrace("MCP", `req_${String(i).repeat(32)}`, async () => "ok")
    await t.ledger.flushAuditLedger()
    expect(t.loaded()).toHaveLength(1)
    t.fake.client.agentAuditEvent.findFirst.mockRejectedValue(new Error("db down"))
    const other = new t.CapabilityRegistry()
    expect(() => t.evidence.recordRegistryFingerprint(other)).not.toThrow()
    await t.ledger.flushAuditLedger()
  })
})

describe("Phase 12 H3 — dependencies", () => {
  const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> }
  const lockfile = JSON.parse(readFileSync(path.resolve("package-lock.json"), "utf8")) as { lockfileVersion: number; packages: Record<string, { version?: string; integrity?: string }> }

  it("the packages the agent gateway introduced are exact-pinned, locked at that version and integrity-checked", () => {
    expect(lockfile.lockfileVersion).toBeGreaterThanOrEqual(2)
    for (const name of ["@modelcontextprotocol/sdk", "@opentelemetry/api", "cron-parser"]) {
      const declared = pkg.dependencies[name]
      expect(declared, name).toMatch(/^\d+\.\d+\.\d+$/)
      const locked = lockfile.packages[`node_modules/${name}`]
      expect(locked?.version, name).toBe(declared)
      expect(locked?.integrity, name).toMatch(/^sha512-/)
    }
  })

  it("every package the gateway imports is a declared dependency (no phantom or transitive-only imports)", () => {
    const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies ?? {})])
    const external = new Set<string>()
    for (const f of GATEWAY) {
      // Only real module statements: `import … from "x"`, `export … from "x"`,
      // bare `import "x"` and literal `import("x")` — never prose in comments.
      const source = readFileSync(f, "utf8")
      const specs = [
        ...Array.from(source.matchAll(/^\s*(?:import|export)\s[^;"'`()=]*?\bfrom\s+["']([^"']+)["']/gm), (m) => m[1]),
        ...Array.from(source.matchAll(/^\s*import\s+["']([^"']+)["']/gm), (m) => m[1]),
        ...Array.from(source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g), (m) => m[1]),
      ]
      for (const spec of specs) {
        if (spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("node:")) continue
        const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]
        external.add(name)
      }
    }
    const builtins = new Set(["crypto", "fs", "path", "events", "stream", "net", "dns", "http", "https", "url", "util", "async_hooks", "zlib", "os"])
    // The scan must actually see the gateway's real dependencies.
    for (const known of ["zod", "@modelcontextprotocol/sdk", "@opentelemetry/api", "@prisma/client"]) expect(external.has(known), known).toBe(true)
    const missing = Array.from(external).filter((n) => !declared.has(n) && !builtins.has(n))
    expect(missing).toEqual([])
  })
})

describe("Phase 12 H4 — static scans of the gateway sources", () => {
  const scan = (pattern: RegExp, allow: string[] = []) =>
    GATEWAY.filter((f) => !allow.includes(rel(f)))
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map(rel)

  it("no dynamic code execution or process spawning", () => {
    expect(scan(/\beval\s*\(|new\s+Function\s*\(|from\s+["'](?:node:)?(?:child_process|vm|worker_threads)["']|require\(\s*["'](?:node:)?(?:child_process|vm)["']\s*\)/, ["lib/agent-gateway/capabilities/dangerous-primitive-guard.ts", "lib/agent-gateway/authorization/policy-language.ts"])).toEqual([])
  })

  it("no dynamic import / require of a computed specifier", () => {
    expect(scan(/\bimport\(\s*[^"'`\s)]|\brequire\(\s*[^"'`\s)]/)).toEqual([])
  })

  it("no unsafe raw SQL (only the tagged, parameterised template for the health probe)", () => {
    expect(scan(/\$(?:queryRawUnsafe|executeRawUnsafe)\b|\$(?:queryRaw|executeRaw)\s*\(/)).toEqual([])
    expect(scan(/\$queryRaw`/)).toEqual(["lib/agent-gateway/health.ts"])
  })

  it("no insecure randomness and no console logging in gateway code", () => {
    expect(scan(/Math\.random\s*\(/)).toEqual([])
    expect(scan(/\bconsole\.(?:log|info|warn|error|debug)\s*\(/)).toEqual([])
  })

  it("environment variables are read only by the configuration modules", () => {
    expect(
      scan(/process\.env\b/, [
        "lib/agent-gateway/config.ts",
        "lib/agent-gateway/mcp/config.ts",
        "lib/agent-gateway/tasks/config.ts",
        "lib/agent-gateway/triggers/config.ts",
        "lib/agent-gateway/mcp/transport-security.ts",
        "lib/agent-gateway/auth/credential-store.ts",
        "lib/agent-gateway/auth/credential-store-provider.ts",
        "lib/agent-gateway/capabilities/dangerous-primitive-guard.ts",
      ])
    ).toEqual([])
  })

  it("the agent admin UI never injects raw HTML", () => {
    const ui = [
      ...files(path.resolve("components/admin/agent-governance"), /\.tsx?$/),
      ...files(path.resolve("app/(admin)/admin/agent-governance"), /\.tsx?$/),
      ...files(path.resolve("app/(admin)/admin/agent-approvals"), /\.tsx?$/),
    ]
    expect(ui.length).toBeGreaterThan(10)
    expect(ui.filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(readFileSync(f, "utf8"))).map(rel)).toEqual([])
  })

  it("adapters are wired statically from reviewed modules only", () => {
    const index = readFileSync(path.resolve("lib/agent-gateway/execution/adapters/index.ts"), "utf8")
    expect(index).not.toMatch(/import\(|require\(/)
    const imported = Array.from(index.matchAll(/from\s+["']\.\/([^"']+)["']/g)).map((m) => m[1]).sort()
    expect(imported.every((m) => /-adapter$/.test(m))).toBe(true)
  })

  it("every agent-facing and agent-admin API route is dynamic (never statically cached)", () => {
    const routes = [
      ...files(path.resolve("app/api/agent-gateway"), /^route\.ts$/),
      ...files(path.resolve("app/api/agent-webhooks"), /^route\.ts$/),
      ...files(path.resolve("app/api/admin/agent-governance"), /^route\.ts$/),
    ]
    expect(routes.length).toBeGreaterThan(10)
    expect(routes.filter((f) => !/export const dynamic = "force-dynamic"/.test(readFileSync(f, "utf8"))).map(rel)).toEqual([])
  })
})
