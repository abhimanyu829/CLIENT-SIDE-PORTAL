import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCustomerSubscriptionOverview } from "@/lib/services/customer-subscription-view"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    const data = await getCustomerSubscriptionOverview(session.user.id)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[customer/subscriptions/overview]", err)
    return NextResponse.json({ success: false, error: "Failed to load subscription overview" }, { status: 500 })
  }
}