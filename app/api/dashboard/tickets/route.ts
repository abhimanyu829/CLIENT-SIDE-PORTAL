import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

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

    const { title, description, priority } = await req.json()
    if (!title || !description) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const ticket = await db.ticket.create({
      data: {
        clientId: session.user.id,
        title,
        description,
        priority: priority ?? "MEDIUM",
        status: "OPEN",
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
