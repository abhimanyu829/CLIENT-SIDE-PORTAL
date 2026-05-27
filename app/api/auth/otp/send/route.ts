import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateOtp, storeOtp, setSendCooldown, checkSendCooldown } from "@/lib/otp"
import { sendSms } from "@/lib/twilio"

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
    const { phone } = body

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      )
    }

    const userId = session.user.id

    const inCooldown = await checkSendCooldown(userId)
    if (inCooldown) {
      return NextResponse.json(
        { error: "Please wait before requesting another OTP." },
        { status: 429 }
      )
    }

    const otp = generateOtp()

    await db.user.update({
      where: { id: userId },
      data: { phone },
    })

    await storeOtp(userId, otp)

    const smsSent = await sendSms(
      phone,
      `Your NexusAI verification code is: ${otp}. Expires in 10 minutes.`
    )

    if (!smsSent) {
      return NextResponse.json(
        {
          error:
            "SMS service unavailable. Please try again later or contact support.",
        },
        { status: 503 }
      )
    }

    await setSendCooldown(userId)

    return NextResponse.json(
      { message: "OTP sent to your phone." },
      { status: 200 }
    )
  } catch (error) {
    console.error("[otp/send] POST:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}