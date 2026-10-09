import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { enrollFreePlan } from "@/lib/services/free-trial-service"

export const dynamic = "force-dynamic"

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await enrollFreePlan(session.user.id, session.user.id)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Free enrollment failed"
    console.error("[customer/subscriptions/enroll-free]", message)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}