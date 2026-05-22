import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  await requireAdmin()

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status") ?? ""
  const source = searchParams.get("source") ?? ""
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = 20
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (source) where.source = source

  const [events, total] = await Promise.all([
    db.webhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    db.webhookEvent.count({ where }),
  ])

  // Status summary counts
  const statusCounts = await Promise.all(
    ["PENDING", "PROCESSED", "FAILED", "DEAD"].map(async (s) => ({
      status: s,
      count: await db.webhookEvent.count({ where: { status: s as "PENDING" | "PROCESSED" | "FAILED" | "DEAD" } }),
    }))
  )

  return NextResponse.json({
    events: events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      lastAttemptAt: e.lastAttemptAt?.toISOString() ?? null,
      processedAt: e.processedAt?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
    statusCounts,
  })
}
