import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/env", () => ({
  env: { AI_SUPPORT_CHUNK_SIZE: 800, AI_SUPPORT_EMBEDDING_DIM: 1536, AI_SUPPORT_TOP_K: 5, AI_SUPPORT_CHAT_MODEL: "gpt-4o", AI_SUPPORT_EMBEDDING_MODEL: "text-embedding-3-small" },
}))

vi.mock("@/lib/ai-support/provider", () => ({
  embedTexts: vi.fn(async (batch: string[]) => batch.map(() => [0.1, 0.2])),
  chatCompletion: vi.fn(),
}))

const h = vi.hoisted(() => ({
  source: null as null | Record<string, unknown>,
  store: [] as string[],
  sourceUpdates: [] as Record<string, unknown>[],
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    knowledgeSource: {
      findUnique: vi.fn(async () => h.source),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        h.sourceUpdates.push(args.data)
        if (h.source) h.source = { ...h.source, ...args.data }
        return h.source
      }),
    },
    knowledgeDocument: {
      upsert: h.upsert,
    },
    knowledgeChunk: {
      deleteMany: h.deleteMany,
    },
    $executeRawUnsafe: vi.fn(async (...args: unknown[]) => {
      h.store.push(String(args[args.length - 1]))
    }),
  },
}))

import { ingestAuthoritative } from "@/lib/ai-support/ingest"

function setSource(partial: Record<string, unknown>) {
  h.source = {
    id: "src_1",
    sourceType: "authoritative",
    title: "Admin entry",
    canonicalUrl: null,
    publicationState: "APPROVED",
    status: "ACTIVE",
    directContent: null,
    ...partial,
  }
}

describe("ingestAuthoritative", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.store = []
    h.sourceUpdates = []
    h.upsert.mockImplementation(async (args: { where: { id: string } }) => ({ id: args.where.id }))
    h.deleteMany.mockImplementation(async () => {
      h.store = []
      return { count: 0 }
    })
  })

  it("Test D — draft content is not indexed, publishing becomes retrievable, unpublishing removes it", async () => {
    setSource({ publicationState: "DRAFT" })
    let res = await ingestAuthoritative("src_1", "The secret is TEST_DRAFT_SECRET.")
    expect(res.chunks).toBe(0)
    expect(h.store).toHaveLength(0)

    // Publish → indexed
    setSource({ publicationState: "APPROVED", status: "ACTIVE" })
    res = await ingestAuthoritative("src_1", "The published fact is TEST_PUBLISHED_FACT.")
    expect(res.chunks).toBeGreaterThan(0)
    expect(h.store.join(" ")).toContain("TEST_PUBLISHED_FACT")

    // Unpublish → chunks removed, nothing indexed
    setSource({ publicationState: "DRAFT" })
    res = await ingestAuthoritative("src_1", "The published fact is TEST_PUBLISHED_FACT.")
    expect(res.chunks).toBe(0)
    expect(h.store).toHaveLength(0)
  })

  it("Test E — re-indexing replaces stale content", async () => {
    setSource({ publicationState: "APPROVED" })
    await ingestAuthoritative("src_1", "The verified value is TEST_OLD.")
    expect(h.store.join(" ")).toContain("TEST_OLD")

    await ingestAuthoritative("src_1", "The verified value is TEST_NEW.")
    const all = h.store.join(" ")
    expect(all).toContain("TEST_NEW")
    expect(all).not.toContain("TEST_OLD")
    expect(h.deleteMany).toHaveBeenCalled()
  })
})
