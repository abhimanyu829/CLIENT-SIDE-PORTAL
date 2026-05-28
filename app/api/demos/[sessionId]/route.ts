import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSignedPreviewToken } from "@/lib/preview-token"
import { logger } from "@/lib/logger"

// GET /api/demos/[sessionId] — validate and fetch demo session data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  // Extract token from Authorization header or query param
  const authHeader = req.headers.get("authorization")
  const token =
    authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.nextUrl.searchParams.get("token")

  // If a signed token is provided, validate it cryptographically
  if (token && token.includes(".")) {
    try {
      const payload = await validateSignedPreviewToken(token)

      const demo = await db.demoSession.findUnique({
        where: { id: payload.sessionId },
        include: {
          product: {
            select: {
              name: true,
              slug: true,
              thumbnailUrl: true,
              description: true,
            },
          },
        },
      })

      if (!demo) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      if (demo.isRevoked) {
        return NextResponse.json({ error: "Session has been revoked" }, { status: 403 })
      }

      if (demo.isExpired || demo.expiresAt < new Date()) {
        if (!demo.isExpired) {
          await db.demoSession.update({
            where: { id: demo.id },
            data: { isExpired: true },
          })
        }
        return NextResponse.json({ error: "Session has expired" }, { status: 410 })
      }

      // Update analytics heartbeat
      await db.demoSession.update({
        where: { id: demo.id },
        data: {
          lastActivityAt: new Date(),
          viewedPages: { increment: 1 },
        },
      })

      return NextResponse.json({
        data: {
          sessionId: demo.id,
          sessionToken: demo.signedToken,
          product: demo.product,
          previewUrl: demo.previewUrl,
          expiresAt: demo.expiresAt,
          durationMinutes: demo.durationMinutes,
          startedAt: demo.startedAt,
          remainingSeconds: Math.max(
            0,
            Math.floor((demo.expiresAt.getTime() - Date.now()) / 1000)
          ),
        },
      })
    } catch (err) {
      const msg = (err as Error).message
      if (msg === "EXPIRED") {
        return NextResponse.json({ error: "Preview token expired" }, { status: 410 })
      }
      if (msg === "REVOKED") {
        return NextResponse.json({ error: "Preview token has been revoked" }, { status: 403 })
      }
      return NextResponse.json({ error: "Invalid preview token" }, { status: 401 })
    }
  }

  // Legacy fallback: look up by plain sessionToken string in URL
  try {
    const demo = await db.demoSession.findUnique({
      where: { sessionToken: sessionId },
      include: {
        product: {
          select: {
            name: true,
            slug: true,
            thumbnailUrl: true,
            description: true,
          },
        },
      },
    })

    if (!demo) {
      return NextResponse.json({ error: "Demo session not found" }, { status: 404 })
    }

    if (demo.isRevoked) {
      return NextResponse.json({ error: "Session has been revoked" }, { status: 403 })
    }

    if (demo.isExpired || demo.expiresAt < new Date()) {
      if (!demo.isExpired) {
        await db.demoSession.update({
          where: { id: demo.id },
          data: { isExpired: true },
        })
      }
      return NextResponse.json({ error: "Demo session has expired" }, { status: 410 })
    }

    await db.demoSession.update({
      where: { id: demo.id },
      data: {
        lastActivityAt: new Date(),
        viewedPages: { increment: 1 },
      },
    })

    return NextResponse.json({
      data: {
        sessionToken: demo.sessionToken,
        product: demo.product,
        previewUrl: demo.previewUrl,
        expiresAt: demo.expiresAt,
        startedAt: demo.startedAt,
        remainingSeconds: Math.max(
          0,
          Math.floor((demo.expiresAt.getTime() - Date.now()) / 1000)
        ),
      },
    })
  } catch (err) {
    logger.error({ err, sessionId }, "[demos/sessionId] GET failed")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/demos/[sessionId] — mark as converted/expired
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  try {
    await db.demoSession.update({
      where: { sessionToken: sessionId },
      data: {
        isExpired: true,
        convertedAt: new Date(),
        convertedToOrder: true,
      },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 404 })
  }
}

// PATCH /api/demos/[sessionId] — heartbeat update
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  try {
    await db.demoSession.update({
      where: { sessionToken: sessionId },
      data: { lastActivityAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 404 })
  }
}
