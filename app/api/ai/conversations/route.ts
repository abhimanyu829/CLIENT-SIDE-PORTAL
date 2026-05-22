import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/ai/conversations — list user's chat rooms
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const rooms = await db.chatRoom.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, senderType: true },
        },
      },
    })

    return NextResponse.json({ data: rooms })
  } catch (err) {
    console.error("[ai/conversations GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/ai/conversations — save a message and log AI usage
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const { roomId, content, role, model, promptTokens, completionTokens } = await req.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Find or create chat room
    let room
    if (roomId) {
      room = await db.chatRoom.findFirst({ where: { id: roomId, userId } })
    }
    if (!room) {
      room = await db.chatRoom.create({ data: { userId } })
    }

    const message = await db.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: userId,
        senderType: role === "assistant" ? "AGENT" : "USER",
        content: content.trim(),
      },
    })

    // Log AI usage if this is an assistant response
    if (role === "assistant" && (promptTokens || completionTokens)) {
      const totalTokens = (promptTokens ?? 0) + (completionTokens ?? 0)
      // Approximate cost: gpt-4o-mini = $0.00015/1K prompt + $0.0006/1K completion
      const costUsd =
        ((promptTokens ?? 0) / 1000) * 0.00015 +
        ((completionTokens ?? 0) / 1000) * 0.0006

      await db.aIUsageLog.create({
        data: {
          userId,
          model: model ?? "gpt-4o-mini",
          endpoint: "/api/ai/chat",
          promptTokens: promptTokens ?? 0,
          completionTokens: completionTokens ?? 0,
          totalTokens,
          costUsd,
          status: "SUCCESS",
        },
      }).catch(() => {})
    }

    return NextResponse.json({ data: { roomId: room.id, message } }, { status: 201 })
  } catch (err) {
    console.error("[ai/conversations POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
