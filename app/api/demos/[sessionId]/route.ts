import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/demos/[sessionId] — fetch demo session data
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const demo = await db.demoSession.findUnique({
      where: { sessionToken: sessionId },
      include: {
        product: {
          select: { name: true, slug: true, thumbnailUrl: true, description: true },
        },
      },
    })

    if (!demo) {
      return NextResponse.json({ error: "Demo session not found" }, { status: 404 })
    }

    if (demo.isExpired || demo.expiresAt < new Date()) {
      // Mark as expired if not already
      if (!demo.isExpired) {
        await db.demoSession.update({
          where: { id: demo.id },
          data: { isExpired: true },
        })
      }
      return NextResponse.json({ error: "Demo session has expired" }, { status: 410 })
    }

    return NextResponse.json({
      data: {
        sessionToken: demo.sessionToken,
        product: demo.product,
        templateId: demo.templateId,
        mockData: demo.mockDataJson,
        expiresAt: demo.expiresAt,
        startedAt: demo.startedAt,
      },
    })
  } catch (err) {
    console.error("[demos/[sessionId]] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/demos/[sessionId] — mark demo session as converted/expired
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    await db.demoSession.update({
      where: { sessionToken: sessionId },
      data: { isExpired: true, convertedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[demos/[sessionId]] DELETE:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
