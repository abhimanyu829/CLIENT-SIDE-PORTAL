import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createTicketSchema, firstIssue, readJsonBody } from "@/lib/support-tickets"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tickets = await db.ticket.findMany({
      where: { clientId: session.user.id },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ data: tickets })
  } catch (err) {
    console.error("[tickets GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await readJsonBody(req)
    if (body === undefined || body === null || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    // Only title, description and priority are taken from the form; the
    // priority is validated (the form's "URGENT" is the enum's CRITICAL).
    const parsed = createTicketSchema.pick({ title: true, description: true, priority: true }).safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    const { title, description, priority = "MEDIUM" } = parsed.data

    const ticket = await db.ticket.create({
      data: {
        clientId: session.user.id,
        title,
        description,
        priority,
        status: "OPEN",
        category: "GENERAL",
      },
    })

    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: session.user.id,
        content: description,
      }
    })

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TICKET_CREATED",
        entity: "Ticket",
        entityId: ticket.id,
      }
    }).catch(() => {})

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (err) {
    console.error("[tickets POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
