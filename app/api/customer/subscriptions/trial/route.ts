import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTrialEligibility, startTrial } from "@/lib/services/free-trial-service"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  const planId = req.nextUrl.searchParams.get("planId")
  if (!planId) {
    return NextResponse.json({ success: false, error: "planId is required" }, { status: 400 })
  }
  try {
    // Server-computed; the UI never decides eligibility itself.
    const data = await getTrialEligibility(session.user.id, planId)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[customer/subscriptions/trial GET]", err)
    return NextResponse.json({ success: false, error: "Failed to check trial eligibility" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  let body: { planId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
  const planId = typeof body?.planId === "string" ? body.planId.trim() : ""
  if (!planId) {
    return NextResponse.json({ success: false, error: "planId is required" }, { status: 400 })
  }
  try {
    const data = await startTrial({ userId: session.user.id, planId }, session.user.id)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trial could not be started"
    console.error("[customer/subscriptions/trial POST]", message)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}