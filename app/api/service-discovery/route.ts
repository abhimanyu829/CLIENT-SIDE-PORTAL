import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasAcceptedCurrentLegal } from "@/lib/legal-consent"
import { getServiceDiscovery } from "@/lib/service-discovery"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 })
  if (!(await hasAcceptedCurrentLegal(session.user.id).catch(() => false))) return NextResponse.json({ success: false, error: { code: "CONSENT_REQUIRED", message: "Terms and Privacy acceptance required." } }, { status: 403 })
  const placement = request.nextUrl.searchParams.get("placement")?.slice(0, 80) || "services"
  const discovery = await getServiceDiscovery(session?.user?.id, placement)
  return NextResponse.json({ success: true, data: discovery })
}
