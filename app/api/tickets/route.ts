import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { TicketPriority, TicketStatus } from "@prisma/client"
import { createTicketSchema, firstIssue, isSupportStaff, readJsonBody } from "@/lib/support-tickets"

const TICKET_STATUSES = new Set<string>(Object.values(TicketStatus))
const TICKET_PRIORITIES = new Set<string>(Object.values(TicketPriority))

// GET /api/tickets — list tickets for the authenticated user (support staff: all tickets)
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get("status") ?? undefined
    const priorityParam = searchParams.get("priority") ?? undefined
    if (statusParam && !TICKET_STATUSES.has(statusParam)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 })
    }
    if (priorityParam && !TICKET_PRIORITIES.has(priorityParam)) {
      return NextResponse.json({ error: "Invalid priority filter" }, { status: 400 })
    }
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20") || 20))
    const skip = (page - 1) * limit

    // Staff = SUPER_ADMIN, or a SUB_ADMIN with the workforce Support permission.
    const isStaff = await isSupportStaff(session.user, "VIEW")
    const where = {
      ...(isStaff ? {} : { clientId: session.user.id }),
      ...(statusParam ? { status: statusParam as TicketStatus } : {}),
      ...(priorityParam ? { priority: priorityParam as TicketPriority } : {}),
    }

    const [tickets, total] = await Promise.all([
      db.ticket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          messages: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      db.ticket.count({ where }),
    ])

    return NextResponse.json({
      data: tickets,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("[tickets] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/tickets — create a new support ticket
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await readJsonBody(req)
    if (body === undefined || body === null || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const parsed = createTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    }
    const { title, description, priority = "MEDIUM", category = "GENERAL", projectId } = parsed.data

    // A ticket may only be attached to one of the caller's own projects. A
    // project that is missing or someone else's is the same answer.
    if (projectId) {
      const project = await db.project.findFirst({ where: { id: projectId, clientId: session.user.id }, select: { id: true } })
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
    }

    const ticket = await db.ticket.create({
      data: {
        clientId: session.user.id,
        title,
        description,
        priority,
        category,
        ...(projectId ? { projectId } : {}),
      },
    })

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (err) {
    console.error("[tickets] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
