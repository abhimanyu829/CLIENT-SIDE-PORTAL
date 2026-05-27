import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateToken, hashToken, tokenExpiry } from "@/lib/tokens"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { env } from "@/lib/env"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, isVerified: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        {
          message:
            "If an account exists with this email, a reset link has been sent.",
        },
        { status: 200 }
      )
    }

    if (!user.isVerified) {
      return NextResponse.json(
        {
          message:
            "Please verify your email first before resetting your password.",
        },
        { status: 200 }
      )
    }

    const rawToken = generateToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = tokenExpiry(60)

    await db.user.update({
      where: { id: user.id },
      data: { resetToken: tokenHash, resetTokenExp: expiresAt },
    })

    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`

    await emailQueue.add(EMAIL_JOBS.SEND_RESET, {
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInHours: 1,
    })

    return NextResponse.json(
      {
        message:
          "If an account exists with this email, a reset link has been sent.",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[forgot-password] POST:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}