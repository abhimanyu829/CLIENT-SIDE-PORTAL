import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordLegalConsent } from "@/lib/legal-consent"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({} as any))
  if (!body?.accepted) return NextResponse.json({ error: "Explicit acceptance required" }, { status: 400 })
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null
  const ua = req.headers.get("user-agent") ?? null
  await recordLegalConsent(session.user.id, { ip, userAgent: ua })
  return NextResponse.json({ ok: true })
}
