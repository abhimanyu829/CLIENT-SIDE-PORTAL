import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { firstIssue, isSupportStaff, readJsonBody, staffTicketUpdateSchema } from "@/lib/support-tickets"

const NOT_FOUND = { error: "Ticket not found" }

// GET /api/tickets/[id] — get ticket details.
// Customers see only their own tickets, without staff-internal notes; support
// staff (SUPER_ADMIN, or a SUB_ADMIN with the workforce Support permission)
// see every ticket with its full thread. Someone else's ticket is answered
// exactly like a missing one.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isStaff = await isSupportStaff(session.user, "VIEW")
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true, avatarUrl: true } },
        assignee: { select: { name: true, email: true, avatarUrl: true } },
        project: { select: { title: true } },
        // Internal notes are never even loaded for a customer.
        messages: { where: isStaff ? undefined : { isInternal: false }, orderBy: { createdAt: "asc" } },
      },
    })

    if (!ticket || (!isStaff && ticket.clientId !== session.user.id)) {
      return NextResponse.json(NOT_FOUND, { status: 404 })
    }

    return NextResponse.json({ data: ticket })
  } catch (err) {
    console.error("[tickets/[id]] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/tickets/[id] — update ticket status/priority/assignment.
// A customer can only close their own ticket (the body is ignored). Support
// staff with the Support EDIT permission may set status, priority, assignee
// and resolvedAt, each validated.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isStaff = await isSupportStaff(session.user, "EDIT")

    // Clients can only close their own ticket
    if (!isStaff) {
      const ticket = await db.ticket.findUnique({ where: { id }, select: { id: true, clientId: true } })
      if (!ticket || ticket.clientId !== session.user.id) {
        return NextResponse.json(NOT_FOUND, { status: 404 })
      }
      const updated = await db.ticket.update({
        where: { id },
        data: { status: "CLOSED" },
      })
      return NextResponse.json({ data: updated })
    }

    const body = await readJsonBody(req)
    if (body === undefined || body === null || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const parsed = staffTicketUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    }
    const { status, priority, assignedTo, resolvedAt } = parsed.data

    const existing = await db.ticket.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json(NOT_FOUND, { status: 404 })
    }

    // A ticket can only be assigned to an active support staff account.
    if (assignedTo) {
      const assignee = await db.user.findUnique({ where: { id: assignedTo }, select: { role: true, isBanned: true } })
      if (!assignee || assignee.isBanned || (assignee.role !== "SUPER_ADMIN" && assignee.role !== "SUB_ADMIN")) {
        return NextResponse.json({ error: "assignedTo must be an active support staff member" }, { status: 400 })
      }
    }

    const updated = await db.ticket.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(status === "RESOLVED" && { resolvedAt: new Date() }),
        ...(resolvedAt !== undefined && { resolvedAt: resolvedAt === null ? null : new Date(resolvedAt) }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[tickets/[id]] PATCH:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
