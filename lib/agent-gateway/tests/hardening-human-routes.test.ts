/**
 * Known-issue fixes after Phase 15 — the human (non-agent) API routes the
 * agent-gateway audits flagged (PRE-12-1, PRE-13-1..3), plus the related
 * defects found while fixing them. These live under lib/agent-gateway/tests
 * because that is the suite the project runs; the code under test is in
 * app/api/** and lib/support-tickets.ts / lib/sanitize-product.ts.
 *
 * Each route module is the REAL one; only the database, the session source
 * (lib/auth) and the sub-admin credential session are faked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Row = Record<string, any>
type SessionUser = { id: string; role: string } | null
type SubadminAccess = { allowed: boolean; reason?: string | null; permissions: Array<{ resource: string; action: string }> }

function createRouteDb() {
  const tickets = new Map<string, Row>()
  const messages: Row[] = []
  const projects = new Map<string, Row>()
  const users = new Map<string, Row>()
  const products = new Map<string, Row>()
  const reviews: Row[] = []
  let seq = 0
  const now = () => new Date(Date.UTC(2026, 8, 29, 12, 0, seq++))

  const matches = (row: Row, where: Row | undefined) => !where || Object.entries(where).every(([k, v]) => v === undefined || row[k] === v)
  const userView = (id: string | null) => {
    const u = id ? users.get(id) : undefined
    return u ? { name: u.name ?? null, email: u.email ?? null, avatarUrl: null } : null
  }

  const client = {
    ticket: {
      findUnique: vi.fn(async ({ where, include, select }: { where: { id: string }; include?: Row; select?: Row }) => {
        const row = tickets.get(where.id)
        if (!row) return null
        if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]))
        const out: Row = { ...row }
        if (include?.messages) {
          out.messages = messages.filter((m) => m.ticketId === row.id && matches(m, include.messages.where)).map((m) => ({ ...m }))
        }
        if (include?.client) out.client = userView(row.clientId)
        if (include?.assignee) out.assignee = userView(row.assignedTo)
        if (include?.project) out.project = row.projectId ? { title: projects.get(row.projectId)?.title ?? null } : null
        return out
      }),
      findFirst: vi.fn(async ({ where }: { where: Row }) => {
        const row = Array.from(tickets.values()).find((r) => matches(r, where))
        return row ? { ...row } : null
      }),
      findMany: vi.fn(async ({ where }: { where?: Row }) => Array.from(tickets.values()).filter((r) => matches(r, where)).map((r) => ({ ...r, messages: [] }))),
      count: vi.fn(async ({ where }: { where?: Row }) => Array.from(tickets.values()).filter((r) => matches(r, where)).length),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: `tk_${++seq}`, projectId: null, assignedTo: null, resolvedAt: null, status: "OPEN", priority: "MEDIUM", createdAt: now(), updatedAt: now(), ...data }
        tickets.set(row.id, row)
        return { ...row }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = tickets.get(where.id)
        if (!row) throw Object.assign(new Error("Record to update not found."), { code: "P2025" })
        Object.assign(row, data, { updatedAt: now() })
        return { ...row }
      }),
    },
    ticketMessage: {
      findMany: vi.fn(async ({ where }: { where?: Row }) => messages.filter((m) => matches(m, where)).map((m) => ({ ...m }))),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: `msg_${++seq}`, isInternal: false, attachments: [], createdAt: now(), ...data }
        messages.push(row)
        return { ...row }
      }),
    },
    project: {
      findFirst: vi.fn(async ({ where }: { where: Row }) => {
        const p = projects.get(where.id)
        return p && p.clientId === where.clientId ? { id: p.id } : null
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const u = users.get(where.id)
        return u ? { role: u.role, isBanned: u.isBanned ?? false } : null
      }),
    },
    product: {
      findFirst: vi.fn(async ({ where, include }: { where: Row; include?: Row }) => {
        const p = Array.from(products.values()).find((row) => row.slug === where.slug && (where.status === undefined || row.status === where.status))
        if (!p) return null
        const reviewWhere = include?.reviews?.where as Row | undefined
        return { ...p, tiers: [], reviews: reviews.filter((r) => r.productId === p.id && matches(r, reviewWhere)).map((r) => ({ ...r })) }
      }),
      findMany: vi.fn(async ({ where }: { where: Row }) => Array.from(products.values()).filter((p) => p.status === where.status).map((p) => ({ ...p, tiers: [] }))),
      count: vi.fn(async ({ where }: { where: Row }) => Array.from(products.values()).filter((p) => p.status === where.status).length),
      update: vi.fn(async () => ({})),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  }

  return { client, tickets, messages, projects, users, products, reviews }
}

let db: ReturnType<typeof createRouteDb>
const session: { user: SessionUser; subadmin: SubadminAccess } = { user: null, subadmin: { allowed: false, reason: "NO_ACTIVE_SUBADMIN_ACCOUNT", permissions: [] } }

beforeEach(() => {
  vi.resetModules()
  db = createRouteDb()
  session.user = null
  session.subadmin = { allowed: false, reason: "NO_ACTIVE_SUBADMIN_ACCOUNT", permissions: [] }
  vi.doMock("@/lib/db", () => ({ db: db.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("@/lib/auth", () => ({
    auth: vi.fn(async () => (session.user ? { user: { ...session.user, name: session.user.id, email: `${session.user.id}@example.test` } } : null)),
  }))
  vi.doMock("@/lib/subadmin-workforce", () => ({ validateSubadminCredentialSession: vi.fn(async () => session.subadmin) }))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const as = (id: string, role: string) => {
  session.user = { id, role }
}
const support = (...actions: string[]) => {
  session.subadmin = { allowed: true, reason: null, permissions: actions.map((action) => ({ resource: "Support", action })) }
}

// Each route types its own params.
type RouteHandler = (req: Request, ctx: { params: Promise<any> }) => Promise<Response>

async function call(handler: RouteHandler, init: { method?: string; url?: string; body?: unknown; rawBody?: string; params?: Record<string, string> } = {}) {
  const body = init.rawBody !== undefined ? init.rawBody : init.body !== undefined ? JSON.stringify(init.body) : undefined
  const req = new Request(init.url ?? "https://abhibhi.test/api", { method: init.method ?? "GET", headers: { "content-type": "application/json" }, body })
  const res = await handler(req, { params: Promise.resolve(init.params ?? {}) })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: res.status, json, text }
}

function seedThread() {
  db.users.set("cust_1", { id: "cust_1", role: "CLIENT" })
  db.users.set("cust_2", { id: "cust_2", role: "CLIENT" })
  db.users.set("staff_1", { id: "staff_1", role: "SUB_ADMIN" })
  db.users.set("admin_1", { id: "admin_1", role: "SUPER_ADMIN" })
  db.tickets.set("tk_1", { id: "tk_1", clientId: "cust_1", title: "Billing", description: "Charged twice", priority: "MEDIUM", status: "OPEN", category: "GENERAL", projectId: null, assignedTo: null, resolvedAt: null })
  db.messages.push(
    { id: "m_1", ticketId: "tk_1", senderId: "cust_1", content: "Please help", isInternal: false, createdAt: new Date(1) },
    { id: "m_2", ticketId: "tk_1", senderId: "staff_1", content: "INTERNAL: customer is on a legacy plan", isInternal: true, createdAt: new Date(2) },
    { id: "m_3", ticketId: "tk_1", senderId: "staff_1", content: "We are looking into it", isInternal: false, createdAt: new Date(3) }
  )
}

// ── PRE-13-1: ticket detail, roles and internal notes ────────────────────────

describe("GET /api/tickets/[id]", () => {
  const load = () => import("@/app/api/tickets/[id]/route")

  it("the ticket's customer gets the thread WITHOUT staff-internal notes (filtered in the query itself)", async () => {
    seedThread()
    as("cust_1", "CLIENT")
    const res = await call((await load()).GET, { params: { id: "tk_1" } })
    expect(res.status).toBe(200)
    expect(res.json.data.messages.map((m: Row) => m.id)).toEqual(["m_1", "m_3"])
    expect(res.text).not.toContain("INTERNAL")
    expect(db.client.ticket.findUnique.mock.calls[0][0].include?.messages.where).toEqual({ isInternal: false })
  })

  it("another customer's ticket is 404, exactly like a missing one", async () => {
    seedThread()
    as("cust_2", "CLIENT")
    const { GET } = await load()
    const foreign = await call(GET, { params: { id: "tk_1" } })
    const missing = await call(GET, { params: { id: "tk_nope" } })
    expect(foreign).toEqual({ status: 404, json: { error: "Ticket not found" }, text: JSON.stringify({ error: "Ticket not found" }) })
    expect(missing).toEqual(foreign)
  })

  it("SUPER_ADMIN, and a SUB_ADMIN with Support VIEW, see any ticket with its internal notes", async () => {
    seedThread()
    as("admin_1", "SUPER_ADMIN")
    const { GET } = await load()
    expect((await call(GET, { params: { id: "tk_1" } })).json.data.messages).toHaveLength(3)

    as("staff_1", "SUB_ADMIN")
    support("VIEW")
    expect((await call(GET, { params: { id: "tk_1" } })).json.data.messages).toHaveLength(3)
  })

  it("a SUB_ADMIN without the Support permission (or without an admin session) is just a user; legacy role names grant nothing", async () => {
    seedThread()
    const { GET } = await load()
    as("staff_1", "SUB_ADMIN")
    session.subadmin = { allowed: true, reason: null, permissions: [{ resource: "Marketing", action: "VIEW" }] }
    expect((await call(GET, { params: { id: "tk_1" } })).status).toBe(404)
    session.subadmin = { allowed: false, reason: "ADMIN_CREDENTIAL_LOGIN_REQUIRED", permissions: [{ resource: "Support", action: "VIEW" }] }
    expect((await call(GET, { params: { id: "tk_1" } })).status).toBe(404)
    for (const role of ["ADMIN", "STAFF"]) {
      as("someone", role)
      expect((await call(GET, { params: { id: "tk_1" } })).status).toBe(404)
    }
  })

  it("401 without a session", async () => {
    seedThread()
    expect((await call((await load()).GET, { params: { id: "tk_1" } })).status).toBe(401)
  })
})

describe("GET /api/tickets/[id]/messages", () => {
  it("the owner's thread never contains internal notes", async () => {
    seedThread()
    as("cust_1", "CLIENT")
    const { GET } = await import("@/app/api/tickets/[id]/messages/route")
    const res = await call(GET, { params: { id: "tk_1" } })
    expect(res.status).toBe(200)
    expect(res.json.data.map((m: Row) => m.id)).toEqual(["m_1", "m_3"])
    expect(db.client.ticketMessage.findMany.mock.calls[0][0].where).toEqual({ ticketId: "tk_1", isInternal: false })
  })

  it("POST validates the content: missing, non-text and oversized content are 400 and nothing is stored", async () => {
    seedThread()
    as("cust_1", "CLIENT")
    const { POST } = await import("@/app/api/tickets/[id]/messages/route")
    const before = db.messages.length
    for (const body of [{}, { content: "   " }, { content: 42 }, { content: { $gt: "" } }, { content: "x".repeat(10_001) }]) {
      expect((await call(POST, { method: "POST", params: { id: "tk_1" }, body })).status, JSON.stringify(body).slice(0, 40)).toBe(400)
    }
    expect((await call(POST, { method: "POST", params: { id: "tk_1" }, rawBody: "{not json" })).status).toBe(400)
    expect(db.messages.length).toBe(before)
    const ok = await call(POST, { method: "POST", params: { id: "tk_1" }, body: { content: "  Any update?  " } })
    expect(ok.status).toBe(201)
    expect(ok.json.data).toMatchObject({ content: "Any update?", senderId: "cust_1", isInternal: false })
  })
})

describe("PATCH /api/tickets/[id]", () => {
  const load = () => import("@/app/api/tickets/[id]/route")

  it("a customer can only close their own ticket (body ignored); another customer's ticket is 404 and unchanged", async () => {
    seedThread()
    const { PATCH } = await load()
    as("cust_2", "CLIENT")
    expect((await call(PATCH, { method: "PATCH", params: { id: "tk_1" }, body: { status: "CLOSED" } })).status).toBe(404)
    expect(db.tickets.get("tk_1")!.status).toBe("OPEN")

    as("cust_1", "CLIENT")
    const res = await call(PATCH, { method: "PATCH", params: { id: "tk_1" }, body: { status: "IN_PROGRESS", priority: "CRITICAL", assignedTo: "cust_1" } })
    expect(res.status).toBe(200)
    expect(db.tickets.get("tk_1")).toMatchObject({ status: "CLOSED", priority: "MEDIUM", assignedTo: null })
    // Even without a body.
    db.tickets.get("tk_1")!.status = "OPEN"
    expect((await call(PATCH, { method: "PATCH", params: { id: "tk_1" } })).status).toBe(200)
    expect(db.tickets.get("tk_1")!.status).toBe("CLOSED")
  })

  it("staff updates are validated: bad status / priority / timestamp / body are 400 and change nothing", async () => {
    seedThread()
    as("admin_1", "SUPER_ADMIN")
    const { PATCH } = await load()
    const bad: Array<[unknown, RegExp]> = [
      [{ status: "DONE" }, /Status must be/],
      [{ priority: "URGENTISSIMO" }, /Priority must be/],
      [{ resolvedAt: "yesterday" }, /resolvedAt/],
      [{ assignedTo: 7 }, /assignedTo/],
      [{}, /Nothing to update/],
      [{ title: "renamed" }, /Nothing to update/],
    ]
    for (const [body, message] of bad) {
      const res = await call(PATCH, { method: "PATCH", params: { id: "tk_1" }, body })
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(res.json.error).toMatch(message)
    }
    expect((await call(PATCH, { method: "PATCH", params: { id: "tk_1" }, rawBody: "{not json" })).status).toBe(400)
    expect(db.client.ticket.update).not.toHaveBeenCalled()
  })

  it("staff can assign only to an active staff account, and RESOLVED stamps resolvedAt", async () => {
    seedThread()
    db.users.set("banned_staff", { id: "banned_staff", role: "SUB_ADMIN", isBanned: true })
    as("admin_1", "SUPER_ADMIN")
    const { PATCH } = await load()
    for (const assignedTo of ["cust_2", "banned_staff", "nobody"]) {
      const res = await call(PATCH, { method: "PATCH", params: { id: "tk_1" }, body: { assignedTo } })
      expect(res.status, assignedTo).toBe(400)
    }
    const res = await call(PATCH, { method: "PATCH", params: { id: "tk_1" }, body: { status: "RESOLVED", priority: "high", assignedTo: "staff_1" } })
    expect(res.status).toBe(200)
    expect(db.tickets.get("tk_1")).toMatchObject({ status: "RESOLVED", priority: "HIGH", assignedTo: "staff_1" })
    expect(db.tickets.get("tk_1")!.resolvedAt).toBeInstanceOf(Date)
    // Unassign and clear the resolution explicitly.
    expect((await call(PATCH, { method: "PATCH", params: { id: "tk_1" }, body: { assignedTo: null, resolvedAt: null, status: "IN_PROGRESS" } })).status).toBe(200)
    expect(db.tickets.get("tk_1")).toMatchObject({ assignedTo: null, resolvedAt: null, status: "IN_PROGRESS" })
  })

  it("a missing ticket is 404 for staff too (no database error)", async () => {
    seedThread()
    as("admin_1", "SUPER_ADMIN")
    const res = await call((await load()).PATCH, { method: "PATCH", params: { id: "tk_missing" }, body: { status: "CLOSED" } })
    expect(res.status).toBe(404)
  })

  it("a SUB_ADMIN with Support VIEW but not EDIT cannot manage tickets", async () => {
    seedThread()
    as("staff_1", "SUB_ADMIN")
    support("VIEW")
    const res = await call((await load()).PATCH, { method: "PATCH", params: { id: "tk_1" }, body: { status: "RESOLVED" } })
    expect(res.status).toBe(404) // treated as a customer, and it is not their ticket
    expect(db.tickets.get("tk_1")!.status).toBe("OPEN")
    support("VIEW", "EDIT")
    expect((await call((await load()).PATCH, { method: "PATCH", params: { id: "tk_1" }, body: { status: "RESOLVED" } })).status).toBe(200)
  })
})

// ── PRE-13-2 / PRE-13-3: ticket creation ─────────────────────────────────────

describe("POST /api/tickets", () => {
  const load = () => import("@/app/api/tickets/route")

  it("a projectId must be one of the caller's own projects: someone else's (or a missing one) is 404 and no ticket is created", async () => {
    db.projects.set("proj_mine", { id: "proj_mine", clientId: "cust_1", title: "Mine" })
    db.projects.set("proj_theirs", { id: "proj_theirs", clientId: "cust_2", title: "Theirs" })
    as("cust_1", "CLIENT")
    const { POST } = await load()
    for (const projectId of ["proj_theirs", "proj_missing"]) {
      const res = await call(POST, { method: "POST", body: { title: "Help", description: "Details", projectId } })
      expect(res.status, projectId).toBe(404)
      expect(res.json.error).toBe("Project not found")
    }
    expect(db.tickets.size).toBe(0)
    const ok = await call(POST, { method: "POST", body: { title: "Help", description: "Details", projectId: "proj_mine" } })
    expect(ok.status).toBe(201)
    expect(ok.json.data).toMatchObject({ clientId: "cust_1", projectId: "proj_mine" })
  })

  it("fields are validated (400, nothing stored); defaults and trimming are unchanged", async () => {
    as("cust_1", "CLIENT")
    const { POST } = await load()
    const bad: unknown[] = [
      {},
      { title: "  ", description: "x" },
      { title: "ok", description: 5 },
      { title: "ok", description: "x", priority: "BLOCKER" },
      { title: "x".repeat(301), description: "x" },
      { title: "ok", description: "x".repeat(20_001) },
      { title: "ok", description: "x", category: "c".repeat(51) },
      { title: "ok", description: "x", projectId: { not: null } },
    ]
    for (const body of bad) expect((await call(POST, { method: "POST", body })).status, JSON.stringify(body).slice(0, 60)).toBe(400)
    expect((await call(POST, { method: "POST", rawBody: "nope" })).status).toBe(400)
    expect(db.tickets.size).toBe(0)

    const ok = await call(POST, { method: "POST", body: { title: "  Login broken ", description: " Cannot sign in ", clientId: "cust_2", status: "CLOSED" } })
    expect(ok.status).toBe(201)
    expect(ok.json.data).toMatchObject({ clientId: "cust_1", title: "Login broken", description: "Cannot sign in", priority: "MEDIUM", category: "GENERAL", status: "OPEN" })
    const urgent = await call(POST, { method: "POST", body: { title: "Down", description: "Site is down", priority: "urgent" } })
    expect(urgent.json.data.priority).toBe("CRITICAL")
  })
})

describe("GET /api/tickets", () => {
  it("support staff see every ticket; a SUB_ADMIN without Support sees only their own; bad filters are 400", async () => {
    seedThread()
    db.tickets.set("tk_staff", { id: "tk_staff", clientId: "staff_1", title: "Own", description: "d", priority: "LOW", status: "OPEN", category: "GENERAL" })
    const { GET } = await import("@/app/api/tickets/route")

    as("staff_1", "SUB_ADMIN")
    expect((await call(GET, { url: "https://abhibhi.test/api/tickets" })).json.data.map((t: Row) => t.id)).toEqual(["tk_staff"])
    support("VIEW")
    expect((await call(GET, { url: "https://abhibhi.test/api/tickets" })).json.pagination.total).toBe(2)

    as("cust_1", "CLIENT")
    expect((await call(GET, { url: "https://abhibhi.test/api/tickets" })).json.data.map((t: Row) => t.id)).toEqual(["tk_1"])
    expect((await call(GET, { url: "https://abhibhi.test/api/tickets?status=NOPE" })).status).toBe(400)
    expect((await call(GET, { url: "https://abhibhi.test/api/tickets?priority=NOPE" })).status).toBe(400)
    const odd = await call(GET, { url: "https://abhibhi.test/api/tickets?page=abc&limit=-5" })
    expect(odd.status).toBe(200)
    expect(odd.json.pagination).toMatchObject({ page: 1, limit: 1 })
  })
})

describe("POST /api/dashboard/tickets (the live dashboard form)", () => {
  it('the form\'s "URGENT" priority now creates a CRITICAL ticket instead of failing', async () => {
    as("cust_1", "CLIENT")
    const { POST } = await import("@/app/api/dashboard/tickets/route")
    const res = await call(POST, { method: "POST", body: { title: "Outage", description: "Everything is down", priority: "URGENT" } })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ priority: "CRITICAL", clientId: "cust_1", status: "OPEN", category: "GENERAL" })
    // The description is also the first message of the thread, as before.
    expect(db.messages).toEqual([expect.objectContaining({ ticketId: res.json.data.id, senderId: "cust_1", content: "Everything is down" })])
  })

  it("every option of the form is accepted, and an invalid priority is a 400 with no ticket", async () => {
    as("cust_1", "CLIENT")
    const { POST } = await import("@/app/api/dashboard/tickets/route")
    for (const priority of ["LOW", "MEDIUM", "HIGH", "CRITICAL", "URGENT", null, undefined]) {
      expect((await call(POST, { method: "POST", body: { title: "T", description: "D", priority } })).status, String(priority)).toBe(201)
    }
    const before = db.tickets.size
    expect((await call(POST, { method: "POST", body: { title: "T", description: "D", priority: "WHENEVER" } })).status).toBe(400)
    expect((await call(POST, { method: "POST", body: { title: "", description: "D" } })).status).toBe(400)
    expect(db.tickets.size).toBe(before)
  })
})

// ── PRE-12-1: the public product routes ──────────────────────────────────────

function seedProducts() {
  const base = {
    tagline: "t",
    description: "d",
    type: "SAAS",
    deliveryConfig: { password_enc: "iv:tag:cipher" },
    productAccessUrl: "https://app.example.test/secret-entry",
    productLoginUrl: "https://app.example.test/login",
    productDashboardUrl: "https://app.example.test/dash",
    productAccessNotes: "admin password is in the vault",
    assignedUserId: "cust_9",
    assignedEmail: "reserved-buyer@example.test",
    reservedUntil: new Date(0),
    lockedBy: "admin_1",
    lockedAt: new Date(0),
    createdBy: "admin_1",
    lastEditedBy: "admin_2",
  }
  db.products.set("p_live", { ...base, id: "p_live", slug: "live", name: "Live", status: "AVAILABLE" })
  db.products.set("p_draft", { ...base, id: "p_draft", slug: "draft", name: "Draft", status: "DRAFT" })
  db.reviews.push(
    { id: "r_ok", productId: "p_live", status: "APPROVED", title: "Great" },
    { id: "r_pending", productId: "p_live", status: "PENDING", title: "Unmoderated spam" }
  )
}

const NON_PUBLIC = ["deliveryConfig", "productAccessUrl", "productLoginUrl", "productDashboardUrl", "productAccessNotes", "assignedUserId", "assignedEmail", "reservedUntil", "lockedBy", "lockedAt", "createdBy", "lastEditedBy"]

describe("GET /api/products/[slug]", () => {
  const load = () => import("@/app/api/products/[slug]/route")

  it("a product that is not AVAILABLE is 404 exactly like a missing one (draft, archived, reserved...)", async () => {
    seedProducts()
    const { GET } = await load()
    const draft = await call(GET, { params: { slug: "draft" } })
    const missing = await call(GET, { params: { slug: "nope" } })
    expect(draft.status).toBe(404)
    expect(draft).toEqual(missing)
    expect(db.client.product.findFirst.mock.calls[0][0].where).toEqual({ slug: "draft", status: "AVAILABLE" })
    expect(db.client.product.update).not.toHaveBeenCalled() // no view counted for hidden products
  })

  it("a live product comes back without non-public fields and with APPROVED reviews only", async () => {
    seedProducts()
    const res = await call((await load()).GET, { params: { slug: "live" } })
    expect(res.status).toBe(200)
    for (const field of NON_PUBLIC) expect(res.json.data, field).not.toHaveProperty(field)
    expect(res.text).not.toMatch(/secret-entry|vault|reserved-buyer|password_enc/)
    expect(res.json.data).toMatchObject({ id: "p_live", slug: "live", name: "Live", status: "AVAILABLE" })
    expect(res.json.data.reviews.map((r: Row) => r.id)).toEqual(["r_ok"])
  })

  it("PATCH is refused for everyone, including a SUPER_ADMIN, and touches nothing", async () => {
    seedProducts()
    const { PATCH } = await load()
    for (const user of [null, { id: "cust_1", role: "CLIENT" }, { id: "admin_1", role: "SUPER_ADMIN" }, { id: "x", role: "ADMIN" }]) {
      session.user = user
      const res = await PATCH()
      expect(res.status).toBe(403)
    }
    expect(db.client.product.update).not.toHaveBeenCalled()
  })
})

describe("GET /api/products", () => {
  it("the public list strips the same non-public fields", async () => {
    seedProducts()
    const { GET } = await import("@/app/api/products/route")
    const res = await call(GET, { url: "https://abhibhi.test/api/products" })
    expect(res.status).toBe(200)
    expect(res.json.data.map((p: Row) => p.id)).toEqual(["p_live"])
    for (const field of NON_PUBLIC) expect(res.json.data[0], field).not.toHaveProperty(field)
  })
})

// ── Found while fixing: public routes that created data for someone else / crashed ─

describe("POST /api/ai/chat — the escalation ticket", () => {
  async function loadChat() {
    vi.stubEnv("OPENAI_API_KEY", "placeholder-for-tests") // the route only checks that one is configured
    vi.doMock("@/lib/openai", () => ({
      streamChat: vi.fn(async () => (async function* () {
        yield { choices: [{ delta: { content: "Hello" } }] }
      })()),
    }))
    return import("@/app/api/ai/chat/route")
  }
  const ask = (sessionId: string) => ({ method: "POST", body: { sessionId, messages: [{ role: "user", content: "I need help from a human" }] } })

  it("a client-supplied id is never trusted as the ticket owner (unauthenticated spoofing creates nothing)", async () => {
    const { POST } = await loadChat()
    const res = await call(POST as never, ask("cust_1"))
    expect(res.status).toBe(200)
    expect(db.client.ticket.create).not.toHaveBeenCalled()
    // Another signed-in user naming someone else's id is refused too.
    as("cust_2", "CLIENT")
    await call(POST as never, ask("cust_1"))
    expect(db.client.ticket.create).not.toHaveBeenCalled()
  })

  it("a signed-in caller escalating with their own account id still gets the ticket", async () => {
    const { POST } = await loadChat()
    as("cust_1", "CLIENT")
    await call(POST as never, ask("cust_1"))
    expect(db.client.ticket.create).toHaveBeenCalledTimes(1)
    expect(db.client.ticket.create.mock.calls[0][0].data.clientId).toBe("cust_1")
  })
})
