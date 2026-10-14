import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/env", () => ({
  env: {
    AI_SUPPORT_TOP_K: 5,
    AI_SUPPORT_CHUNK_SIZE: 800,
    AI_SUPPORT_EMBEDDING_DIM: 1536,
    AI_SUPPORT_CHAT_MODEL: "gpt-4o",
    AI_SUPPORT_EMBEDDING_MODEL: "text-embedding-3-small",
  },
}))

// Force the lexical path so no embeddings/network are required.
vi.mock("@/lib/ai-support/provider", () => ({
  embedTexts: vi.fn(async () => {
    throw new Error("embeddings unavailable")
  }),
  chatCompletion: vi.fn(),
}))

const h = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: { $queryRawUnsafe: h.query } }))

import { retrieve, filterRetrievable, prioritizeBySourceType, conflictsWithAuthoritative } from "@/lib/ai-support/retrieval"

type Row = {
  id: string
  content: string
  documentId: string
  sourceId: string
  title: string
  canonicalUrl: string | null
  contentType: string
  status: string
  publicationState: string
  expiresAt: Date | null
  score: number
  matched: number
}

function row(partial: Partial<Row>): Row {
  return {
    id: Math.random().toString(36).slice(2),
    content: "",
    documentId: "doc_1",
    sourceId: "src_1",
    title: "Source",
    canonicalUrl: null,
    contentType: "page",
    status: "ACTIVE",
    publicationState: "APPROVED",
    expiresAt: null,
    score: 0.9,
    matched: 3,
    ...partial,
  }
}

const PRICE_QUERY = "What is the price of the test widget?"

describe("retrieval source hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Test A — an authoritative entry wins over conflicting website content", async () => {
    const p1 = row({ contentType: "authoritative", content: "Approved price for the test widget is ₹111 (TEST_PRICE_A).", title: "Admin pricing", canonicalUrl: "https://admin.example/pricing" })
    const p2 = row({ contentType: "page", content: "The test widget costs ₹999 (TEST_PRICE_B) on the website.", title: "Website pricing" })
    h.query.mockResolvedValueOnce([p2, p1])

    const results = await retrieve(PRICE_QUERY)
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain("TEST_PRICE_A")
    expect(results.some((r) => r.content.includes("TEST_PRICE_B"))).toBe(false)
    expect((results[0] as { contentType?: string }).contentType).toBe("authoritative")
  })

  it("Test B — compatible website content supplements the authoritative entry", async () => {
    const p1 = row({ contentType: "authoritative", content: "Approved price is ₹111 (TEST_PRICE_A).", title: "Admin pricing" })
    const p2 = row({ contentType: "page", content: "Delivery for the test widget takes 3 working days.", title: "Website delivery" })
    h.query.mockResolvedValueOnce([p1, p2])

    const results = await retrieve(PRICE_QUERY)
    const joined = results.map((r) => r.content).join(" ")
    expect(joined).toContain("TEST_PRICE_A")
    expect(joined).toContain("3 working days")
  })

  it("Test D — draft entries are never returned to the public chatbot", async () => {
    const published = row({ contentType: "authoritative", content: "The published fact is TEST_PUBLISHED_FACT.", title: "Published" })
    const draft = row({ contentType: "authoritative", content: "The secret fact is TEST_DRAFT_SECRET.", publicationState: "DRAFT", title: "Draft" })
    h.query.mockResolvedValueOnce([published, draft])

    const results = await retrieve("Tell me the widget fact")
    expect(results.some((r) => r.content.includes("TEST_PUBLISHED_FACT"))).toBe(true)
    expect(results.some((r) => r.content.includes("TEST_DRAFT_SECRET"))).toBe(false)
  })

  it("filterRetrievable excludes draft, inactive and expired rows", () => {
    const now = Date.now()
    const rows: Partial<Row>[] = [
      { status: "ACTIVE", publicationState: "APPROVED", expiresAt: null },
      { status: "ACTIVE", publicationState: "DRAFT", expiresAt: null },
      { status: "INACTIVE", publicationState: "APPROVED", expiresAt: null },
      { status: "ACTIVE", publicationState: "APPROVED", expiresAt: new Date(now - 1000) },
      { status: "ACTIVE", publicationState: "APPROVED", expiresAt: new Date(now + 1000) },
    ]
    expect(filterRetrievable(rows)).toHaveLength(2)
  })

  it("prioritizeBySourceType keeps P1 and drops contradictory P2", () => {
    const p1 = row({ contentType: "authoritative", content: "Price ₹111" })
    const p2 = row({ contentType: "page", content: "Price ₹999" })
    const out = prioritizeBySourceType([p2, p1] as never, 5)
    expect(out).toHaveLength(1)
    expect(out[0].content).toContain("₹111")
  })

  it("conflictsWithAuthoritative detects differing prices and emails", () => {
    expect(conflictsWithAuthoritative("price ₹111", "price ₹999")).toBe(true)
    expect(conflictsWithAuthoritative("price ₹111", "delivery in 3 days")).toBe(false)
    expect(conflictsWithAuthoritative("mail a@x.com", "mail b@x.com")).toBe(true)
    expect(conflictsWithAuthoritative("mail a@x.com", "call us")).toBe(false)
  })
})
