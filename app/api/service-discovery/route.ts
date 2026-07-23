import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getServiceDiscovery } from "@/lib/service-discovery"

export async function GET(request: NextRequest) {
  const session = await auth()
  const placement = request.nextUrl.searchParams.get("placement")?.slice(0, 80) || "services"
  const discovery = await getServiceDiscovery(session?.user?.id, placement)
  return NextResponse.json({ success: true, data: discovery })
}
