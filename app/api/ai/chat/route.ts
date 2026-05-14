import { NextResponse } from "next/server"
import { streamChat } from "@/lib/openai"
import { redis } from "@/lib/redis"
import { db } from "@/lib/db"
import { TicketPriority, TicketStatus } from "@prisma/client"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages, sessionId } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 })
    }

    const latestMessage = messages[messages.length - 1]?.content?.toLowerCase() || ""
    if (latestMessage.includes("human") || latestMessage.includes("agent") || latestMessage.includes("help")) {
      console.log(`[AI Chat] Escalating session ${sessionId} to support ticket.`)
      // Creating a ticket in background — sessionId used as a mock clientId for demo
      if (sessionId) {
        db.ticket.create({
          data: {
            clientId: sessionId,
            title: "Escalated from AI Chat",
            description: latestMessage,
            status: TicketStatus.OPEN,
            priority: TicketPriority.HIGH,
            category: "AI_ESCALATION",
          }
        }).catch(err => console.error("Failed to create ticket:", err))
      }
    }

    const response = await streamChat(messages)
    
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ""
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || ""
            fullResponse += content
            controller.enqueue(new TextEncoder().encode(content))
          }
          controller.close()
          
          // Only use Redis if available (optional dependency)
          if (sessionId && redis) {
            await redis.rpush(`chat:${sessionId}`, JSON.stringify({ role: "assistant", content: fullResponse }))
          }
        } catch (err) {
          controller.error(err)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error("[API/AI/Chat] Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
