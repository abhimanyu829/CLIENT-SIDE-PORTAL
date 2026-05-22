import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { changePlan } from "@/lib/services/subscription-service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()

  const body = await req.json()
  const { newTierId, reason } = body

  if (!newTierId || typeof newTierId !== "string") {
    return NextResponse.json({ error: "newTierId is required" }, { status: 400 })
  }
  if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason (min 3 chars) is required for plan changes" }, { status: 400 })
  }

  try {
    const result = await changePlan(id, newTierId, admin.userId, reason.trim())
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Plan change failed" },
      { status: 500 }
    )
  }
}
