import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, hasAcceptedCurrentLegal } from "@/lib/legal-consent"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const accepted = await hasAcceptedCurrentLegal(session.user.id)
  return NextResponse.json({ accepted, termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION })
}
