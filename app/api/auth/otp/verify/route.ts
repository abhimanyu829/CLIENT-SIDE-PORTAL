import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { verifyOtp, getRemainingAttempts, normalizePhone } from "@/lib/otp"
import { auditLog } from "@/lib/admin-audit"

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
    const { phone, code } = body as { phone?: string; code?: string }

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

    if (!code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_OTP", message: "Valid 6-digit OTP is required." } },
        { status: 400 }
      )
    }

    const userId = session.user.id

    const isValid = await verifyOtp(userId, code, normalized)

    if (!isValid) {
      const remaining = await getRemainingAttempts(userId)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_OTP",
            message: `Invalid or expired OTP. ${remaining} attempt(s) remaining.`,
          },
          remainingAttempts: remaining,
        },
        { status: 400 }
      )
    }

    // Consume the OTP and persist the PROVEN phone + verification state in a
    // single atomic update — the payment gate reads exactly these fields.
    const verifiedAt = new Date()
    await db.user.update({
      where: { id: userId },
      data: {
        phone: normalized,
        phoneVerified: verifiedAt,
        otpCode: null,
        otpExpiresAt: null,
        otpPhone: null,
        otpAttempts: 0,
      },
    })

    // Audit trail — mirrors the Firebase phone-OTP route's PHONE_OTP_VERIFIED
    // event. Never logs the OTP itself.
    await auditLog({
      userId,
      action: "PHONE_OTP_VERIFIED",
      entity: "User",
      entityId: userId,
      after: { phone: normalized, verifiedAt: verifiedAt.toISOString(), channel: "TWILIO" },
    })

    return NextResponse.json(
      {
        success: true,
        message: "Phone verified successfully.",
        phone: normalized,
        verifiedAt: verifiedAt.toISOString(),
      },
      { status: 200 }
    )
  } catch (error: any) {
    if (error?.message?.includes("Too many failed attempts")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOO_MANY_ATTEMPTS",
            message: "Too many failed attempts. Please wait 10 minutes and try again.",
          },
        },
        { status: 429 }
      )
    }
    console.error("[otp/verify] POST:", error)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    )
  }
}
