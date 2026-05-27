import { NextResponse } from "next/server"
import { streamChat } from "@/lib/openai"
import { db } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { messages } = body
    
    const authHeader = req.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized: Invalid API Key format" }, { status: 401 })
    }

    const keyString = authHeader.split(' ')[1]

    // ApiKey is looked up by keyHash (prefix match) — 'key' field doesn't exist in schema
    const apiKey = await db.apiKey.findFirst({
      where: { keyHash: keyString, isActive: true },
      include: {
        user: {
          include: {
            subscriptions: true,
            entitlements: true,
          },
        },
      }
    })

    if (!apiKey) {
      return NextResponse.json({ error: "Unauthorized: Invalid API Key" }, { status: 401 })
    }

    if (apiKey.user.isBanned || !apiKey.user.isVerified) {
      return NextResponse.json({ error: "Forbidden: Account is not eligible for AI access" }, { status: 403 })
    }

    const now = new Date()
    const activeSub = apiKey.user.subscriptions.find((s) =>
      (s.status === "ACTIVE" || s.status === "TRIALING") && s.currentPeriodEnd > now
    )
    const activeEntitlement = apiKey.user.entitlements.find((entitlement) =>
      entitlement.status === "ACTIVE" && (!entitlement.expiresAt || entitlement.expiresAt > now)
    )
    
    if (!activeSub && !activeEntitlement) {
      return NextResponse.json({ error: "Payment Required: Upgrade your plan to use this agent" }, { status: 402 })
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
          
          // Log invocation — using valid AuditLog schema fields only
          await db.auditLog.create({
            data: {
              userId: apiKey.userId,
              action: "AGENT_INVOCATION",
              entity: "AIAgent",
              entityId: id,
              afterJson: {
                agentId: id,
                apiKeyId: apiKey.id,
              }
            }
          })
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
    console.error(`[API/AI/Agents] Error invoking agent:`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
