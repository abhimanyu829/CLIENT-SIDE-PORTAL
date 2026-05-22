import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { processRefund } from "@/lib/services/refund-service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()

  const body = await req.json()
  const { amount, reason } = body

  if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json(
      { error: "A reason (min 3 chars) is required for refunds" },
      { status: 400 }
    )
  }

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "A positive refund amount is required" },
      { status: 400 }
    )
  }

  try {
    const result = await processRefund(id, amount, reason.trim(), admin.userId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Refund failed" },
      { status: 500 }
    )
  }
}
