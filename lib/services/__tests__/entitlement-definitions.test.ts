/**
 * Phase 3 — Test Group A: entitlement definitions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntitlementType } from "@prisma/client"
import { createFakeEntitlementDb, type FakeEntitlementDb } from "./helpers/fake-entitlement-db"
import { EntitlementError } from "@/lib/services/entitlement-lifecycle"

let fake: FakeEntitlementDb

vi.mock("@/lib/db", () => {
  const state: { current: unknown } = { current: null }
  return {
    __setFakeDb: (d: unknown) => {
      state.current = d
    },
    db: new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (!state.current) throw new Error("fake db not installed")
          const src = state.current as Record<string, unknown>
          const val = src[prop]
          return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(src) : val
        },
      },
    ),
  }
})
vi.mock("@/lib/services/cache-service", () => {
  const store = new Map<string, unknown>()
  return {
    __store: store,
    cacheGet: vi.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    cacheSet: vi.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.parse(JSON.stringify(value)))
      return true
    }),
    invalidateCache: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k)
    }),
    CACHE_KEYS: { AI_QUOTA_PREFIX: "ai:quota:" },
    aiQuotaCacheKey: (id: string) => `ai:quota:${id}`,
  }
})

import * as dbModule from "@/lib/db"
import * as cacheNs from "@/lib/services/cache-service"

const { createDefinition, getDefinition, listDefinitions, setDefinitionActive } = await import(
  "@/lib/services/entitlement-service"
)

beforeEach(() => {
  fake = createFakeEntitlementDb()
  ;(dbModule as unknown as { __setFakeDb: (d: unknown) => void }).__setFakeDb(fake.db)
  ;(cacheNs as unknown as { __store: Map<string, unknown> }).__store.clear()
})

describe("A — entitlement definitions", () => {
  it("creates a valid definition", async () => {
    const def = await createDefinition(
      { key: "product.school_management", name: "School Management", type: "PRODUCT" },
      "admin_1",
    )
    expect(def.key).toBe("product.school_management")
    expect(def.type).toBe(EntitlementType.PRODUCT)
    expect(def.isActive).toBe(true)
    expect(fake.store.auditLogs.some((a) => a.action === "ENTITLEMENT_DEFINITION_CREATED")).toBe(true)
  })

  it("rejects duplicate key", async () => {
    await createDefinition({ key: "feature.rag", name: "RAG", type: "FEATURE" }, "admin_1")
    await expect(
      createDefinition({ key: "feature.rag", name: "RAG 2", type: "FEATURE" }, "admin_1"),
    ).rejects.toThrow(/already exists/i)
    expect(fake.store.definitions.size).toBe(1)
  })

  it("rejects invalid type and malformed configuration/keys", async () => {
    await expect(
      createDefinition({ key: "product.x", name: "X", type: "STOCKS" }, "a"),
    ).rejects.toThrow(EntitlementError)
    await expect(
      createDefinition({ key: "CustomerEntitlement", name: "X", type: "PRODUCT" }, "a"),
    ).rejects.toThrow(/Invalid entitlement key/i)
    await expect(
      createDefinition({ key: "product.x", name: "X", type: "PRODUCT", configuration: "oops" }, "a"),
    ).rejects.toThrow(EntitlementError)
    await expect(
      createDefinition({ key: "product.x", name: "X", type: "PRODUCT", status: "LIVE" }, "a"),
    ).rejects.toThrow(EntitlementError)
  })

  it("rejects unknown key words and empty input", async () => {
    await expect(createDefinition(null, "a")).rejects.toThrow(EntitlementError)
    await expect(createDefinition({}, "a")).rejects.toThrow(EntitlementError)
    expect(fake.store.definitions.size).toBe(0)
  })

  it("retrieves by key and by id, lists with filters", async () => {
    await createDefinition({ key: "feature.rag", name: "RAG", type: "FEATURE" }, "a")
    await createDefinition({ key: "limit.storage", name: "Storage", type: "STORAGE" }, "a")

    const byKey = await getDefinition("feature.rag")
    expect(byKey?.id).toBeTruthy()
    expect((await getDefinition(byKey!.id))?.key).toBe("feature.rag")
    expect(await getDefinition("missing.key")).toBeNull()
    expect(await getDefinition("")).toBeNull()

    const all = (await listDefinitions()) as Array<{ key: string }>
    expect(all.map((d) => d.key)).toEqual(["feature.rag", "limit.storage"])
    const features = (await listDefinitions({ type: EntitlementType.FEATURE })) as unknown[]
    expect(features).toHaveLength(1)
  })

  it("deactivates a definition (grants against it then fail)", async () => {
    const def = await createDefinition({ key: "ai.sales_agent", name: "Agent", type: "AI_CAPABILITY" }, "a")
    await setDefinitionActive(def.id, false, "a")
    expect(fake.store.definitions.get(def.id)!.isActive).toBe(false)
    await expect(setDefinitionActive("def_missing", true, "a")).rejects.toThrow(/Unknown definition/i)
  })
})