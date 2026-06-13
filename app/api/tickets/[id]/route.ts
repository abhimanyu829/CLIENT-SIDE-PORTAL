import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/tickets/[id] — get ticket details
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

    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true, avatarUrl: true } },
        assignee: { select: { name: true, email: true, avatarUrl: true } },
        project: { select: { title: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const role = (session.user as any).role
    const isAdmin = role === "ADMIN" || role === "STAFF"
    if (!isAdmin && ticket.clientId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ data: ticket })
  } catch (err) {
    console.error("[tickets/[id]] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/tickets/[id] — update ticket status/priority/assignment
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

    const role = (session.user as any).role
    const isAdmin = role === "ADMIN" || role === "STAFF"

    const body = await req.json()

    // Clients can only close their own ticket
    if (!isAdmin) {
      const ticket = await db.ticket.findUnique({ where: { id } })
      if (!ticket || ticket.clientId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const updated = await db.ticket.update({
        where: { id },
        data: { status: "CLOSED" },
      })
      return NextResponse.json({ data: updated })
    }

    const { status, priority, assignedTo, resolvedAt } = body

    const updated = await db.ticket.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(status === "RESOLVED" && { resolvedAt: new Date() }),
        ...(resolvedAt !== undefined && { resolvedAt: new Date(resolvedAt) }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[tickets/[id]] PATCH:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
