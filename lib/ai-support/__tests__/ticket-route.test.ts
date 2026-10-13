import { describe, it, expect, vi, beforeEach } from "vitest"

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  conversation: null as null | { id: string; ticketId: string | null; userId: string | null },
  existingTicket: null as null | { id: string; title: string },
  created: [] as Array<{ id: string; clientId: string; title: string }>,
  conversationUpdate: vi.fn(async () => ({})),
}))

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }))
vi.mock("@/lib/db", () => ({
  db: {
    aiSupportConversation: {
      findUnique: vi.fn(async () => h.conversation),
      update: h.conversationUpdate,
    },
    ticket: {
      findUnique: vi.fn(async () => h.existingTicket),
      create: vi.fn(async (args: { data: { clientId: string; title: string } }) => {
        const t = { id: `ticket_${h.created.length + 1}`, clientId: args.data.clientId, title: args.data.title }
        h.created.push(t)
        return t
      }),
    },
    notification: { create: vi.fn(async () => ({})) },
  },
}))

import { POST } from "@/app/api/ai-support/ticket/route"

function call(body: unknown) {
  return POST(new Request("http://localhost:3000/api/ai-support/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))
}

const valid = { title: "Cannot access purchased service", description: "The service does not open after purchase." }

describe("ai-support ticket route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.session = null
    h.conversation = null
    h.existingTicket = null
    h.created = []
  })

  it("401 without an authenticated session", async () => {
    const res = await call(valid)
    expect(res.status).toBe(401)
    expect(h.created).toHaveLength(0)
  })

  it("400 on invalid payload", async () => {
    h.session = { user: { id: "user_1" } }
    const res = await call({ title: "x", description: "short" })
    expect(res.status).toBe(400)
    expect(h.created).toHaveLength(0)
  })

  it("creates a ticket owned by the authenticated user", async () => {
    h.session = { user: { id: "user_1" } }
    const res = await call(valid)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ticket.clientId).toBe("user_1")
  })

  it("deduplicates when the conversation already has a ticket", async () => {
    h.session = { user: { id: "user_1" } }
    h.conversation = { id: "conv_1", ticketId: "ticket_existing", userId: "user_1" }
    h.existingTicket = { id: "ticket_existing", title: "Old" }
    const res = await call({ ...valid, conversationId: "conv_1" })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deduped).toBe(true)
    expect(body.ticket.id).toBe("ticket_existing")
    expect(h.created).toHaveLength(0)
  })

  it("links a new ticket to the conversation", async () => {
    h.session = { user: { id: "user_1" } }
    h.conversation = { id: "conv_2", ticketId: null, userId: "user_1" }
    const res = await call({ ...valid, conversationId: "conv_2" })
    expect(res.status).toBe(201)
    expect(h.conversationUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "conv_2" } }))
  })
})