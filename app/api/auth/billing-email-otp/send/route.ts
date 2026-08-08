/**
 * POST /api/auth/billing-email-otp/send
 *
 * Generates and sends a cryptographically secure hex OTP to the billing email.
 * Scoped to a checkout session — does NOT modify Clerk auth or User records.
 *
 * Body: { email, checkoutSessionId, customerName? }
 * Returns: { success: true, cooldownSeconds: number }
 */
import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/resend"
import { BillingOtpEmail } from "@/emails/BillingOtpEmail"
import * as React from "react"

const OTP_EXPIRY_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 60
const MAX_RESENDS = 5

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex")
}

function generateOtp(): string {
  // 8-char uppercase hex — cryptographically secure
  return randomBytes(4).toString("hex").toUpperCase()
}

export async function POST(req: NextRequest) {
  try {
    // Clerk session (optional — guest checkout may still have a session)
    const session = await auth()
    const userId = session?.user?.id ?? null

    const body = await req.json()
    const { email, checkoutSessionId, customerName } = body as {
      email?: string
      checkoutSessionId?: string
      customerName?: string
    }

    // ── Validate inputs ──────────────────────────────────────────────────────
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_EMAIL", message: "A valid billing email is required." } },
        { status: 400 }
      )
    }

    if (!checkoutSessionId || checkoutSessionId.length < 5) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_SESSION", message: "Invalid checkout session." } },
        { status: 400 }
      )
    }

    // ── Resend cooldown ──────────────────────────────────────────────────────
    const existing = await db.billingEmailOtp.findFirst({
      where: { checkoutSessionId, email },
      orderBy: { createdAt: "desc" },
    })

    if (existing) {
      // Enforce resend cooldown
      if (existing.lastResendAt) {
        const secondsSinceResend = (Date.now() - existing.lastResendAt.getTime()) / 1000
        if (secondsSinceResend < RESEND_COOLDOWN_SECONDS) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "RESEND_COOLDOWN",
                message: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceResend)}s before requesting a new code.`,
              },
              cooldownSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceResend),
            },
            { status: 429 }
          )
        }
      }

      // Max resend guard
      if (existing.resendCount >= MAX_RESENDS) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "MAX_RESENDS_EXCEEDED",
              message: "Maximum resend limit reached. Please start a new checkout session.",
            },
          },
          { status: 429 }
        )
      }
    }

    // ── Generate OTP ─────────────────────────────────────────────────────────
    const otp = generateOtp()
    const otpHash = hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    const now = new Date()

    // ── Create or refresh OTP record ─────────────────────────────────────────
    if (existing) {
      // Update existing record — resets OTP hash, clears verified state
      await db.billingEmailOtp.update({
        where: { id: existing.id },
        data: {
          otpHash,
          expiresAt,
          attempts: 0,
          verified: false,
          verifiedAt: null,
          resendCount: { increment: 1 },
          lastResendAt: now,
        },
      })
    } else {
      // Create new record
      await db.billingEmailOtp.create({
        data: {
          checkoutSessionId,
          email,
          otpHash,
          expiresAt,
          attempts: 0,
          verified: false,
          resendCount: 0,
          lastResendAt: now,
          userId,
        },
      })
    }

    // ── Send email via Resend ────────────────────────────────────────────────
    const emailResult = await sendEmail({
      to: email,
      subject: `${otp} — NexusAI Billing Verification Code`,
      react: React.createElement(BillingOtpEmail, {
        customerName: customerName || "there",
        otp,
        expiryMinutes: OTP_EXPIRY_MINUTES,
        billingEmail: email,
      }),
      tags: [{ name: "type", value: "billing-otp" }],
    })

    if (emailResult.error) {
      console.error("[billing-email-otp/send] Email send failed:", emailResult.error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_SEND_FAILED",
            message: "Failed to send verification email. Please check your email address and try again.",
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      cooldownSeconds: RESEND_COOLDOWN_SECONDS,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    })
  } catch (err) {
    console.error("[billing-email-otp/send] Error:", err)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } },
      { status: 500 }
    )
  }
}
