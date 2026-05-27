import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { generateToken, hashToken, tokenExpiry } from "@/lib/tokens"
import { sendVerificationEmail } from "@/lib/email/send-verification-email"
import { env } from "@/lib/env"
import { auditLog } from "@/lib/admin-audit"
import { logger } from "@/lib/logger"

// GET /api/admin/users/[id]/verify — Get verification status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      isVerified: true,
      emailVerified: true,
      verificationToken: true,
      verificationTokenExp: true,
      createdAt: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isVerified: user.isVerified,
    emailVerified: user.emailVerified,
    hasVerificationToken: !!user.verificationToken,
    verificationTokenExp: user.verificationTokenExp,
    createdAt: user.createdAt,
  })
}

// PATCH /api/admin/users/[id]/verify — Admin verification actions
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()
  const body = await req.json()
  const { action } = body

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      isVerified: true,
      emailVerified: true,
      verificationToken: true,
      verificationTokenExp: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  switch (action) {
    // Manually verify a user's email
    case "verify": {
      if (user.isVerified) {
        return NextResponse.json(
          { error: "User is already verified" },
          { status: 400 }
        )
      }

      await db.user.update({
        where: { id },
        data: {
          isVerified: true,
          emailVerified: new Date(),
          verificationToken: null,
          verificationTokenExp: null,
        },
      })

      await auditLog({
        userId: admin.userId,
        action: "ADMIN_MANUAL_VERIFY",
        entity: "User",
        entityId: id,
        after: {
          email: user.email,
          verifiedBy: admin.userId,
        },
      })

      logger.info({ userId: id, adminId: admin.userId }, "Admin manually verified user")

      return NextResponse.json({
        success: true,
        message: `${user.email} has been manually verified`,
      })
    }

    // Resend verification email to user
    case "resend": {
      if (user.isVerified) {
        return NextResponse.json(
          { error: "User is already verified" },
          { status: 400 }
        )
      }

      const rawToken = generateToken()
      const tokenHash = hashToken(rawToken)
      const expiresAt = tokenExpiry(env.VERIFICATION_TOKEN_EXPIRY_MINUTES)

      await db.user.update({
        where: { id },
        data: {
          verificationToken: tokenHash,
          verificationTokenExp: expiresAt,
        },
      })

      const verificationUrl = `${env.NEXT_PUBLIC_APP_URL}/verify?token=${rawToken}`
      console.log(`[ADMIN-RESEND] Sending verification email to ${user.email}`)

      const emailResult = await sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationUrl,
        expiryMinutes: env.VERIFICATION_TOKEN_EXPIRY_MINUTES,
      })

      await auditLog({
        userId: admin.userId,
        action: "ADMIN_RESEND_VERIFICATION",
        entity: "User",
        entityId: id,
        after: {
          email: user.email,
          resentBy: admin.userId,
          emailResult: emailResult.error ? "failed" : "sent",
        },
      })

      if (emailResult.error) {
        logger.error(
          { error: emailResult.error, email: user.email },
          "Admin resend verification email failed"
        )
        return NextResponse.json(
          { error: `Failed to send email: ${emailResult.error}` },
          { status: 502 }
        )
      }

      logger.info({ email: user.email, adminId: admin.userId }, "Admin resent verification email")

      return NextResponse.json({
        success: true,
        message: `Verification email sent to ${user.email}`,
        resendId: emailResult.id,
      })
    }

    // Revoke verification (un-verify a user)
    case "unverify": {
      if (!user.isVerified) {
        return NextResponse.json(
          { error: "User is not verified" },
          { status: 400 }
        )
      }

      await db.user.update({
        where: { id },
        data: {
          isVerified: false,
          emailVerified: null,
        },
      })

      await auditLog({
        userId: admin.userId,
        action: "ADMIN_UNVERIFY",
        entity: "User",
        entityId: id,
        after: {
          email: user.email,
          unverifedBy: admin.userId,
        },
      })

      logger.info({ userId: id, adminId: admin.userId }, "Admin unverifed user")

      return NextResponse.json({
        success: true,
        message: `${user.email} has been unverifed`,
      })
    }

    default:
      return NextResponse.json(
        { error: "Unknown action. Use: verify, resend, or unverify" },
        { status: 400 }
      )
  }
}