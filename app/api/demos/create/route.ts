import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { nanoid } from "nanoid"
import { issueSignedPreviewToken } from "@/lib/preview-token"
import { previewQueue, emailQueue, PREVIEW_JOBS, EMAIL_JOBS } from "@/lib/queue"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"

// POST /api/demos/create — create an enterprise preview session
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    // Auth required for all preview sessions
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Login required to preview products", requiresAuth: true },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await req.json()
    const { productId } = body

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 })
    }

    // IP-based rate limiting: max 10 preview creations per IP per hour
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown"

    if (redis && ip !== "unknown") {
      try {
        const ipKey = `preview:ip:${ip}`
        const count = await redis.incr(ipKey)
        if (count === 1) await redis.expire(ipKey, 3600)
        if (count > 10) {
          return NextResponse.json(
            { error: "Too many preview requests from this IP. Please try again later." },
            { status: 429 }
          )
        }
      } catch (redisErr) {
        logger.warn({ redisErr }, "preview/create: Redis rate limit check failed, proceeding")
      }
    }

    // Fetch product with preview config
    const product = await db.product.findUnique({
      where: { id: productId, status: "AVAILABLE" },
      select: {
        id: true,
        name: true,
        slug: true,
        previewEnabled: true,
        previewConfig: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    if (!product.previewEnabled) {
      return NextResponse.json(
        { error: "Preview is not available for this product" },
        { status: 403 }
      )
    }

    // Parse preview config
    const config = (product.previewConfig as Record<string, unknown>) ?? {}
    const durationMinutes = Number(config.durationMinutes) || 10
    const maxPreviewsPerUser = Number(config.maxPreviewsPerUser) || 6
    const previewUrl = typeof config.url === "string" ? config.url : ""

    // Check user preview quota
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { previewCount: true },
    })

    if (user && user.previewCount >= maxPreviewsPerUser) {
      return NextResponse.json(
        {
          error: `Preview limit reached. You have used ${user.previewCount}/${maxPreviewsPerUser} previews. Upgrade to preview more products.`,
          limitReached: true,
          previewCount: user.previewCount,
          maxPreviews: maxPreviewsPerUser,
        },
        { status: 429 }
      )
    }

    const deviceFingerprint = req.headers.get("x-device-fingerprint") ?? undefined
    const userAgent = req.headers.get("user-agent") ?? undefined
    const referrer = req.headers.get("referer") ?? undefined

    const expiresAt = new Date(Date.now() + durationMinutes * 60_000)
    const sessionToken = nanoid(32) // legacy compat field

    // Create session + increment user preview count atomically
    const demoSession = await db.$transaction(async (tx) => {
      const demo = await tx.demoSession.create({
        data: {
          productId: product.id,
          userId,
          templateId: productId,
          sessionToken,
          previewUrl,
          durationMinutes,
          ipAddress: ip !== "unknown" ? ip : undefined,
          userAgent,
          deviceFingerprint,
          referrer,
          expiresAt,
          mockDataJson: {},
        },
      })

      await tx.user.update({
        where: { id: userId },
        data: {
          previewCount: { increment: 1 },
          lastPreviewAt: new Date(),
        },
      })

      await tx.auditLog.create({
        data: {
          userId,
          action: "PREVIEW_STARTED",
          entity: "DemoSession",
          entityId: demo.id,
          afterJson: {
            productId: product.id,
            productName: product.name,
            ip,
            durationMinutes,
            expiresAt: expiresAt.toISOString(),
          },
        },
      })

      return demo
    })

    // Issue signed token
    const signedToken = issueSignedPreviewToken(
      demoSession.id,
      userId,
      productId,
      expiresAt
    )

    // Store signed token on session record
    await db.demoSession.update({
      where: { id: demoSession.id },
      data: { signedToken },
    })

    // Queue auto-expiry job (fires after durationMinutes)
    await previewQueue.add(
      PREVIEW_JOBS.EXPIRE_SESSION,
      {
        sessionId: demoSession.id,
        userId,
        productId: product.id,
        productName: product.name,
        expiresAt: expiresAt.toISOString(),
      },
      { delay: durationMinutes * 60_000, jobId: `preview-expire-${demoSession.id}` }
    )

    // Queue preview-started email notification
    await emailQueue.add(EMAIL_JOBS.SEND_PREVIEW_STARTED, {
      userId,
      productName: product.name,
      expiresAt: expiresAt.toISOString(),
      durationMinutes,
      previewUrl,
    })

    // Emit platform event
    await emitEvent({
      type: EVENTS.PREVIEW_STARTED,
      timestamp: new Date().toISOString(),
      actorId: userId,
      payload: {
        sessionId: demoSession.id,
        productId: product.id,
        productName: product.name,
        userId,
        ip,
        durationMinutes,
        expiresAt: expiresAt.toISOString(),
      },
    })

    logger.info(
      { sessionId: demoSession.id, userId, productId: product.id, durationMinutes },
      "Preview session created"
    )

    return NextResponse.json(
      {
        data: {
          sessionToken: signedToken,
          sessionId: demoSession.id,
          previewUrl,
          expiresAt: expiresAt.toISOString(),
          durationMinutes,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    logger.error({ err }, "[demos/create] POST failed")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
