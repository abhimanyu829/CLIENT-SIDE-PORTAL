import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashToken, isExpired } from "@/lib/tokens"
import { hash } from "bcryptjs"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required." },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      )
    }

    const tokenHash = hashToken(token)

    const user = await db.user.findFirst({
      where: { resetToken: tokenHash },
      select: { id: true, resetTokenExp: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Invalid reset token." },
        { status: 400 }
      )
    }

    if (!user.resetTokenExp || isExpired(user.resetTokenExp)) {
      return NextResponse.json(
        { error: "Reset token has expired. Request a new one." },
        { status: 400 }
      )
    }

    const passwordHash = await hash(password, 10)

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExp: null,
      },
    })

    return NextResponse.json(
      { message: "Password reset successfully. You can now log in." },
      { status: 200 }
    )
  } catch (error) {
    console.error("[reset-password] POST:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}