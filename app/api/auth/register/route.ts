import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hash } from "bcryptjs"
import { generateToken, hashToken, tokenExpiry } from "@/lib/tokens"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { env } from "@/lib/env"
import { sendVerificationEmail } from "@/lib/email/send-verification-email"
import { logger } from "@/lib/logger"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, password, phone } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true, isVerified: true, verificationTokenExp: true },
    })

    if (existingUser) {
      if (existingUser.isVerified) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        )
      }

      const tokenExpired =
        existingUser.verificationTokenExp &&
        existingUser.verificationTokenExp.getTime() < Date.now()

      if (!tokenExpired) {
        return NextResponse.json(
          {
            message:
              "Registration pending. Check your email for the verification link.",
          },
          { status: 200 }
        )
      }
    }

    const passwordHash = await hash(password, 10)
    const rawToken = generateToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = tokenExpiry(env.VERIFICATION_TOKEN_EXPIRY_MINUTES)

    if (existingUser) {
      await db.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          passwordHash,
          phone: phone ?? undefined,
          verificationToken: tokenHash,
          verificationTokenExp: expiresAt,
        },
      })
    } else {
      await db.user.create({
        data: {
          name,
          email,
          passwordHash,
          phone: phone ?? undefined,
          verificationToken: tokenHash,
          verificationTokenExp: expiresAt,
        },
      })
    }

    const verificationUrl = `${env.NEXT_PUBLIC_APP_URL}/verify?token=${rawToken}`
    console.log(`[REGISTER] Sending verification email to ${email}`)
    console.log(`[REGISTER] Verification URL: ${verificationUrl}`)

    const emailResult = await sendVerificationEmail({
      to: email,
      name,
      verificationUrl,
      expiryMinutes: env.VERIFICATION_TOKEN_EXPIRY_MINUTES,
    })

    if (emailResult.error) {
      console.error(`[REGISTER] ❌ Direct email send failed: ${emailResult.error}`)
      logger.warn(
        { error: emailResult.error, email },
        "Direct email send failed — queuing for retry"
      )

      try {
        await emailQueue.add(EMAIL_JOBS.SEND_WELCOME, {
          to: email,
          name,
          type: "verification",
          verificationUrl,
          expiryMinutes: env.VERIFICATION_TOKEN_EXPIRY_MINUTES,
        })
        console.log(`[REGISTER] ✅ Verification email queued for worker retry`)
        logger.info({ email }, "Verification email queued for worker retry")
      } catch (queueError) {
        console.error(`[REGISTER] ❌ Failed to queue verification email:`, queueError)
        logger.error(
          { error: queueError, email },
          "Failed to queue verification email — email not sent"
        )
      }
    } else {
      console.log(`[REGISTER] ✅ Verification email sent successfully to ${email} (Resend ID: ${emailResult.id})`)
    }

    return NextResponse.json(
      { message: "Check your email to verify your account." },
      { status: 201 }
    )
  } catch (error) {
    console.error("[register] POST:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
