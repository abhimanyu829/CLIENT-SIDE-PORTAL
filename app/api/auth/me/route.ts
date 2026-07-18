import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { validateSubadminCredentialSession } from "@/lib/subadmin-workforce"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ user: null })
    }

    const adminAccess =
      session.user.role === "SUPER_ADMIN" || session.user.role === "SUB_ADMIN"
        ? await validateSubadminCredentialSession(session.user.id, session.user.role)
        : { allowed: false, reason: "NOT_ADMIN" }

    return NextResponse.json({ user: { ...session.user, adminAccess } })
  } catch (error) {
    console.error("Error fetching current user:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
