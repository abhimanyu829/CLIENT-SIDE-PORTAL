import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createSupportTicket } from "@/lib/ai-support/tools"
import { z } from "zod"

const schema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().min(10).max(20000),
  category: z.string().max(50).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  conversationId: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await auth().catch(() => null)
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  // Idempotency: if conversation already has ticket, return it
  if (parsed.data.conversationId) {
    const { db } = await import("@/lib/db")
    const conv = await db.aiSupportConversation.findUnique({ where: { id: parsed.data.conversationId } })
    if (conv?.ticketId) {
      const t = await db.ticket.findUnique({ where: { id: conv.ticketId } })
      if (t) return NextResponse.json({ ticket: t, deduped: true })
    }
  }

  const ticket = await createSupportTicket(session.user.id, parsed.data)

  if (parsed.data.conversationId) {
    const { db } = await import("@/lib/db")
    await db.aiSupportConversation.update({ where: { id: parsed.data.conversationId }, data: { ticketId: ticket.id } }).catch(() => {})
  }

  return NextResponse.json({ ticket }, { status: 201 })
}
