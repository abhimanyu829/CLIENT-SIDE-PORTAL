import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import {
  profileFromCurrentClerkUser,
  syncClerkUserToDatabase,
} from "@/lib/services/clerk-user-sync"

export async function POST() {
  try {
    const profile = profileFromCurrentClerkUser(await currentUser())

    if (!profile) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const dbUser = await syncClerkUserToDatabase(profile, { updateLastLogin: true })

    if (dbUser.isBanned) {
      return NextResponse.json({ success: false, error: "Account suspended" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      userId: dbUser.id,
    })
  } catch (error) {
    console.error("Manual clerk-sync failed:", error)

    const message =
      error instanceof Error && error.message === "CLERK_EMAIL_ALREADY_LINKED"
        ? "This email is already linked to another Clerk account."
        : "Internal Server Error"

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
