import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listCustomerPlans } from "@/lib/services/customer-subscription-view"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    const data = await listCustomerPlans()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[customer/subscriptions/plans]", err)
    return NextResponse.json({ success: false, error: "Failed to load plans" }, { status: 500 })
  }
}