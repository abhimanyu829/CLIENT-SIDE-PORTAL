import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashToken, isExpired } from "@/lib/tokens"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { createNotification } from "@/lib/notifications"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token } = body

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Verification token is required." },
        { status: 400 }
      )
    }

    console.log("[VERIFY] Processing email verification request")
    const tokenHash = hashToken(token)

    const user = await db.user.findFirst({
      where: { verificationToken: tokenHash },
      select: {
        id: true,
        email: true,
        name: true,
        isVerified: true,
        verificationTokenExp: true,
      },
    })

    if (!user) {
      console.log("[VERIFY] ❌ No user found for token hash")
      return NextResponse.json(
        { error: "Invalid verification token." },
        { status: 400 }
      )
    }

    if (user.isVerified) {
      console.log(`[VERIFY] User ${user.email} already verified`)
      return NextResponse.json(
        { message: "Email already verified. You can log in." },
        { status: 200 }
      )
    }

    if (!user.verificationTokenExp || isExpired(user.verificationTokenExp)) {
      console.log(`[VERIFY] ❌ Token expired for ${user.email}`)
      return NextResponse.json(
        {
          error: "Verification token has expired. Request a new one.",
          expired: true,
        },
        { status: 400 }
      )
    }

    const wasFirstVerification = !user.isVerified

    console.log(`[VERIFY] ✅ Email verified successfully for ${user.email}`)

    await db.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExp: null,
      },
    })

    if (wasFirstVerification) {
      await emitEvent({
        type: EVENTS.USER_CREATED,
        timestamp: new Date().toISOString(),
        actorId: user.id,
        payload: { userId: user.id, email: user.email, name: user.name },
      })

      try {
        await createNotification({
          userId: user.id,
          type: "SYSTEM",
          title: "Welcome to NexusAI",
          body: "Your email has been verified. You can now log in and explore the platform.",
          actionUrl: "/dashboard",
        })
      } catch {}
    }

    return NextResponse.json(
      { message: "Email verified successfully. You can now log in." },
      { status: 200 }
    )
  } catch (error) {
    console.error("[VERIFY] ❌ Verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}