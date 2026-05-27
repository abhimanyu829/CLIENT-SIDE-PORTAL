import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { verifyOtp, getRemainingAttempts } from "@/lib/otp"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { code } = body

    if (!code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json(
        { error: "Valid 6-digit OTP is required." },
        { status: 400 }
      )
    }

    const userId = session.user.id

    const isValid = await verifyOtp(userId, code)

    if (!isValid) {
      const remaining = await getRemainingAttempts(userId)
      return NextResponse.json(
        {
          error: `Invalid OTP. ${remaining} attempts remaining.`,
          remainingAttempts: remaining,
        },
        { status: 400 }
      )
    }

    await db.user.update({
      where: { id: userId },
      data: {
        phoneVerified: new Date(),
        otpCode: null,
        otpExpiresAt: null,
      },
    })

    return NextResponse.json(
      { message: "Phone verified successfully." },
      { status: 200 }
    )
  } catch (error: any) {
    if (error?.message?.includes("Too many failed attempts")) {
      return NextResponse.json(
        {
          error:
            "Too many failed attempts. Please wait 10 minutes and try again.",
        },
        { status: 429 }
      )
    }
    console.error("[otp/verify] POST:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}