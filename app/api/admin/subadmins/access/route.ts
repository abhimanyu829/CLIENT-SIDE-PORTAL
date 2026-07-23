import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { auth } from "@/lib/auth"
import {
  SUBADMIN_SESSION_COOKIE,
  createCredentialSession,
} from "@/lib/subadmin-workforce"

const loginSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(8).max(200),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUB_ADMIN") {
    return NextResponse.json({ success: false, error: "Subadmin Clerk login required" }, { status: 401 })
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid credentials payload" }, { status: 400 })
  }

  try {
    const credentialSession = await createCredentialSession({
      userId: session.user.id,
      email: session.user.email,
      username: parsed.data.username,
      password: parsed.data.password,
    })

    const cookieStore = await cookies()
    cookieStore.set(SUBADMIN_SESSION_COOKIE, credentialSession.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: credentialSession.expiresAt,
    })

    return NextResponse.json({ success: true, redirectUrl: credentialSession.landingPath })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid admin credentials"
    const status = message === "ADMIN_CREDENTIALS_LOCKED" ? 423 : 401
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
