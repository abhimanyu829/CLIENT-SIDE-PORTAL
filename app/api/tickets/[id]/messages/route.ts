import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { pusherServer } from "@/lib/pusher"

// GET /api/tickets/[id]/messages — get all messages for a ticket
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the user owns the ticket or is admin
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: { clientId: true },
    })

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    const isAdmin = (session.user as any).role === "ADMIN"
    if (ticket.clientId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const messages = await db.ticketMessage.findMany({
      where: {
        ticketId,
        ...(isAdmin ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ data: messages })
  } catch (err) {
    console.error("[tickets/[id]/messages] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/tickets/[id]/messages — add a reply to a ticket
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content, attachments = [], isInternal = false } = await req.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Verify ticket exists and user has access
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, clientId: true, status: true },
    })

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    const isAdmin = (session.user as any).role === "ADMIN"
    if (ticket.clientId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [message] = await db.$transaction([
      db.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: session.user.id,
          content: content.trim(),
          attachments,
          isInternal: isAdmin && isInternal,
        },
      }),
      // Reopen ticket if it was resolved and user replied
      ...(ticket.status === "RESOLVED" && !isAdmin
        ? [db.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN" } })]
        : []),
    ])

    // Real-time push to Pusher channel
    await pusherServer.trigger(`ticket-${ticket.id}`, "new-message", message).catch(() => {})

    return NextResponse.json({ data: message }, { status: 201 })
  } catch (err) {
    console.error("[tickets/[id]/messages] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
