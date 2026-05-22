import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

async function triggerPusher(channel: string, event: string, data: unknown) {
  if (!process.env.PUSHER_APP_ID) return
  try {
    const Pusher = (await import("pusher")).default
    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER ?? "ap2",
      useTLS: true,
    })
    await pusher.trigger(channel, event, data)
  } catch {}
}

// GET /api/tickets/[id]/messages
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const ticket = await db.ticket.findFirst({
      where: { id, clientId: session.user.id },
    })
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const messages = await db.ticketMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ data: messages })
  } catch (err) {
    console.error("[tickets/messages GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/tickets/[id]/messages
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const { id } = await params

    const ticket = await db.ticket.findFirst({
      where: { id, clientId: userId },
    })
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { content } = await req.json()
    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const message = await db.ticketMessage.create({
      data: { ticketId: id, senderId: userId, content: content.trim() },
    })

    // Update ticket updatedAt
    await db.ticket.update({ where: { id }, data: { updatedAt: new Date() } })

    // Pusher real-time
    await triggerPusher(`private-user-${ticket.clientId}`, "ticket.message", {
      ticketId: id,
      message: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
      },
    })

    return NextResponse.json({ data: message }, { status: 201 })
  } catch (err) {
    console.error("[tickets/messages POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
