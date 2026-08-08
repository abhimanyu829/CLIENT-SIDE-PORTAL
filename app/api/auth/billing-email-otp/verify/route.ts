/**
 * POST /api/auth/billing-email-otp/verify
 *
 * Verifies the OTP submitted by the customer against the stored hash.
 * Enforces expiry, attempt limits, and single-use semantics.
 * Does NOT modify Clerk auth or User model.
 *
 * Body: { otp, checkoutSessionId, email }
 * Returns: { success: true, verifiedAt: string }
 */
import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { db } from "@/lib/db"

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { otp, checkoutSessionId, email } = body as {
      otp?: string
      checkoutSessionId?: string
      email?: string
    }

    // ── Validate inputs ──────────────────────────────────────────────────────
    if (!otp || otp.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_OTP", message: "Verification code is required." } },
        { status: 400 }
      )
    }
    if (!checkoutSessionId || !email) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "Session and email are required." } },
        { status: 400 }
      )
    }

    // ── Lookup OTP record ────────────────────────────────────────────────────
    const record = await db.billingEmailOtp.findFirst({
      where: { checkoutSessionId, email },
      orderBy: { createdAt: "desc" },
    })

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_NOT_FOUND",
            message: "No verification code found. Please request a new code.",
          },
        },
        { status: 400 }
      )
    }

    // ── Already verified ─────────────────────────────────────────────────────
    if (record.verified) {
      return NextResponse.json({
        success: true,
        verifiedAt: record.verifiedAt?.toISOString(),
      })
    }

    // ── Expired ──────────────────────────────────────────────────────────────
    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_EXPIRED",
            message: "Verification code has expired. Please request a new one.",
          },
        },
        { status: 400 }
      )
    }

    // ── Attempt limit ────────────────────────────────────────────────────────
    if (record.attempts >= record.maxAttempts) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MAX_ATTEMPTS_EXCEEDED",
            message: "Too many incorrect attempts. Please request a new verification code.",
          },
        },
        { status: 429 }
      )
    }

    // ── Verify OTP hash ──────────────────────────────────────────────────────
    const submittedHash = hashOtp(otp.trim().toUpperCase())
    const isValid = submittedHash === record.otpHash

    if (!isValid) {
      // Increment attempt counter
      await db.billingEmailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })

      const remainingAttempts = record.maxAttempts - record.attempts - 1
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_INVALID",
            message:
              remainingAttempts > 0
                ? `Incorrect code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`
                : "Incorrect code. No attempts remaining — please request a new code.",
          },
          remainingAttempts,
        },
        { status: 400 }
      )
    }

    // ── Mark verified ────────────────────────────────────────────────────────
    const verifiedAt = new Date()
    await db.billingEmailOtp.update({
      where: { id: record.id },
      data: {
        verified: true,
        verifiedAt,
        attempts: { increment: 1 },
      },
    })

    return NextResponse.json({
      success: true,
      verifiedAt: verifiedAt.toISOString(),
    })
  } catch (err) {
    console.error("[billing-email-otp/verify] Error:", err)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } },
      { status: 500 }
    )
  }
}
