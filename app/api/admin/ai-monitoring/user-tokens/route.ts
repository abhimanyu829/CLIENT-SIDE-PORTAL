import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  await requireAdmin()
  const email = req.nextUrl.searchParams.get("email")
  if (!email) return NextResponse.json({ error: "Email parameter is required" }, { status: 400 })

  const user = await db.user.findUnique({
    where: { email },
    include: {
      sessions: { take: 5 },
      payments: { where: { status: "SUCCESS" } }
    }
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Mock token database log grouping for user
  const tokenLogs = {
    "gpt-4": { inputTokens: 142000, outputTokens: 86000, cost: 4.0 },
    "gemini-1.5-flash": { inputTokens: 850000, outputTokens: 420000, cost: 0.18 },
    "gpt-3.5-turbo": { inputTokens: 45000, outputTokens: 22000, cost: 0.05 }
  }

  return NextResponse.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    tokenLogs
  })
}
