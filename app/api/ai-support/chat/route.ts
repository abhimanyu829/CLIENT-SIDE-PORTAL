import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateAnswer } from "@/lib/ai-support/answer"
import { createHash } from "crypto"
import { z } from "zod"
import * as tools from "@/lib/ai-support/tools"

const schema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
  guestToken: z.string().optional(),
})

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex")
}

// Simple rate limit via DB RateLimit bucket
async function checkRate(key: string) {
  const r = await db.rateLimit.findUnique({ where: { bucketKey: key } }).catch(() => null)
  if (!r) {
    await db.rateLimit.create({ data: { bucketKey: key, tokens: 9, windowStart: new Date(), windowSecs: 60, maxTokens: 10 } }).catch(() => {})
    return true
  }
  if (Date.now() - r.windowStart.getTime() > r.windowSecs * 1000) {
    await db.rateLimit.update({ where: { bucketKey: key }, data: { tokens: 9, windowStart: new Date() } }).catch(() => {})
    return true
  }
  if (r.tokens <= 0) return false
  await db.rateLimit.update({ where: { bucketKey: key }, data: { tokens: { decrement: 1 } } }).catch(() => {})
  return true
}

function detectToolIntent(msg: string): string | null {
  const l = msg.toLowerCase()
  if (l.includes("my order") || l.includes("order status")) return "order"
  if (l.includes("subscription") || l.includes("my plan")) return "subscription"
  if (l.includes("invoice")) return "invoice"
  if (l.includes("product") && (l.includes("price") || l.includes("plan"))) return "product"
  return null
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"
  if (!(await checkRate(`ai-chat:${ip}`))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const session = await auth().catch(() => null)
  const userId = session?.user?.id ?? null

  // Resolve or create conversation
  let conversationId = parsed.data.conversationId
  let conversation: { id: string } | null = null
  if (conversationId) {
    const c = await db.aiSupportConversation.findUnique({ where: { id: conversationId } })
    if (c) {
      if (c.userId && c.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      if (c.guestTokenHash && parsed.data.guestToken && hashToken(parsed.data.guestToken) !== c.guestTokenHash)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      conversation = c
    }
  }
  if (!conversation) {
    const data: Record<string, unknown> = {}
    if (userId) data.userId = userId
    else if (parsed.data.guestToken) data.guestTokenHash = hashToken(parsed.data.guestToken)
    else {
      const token = Math.random().toString(36).slice(2, 20)
      data.guestTokenHash = hashToken(token)
    }
    conversation = await db.aiSupportConversation.create({ data: data as never })
    conversationId = conversation.id
  }

  await db.aiSupportMessage.create({ data: { conversationId: conversationId!, role: "user", content: parsed.data.message.slice(0, 4000) } })

  // Tool routing for dynamic data
  let toolContext: string | undefined
  const intent = detectToolIntent(parsed.data.message)
  if (intent && userId) {
    try {
      if (intent === "subscription") toolContext = JSON.stringify(await tools.getSubscriptionStatus(userId))
      else if (intent === "product") {
        const slug = parsed.data.message.split(/\s+/).pop() ?? ""
        const p = await tools.getProductDetails(slug)
        if (p) toolContext = JSON.stringify(p)
      }
    } catch {}
  }

  const { answer, citations } = await generateAnswer(parsed.data.message, { toolResults: toolContext })

  await db.aiSupportMessage.create({
    data: { conversationId: conversationId!, role: "assistant", content: answer, citations: citations as never },
  })

  return NextResponse.json({ conversationId, answer, citations })
}
