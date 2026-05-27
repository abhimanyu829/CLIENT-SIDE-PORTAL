import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/resend"
import WelcomeEmail from "@/emails/WelcomeEmail"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

export async function GET() {
  const resendKey = env.RESEND_API_KEY
  const emailFrom = env.EMAIL_FROM
  const appUrl = env.NEXT_PUBLIC_APP_URL

  logger.info(
    {
      resendConfigured: !!resendKey,
      resendKeyPrefix: resendKey?.slice(0, 8) ?? "NOT SET",
      emailFrom,
      appUrl,
    },
    "Testing email delivery"
  )

  if (!resendKey || resendKey.trim() === "") {
    return NextResponse.json(
      {
        success: false,
        error: "RESEND_API_KEY is empty or not configured",
        env: {
          RESEND_API_KEY: resendKey ? "SET (empty)" : "NOT SET",
          EMAIL_FROM: emailFrom ?? "NOT SET",
          NEXT_PUBLIC_APP_URL: appUrl ?? "NOT SET",
        },
      },
      { status: 500 }
    )
  }

  if (!emailFrom) {
    return NextResponse.json(
      {
        success: false,
        error: "EMAIL_FROM is not configured",
        env: {
          RESEND_API_KEY: "SET (hidden)",
          EMAIL_FROM: "NOT SET",
          NEXT_PUBLIC_APP_URL: appUrl ?? "NOT SET",
        },
      },
      { status: 500 }
    )
  }

  try {
    console.log("[TEST-EMAIL] Sending test email...")

    const result = await sendEmail({
      to: emailFrom,
      subject: "NexusAI — Email Delivery Test",
      react: WelcomeEmail({
        name: "Test User",
        dashboardUrl: `${appUrl}/dashboard`,
      }),
      tags: [{ name: "type", value: "test" }],
    })

    if (result.error) {
      logger.error({ error: result.error }, "Test email failed")
      console.error(`[TEST-EMAIL] ❌ Send failed: ${result.error}`)
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          env: {
            RESEND_API_KEY: "SET (hidden)",
            EMAIL_FROM: emailFrom,
            NEXT_PUBLIC_APP_URL: appUrl ?? "NOT SET",
          },
        },
        { status: 502 }
      )
    }

    logger.info({ id: result.id }, "Test email delivered")
    console.log(`[TEST-EMAIL] ✅ Sent successfully — Resend ID: ${result.id}`)

    return NextResponse.json(
      {
        success: true,
        message: "Test email delivered successfully",
        resendId: result.id,
        config: {
          emailFrom,
          appUrl: appUrl ?? "NOT SET",
        },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error({ error: message }, "Test email threw exception")
    console.error(`[TEST-EMAIL] ❌ Exception: ${message}`)
    return NextResponse.json(
      {
        success: false,
        error: message,
        env: {
          RESEND_API_KEY: "SET (hidden)",
          EMAIL_FROM: emailFrom ?? "NOT SET",
          NEXT_PUBLIC_APP_URL: appUrl ?? "NOT SET",
        },
      },
      { status: 500 }
    )
  }
}