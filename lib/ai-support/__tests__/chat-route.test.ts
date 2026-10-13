import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }))

const h = vi.hoisted(() => ({
  conversations: [] as Array<{ id: string; userId: string | null; guestTokenHash: string | null; status: string }>,
  convCreate: vi.fn(async (args: { data: { userId?: string; guestTokenHash?: string; status?: string } }) => {
    const c = { id: `conv_${h.conversations.length + 1}`, userId: args.data.userId ?? null, guestTokenHash: args.data.guestTokenHash ?? null, status: args.data.status ?? "ACTIVE" }
    h.conversations.push(c)
    return c
  }),
  convFind: vi.fn(async (args: { where: { id: string } }) => h.conversations.find((c) => c.id === args.where.id) ?? null),
  rateLimit: {
    findUnique: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
  },
}))

vi.mock("@/lib/db", () => ({
  db: {
    rateLimit: h.rateLimit,
    aiSupportConversation: {
      findUnique: h.convFind,
      create: h.convCreate,
    },
    aiSupportMessage: { create: vi.fn(async () => ({})) },
  },
}))

vi.mock("@/lib/ai-support/answer", () => ({ generateAnswer: vi.fn(async (q: string) => ({ answer: `ANSWER(${q})`, citations: [] })) }))
vi.mock("@/lib/ai-support/tools", () => ({ getProductDetails: vi.fn(), getPlanDetails: vi.fn(), getOrderStatus: vi.fn(), getSubscriptionStatus: vi.fn(), getTicketStatus: vi.fn(), createSupportTicket: vi.fn() }))

import { POST } from "@/app/api/ai-support/chat/route"

function call(message: string, extra: Record<string, unknown> = {}) {
  return POST(
    new Request("http://localhost:3000/api/ai-support/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
      body: JSON.stringify({ message, ...extra }),
    })
  )
}

describe("ai-support chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.conversations.length = 0
  })

  it("rate limits a session bucket at zero tokens", async () => {
    h.rateLimit.findUnique.mockResolvedValueOnce({ bucketKey: "ai-chat:203.0.113.7", tokens: 0, windowStart: new Date(), windowSecs: 60, maxTokens: 10 } as never)
    const res = await call("hello")
    expect(res.status).toBe(429)
    expect(h.convCreate).not.toHaveBeenCalled()
  })

  it("rejects a guest token that does not match the conversation", async () => {
    h.conversations.push({ id: "conv_a", userId: null, guestTokenHash: "abc123", status: "ACTIVE" })
    const res = await call("hi", { conversationId: "conv_a", guestToken: "wrong-token" })
    expect(res.status).toBe(403)
  })

  it("forbids a user token from opening another user's conversation", async () => {
    h.conversations.push({ id: "conv_b", userId: "user_b", guestTokenHash: null, status: "ACTIVE" })
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user_a" } } as never)
    const res = await call("hi", { conversationId: "conv_b" })
    expect(res.status).toBe(403)
  })

  it("chains a guest conversationId bound to the same guest token", async () => {
    const { createHash } = await import("crypto")
    const token = "gt-chain-123"
    const hash = createHash("sha256").update(token).digest("hex")
    h.conversations.push({ id: "conv_c", userId: null, guestTokenHash: hash, status: "ACTIVE" })
    const res = await call("follow up", { conversationId: "conv_c", guestToken: token })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conversationId).toBe("conv_c")
    expect(body.answer).toBe("ANSWER(follow up)")
  })
})
