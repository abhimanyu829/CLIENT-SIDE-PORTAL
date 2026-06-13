import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.json({ success: false, error: { message: "Missing unsubscribe token" } }, { status: 400 })
    }

    const preference = await db.emailPreference.findUnique({ where: { unsubscribeToken: token } })
    if (!preference) {
      return NextResponse.json({ success: false, error: { message: "Invalid unsubscribe token" } }, { status: 404 })
    }

    const user = await db.user.findUnique({ where: { id: preference.userId }, select: { email: true } })
    if (user?.email) {
      await db.emailSuppression.upsert({
        where: { email: user.email.toLowerCase() },
        create: {
          email: user.email.toLowerCase(),
          reason: "UNSUBSCRIBED",
          emailTypes: [],
          source: "unsubscribe-link",
        },
        update: {
          reason: "UNSUBSCRIBED",
          emailTypes: [],
          source: "unsubscribe-link",
        },
      })
    }

    const updated = await db.emailPreference.update({
      where: { unsubscribeToken: token },
      data: {
        marketing: false,
        newsletter: false,
        productUpdates: false,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: updated.userId,
        message: "You have been unsubscribed from non-transactional NexusAI emails.",
      },
    })
  } catch (error) {
    logger.error({ error }, "GET /api/email/unsubscribe")
    return NextResponse.json({ success: false, error: { message: "Unable to process unsubscribe request" } }, { status: 500 })
  }
}
