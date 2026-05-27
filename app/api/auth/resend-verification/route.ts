import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateToken, hashToken, tokenExpiry } from "@/lib/tokens"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { env } from "@/lib/env"
import { redis } from "@/lib/redis"
import { sendVerificationEmail } from "@/lib/email/send-verification-email"
import { logger } from "@/lib/logger"

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

    const normalizedEmail = email.toLowerCase().trim()

    // Rate limit: 60-second cooldown per email
    const cooldownKey = `verify-resend:${normalizedEmail}`
    if (redis) {
      const inCooldown = await redis.exists(cooldownKey)
      if (inCooldown) {
        return NextResponse.json(
          { error: "Please wait before requesting another verification email." },
          { status: 429 }
        )
      }
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isVerified: true, name: true },
    })

    if (user?.isVerified) {
      return NextResponse.json(
        { message: "Email already verified. You can log in." },
        { status: 200 }
      )
    }

    if (!user) {
      // Return generic message to prevent email enumeration
      return NextResponse.json(
        { message: "If an account exists with this email, a verification link has been sent." },
        { status: 200 }
      )
    }

    const rawToken = generateToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = tokenExpiry(env.VERIFICATION_TOKEN_EXPIRY_MINUTES)

    await db.user.update({
      where: { id: user.id },
      data: {
        verificationToken: tokenHash,
        verificationTokenExp: expiresAt,
      },
    })

    const verificationUrl = `${env.NEXT_PUBLIC_APP_URL}/verify?token=${rawToken}`
    console.log(`[RESEND-VERIFICATION] Sending verification email to ${normalizedEmail}`)

    // Primary: send directly via Resend
    const emailResult = await sendVerificationEmail({
      to: normalizedEmail,
      name: user.name,
      verificationUrl,
      expiryMinutes: env.VERIFICATION_TOKEN_EXPIRY_MINUTES,
    })

    if (emailResult.error) {
      logger.warn(
        { error: emailResult.error, email: normalizedEmail },
        "Direct verification email send failed — queuing for retry"
      )

      // Fallback: queue for worker retry
      try {
        await emailQueue.add(EMAIL_JOBS.SEND_WELCOME, {
          to: normalizedEmail,
          name: user.name,
          type: "verification",
          verificationUrl,
          expiryMinutes: env.VERIFICATION_TOKEN_EXPIRY_MINUTES,
        })
        logger.info({ email: normalizedEmail }, "Verification email queued for worker retry")
      } catch (queueError) {
        logger.error(
          { error: queueError, email: normalizedEmail },
          "Failed to queue verification email — email not sent"
        )
        return NextResponse.json(
          { error: "Failed to send verification email. Please try again later." },
          { status: 500 }
        )
      }
    } else {
      console.log(`[RESEND-VERIFICATION] ✅ Verification email sent successfully to ${normalizedEmail}`)
    }

    // Set rate limit cooldown
    if (redis) {
      await redis.set(cooldownKey, "1", { ex: 60 })
    }

    return NextResponse.json(
      { message: "If an account exists with this email, a verification link has been sent." },
      { status: 200 }
    )
  } catch (error) {
    console.error("[RESEND-VERIFICATION] POST:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}