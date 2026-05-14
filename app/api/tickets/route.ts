import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { TicketPriority, TicketStatus } from "@prisma/client"

// GET /api/tickets — list tickets for the authenticated user
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get("status") ?? undefined
    const priorityParam = searchParams.get("priority") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"))
    const skip = (page - 1) * limit

    const isAdmin = (session.user as any).role === "SUPER_ADMIN" || (session.user as any).role === "SUB_ADMIN"
    const where = {
      ...(isAdmin ? {} : { clientId: session.user.id }),
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

    const { title, description, priority = "MEDIUM", category = "GENERAL", projectId } = await req.json()

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    const ticket = await db.ticket.create({
      data: {
        clientId: session.user.id,
        title: title.trim(),
        description: description.trim(),
        priority: priority as TicketPriority,
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
