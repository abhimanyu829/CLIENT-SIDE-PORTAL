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
    const { phone, force } = body as { phone?: string; force?: boolean }

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
    if (user?.phone === normalized && user?.phoneVerified && !force) {
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

    let delivered = smsSent
    let deliveryChannel = "phone"

    if (!delivered) {
      // Twilio Trial account cannot send SMS to numbers not verified in Twilio Console.
      // Fallback: send the verification code to user's registered email via Resend.
      const userRecord = await db.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })
      const targetEmail = session.user.email || userRecord?.email

      if (targetEmail) {
        try {
          const { sendEmail } = await import("@/lib/resend")
          const React = (await import("react")).default
          const { CommunicationEmail } = await import("@/emails/CommunicationEmail")

          console.log(`[OTP] Twilio trial blocked SMS to ${normalized}. Delivering OTP ${otp} to ${targetEmail}`)

          const emailRes = await sendEmail({
            to: targetEmail,
            subject: `Your Phone Verification Code: ${otp} — Abhibhi Developers`,
            react: React.createElement(CommunicationEmail, {
              preview: `Your phone verification code is ${otp}`,
              title: "Phone Verification Code",
              subtitle: `Verifying mobile: ${normalized}`,
              recipientName: userRecord?.name ?? "there",
              body: `Your verification code for mobile number ${normalized} is below. Enter this 6-digit code on the checkout screen to verify your phone. Valid for 10 minutes.`,
              details: [
                { label: "Mobile Number", value: normalized },
                { label: "Verification Code", value: otp },
                { label: "Valid For", value: "10 minutes" },
              ],
            }),
          })
          if (!emailRes.error) {
            delivered = true
            deliveryChannel = "email"
          }
        } catch (emailErr) {
          console.error("[OTP] Email fallback error:", emailErr)
        }
      }
    }

    if (!delivered) {
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
        message: deliveryChannel === "email"
          ? "Verification code sent to your registered email (Twilio trial limited)."
          : "OTP sent to your phone.",
        phone: normalized,
        channel: deliveryChannel,
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
