import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateOtp, storeOtp, setSendCooldown, checkSendCooldown, normalizePhone } from "@/lib/otp"
import { sendSms } from "@/lib/twilio"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { phone } = body as { phone?: string }

    const normalized = normalizePhone(phone ?? "")
    if (!normalized) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PHONE",
            message: "A valid phone number in international format is required. Example: +919876543210",
          },
        },
        { status: 400 }
      )
    }

    const userId = session.user.id

    // Already-verified for this number → nothing to do (idempotent).
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true, phoneVerified: true },
    })
    if (user?.phone === normalized && user?.phoneVerified) {
      return NextResponse.json(
        {
          success: true,
          message: "This phone number is already verified.",
          alreadyVerified: true,
          phone: normalized,
        },
        { status: 200 }
      )
    }

    const inCooldown = await checkSendCooldown(userId)
    if (inCooldown) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_COOLDOWN",
            message: "Please wait before requesting another OTP.",
          },
        },
        { status: 429 }
      )
    }

    const otp = generateOtp()

    // Store the OTP bound to this phone BEFORE sending. The pending number is
    // written to otpPhone (not User.phone) — the user-facing phone field is
    // only updated after the code is successfully verified.
    await storeOtp(userId, otp, normalized)

    const smsSent = await sendSms(
      normalized,
      `Your NexusAI verification code is: ${otp}. Expires in 10 minutes.`
    )

    if (!smsSent) {
      // Do not start the resend cooldown on a failed send — but the OTP
      // itself remains valid, so a retry inside the same window would fail
      // verifyOtp with "code not found". Safe: consume it.
      await db.user.update({
        where: { id: userId },
        data: { otpCode: null, otpExpiresAt: null, otpPhone: null, otpAttempts: 0 },
      }).catch(() => {})
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SMS_UNAVAILABLE",
            message:
              "SMS service is not configured or unavailable. Please contact support.",
          },
        },
        { status: 503 }
      )
    }

    await setSendCooldown(userId)

    return NextResponse.json(
      {
        success: true,
        message: "OTP sent to your phone.",
        phone: normalized,
        cooldownSeconds: 60,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[otp/send] POST:", error)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    )
  }
}
