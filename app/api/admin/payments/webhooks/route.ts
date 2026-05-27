import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

/**
 * GET /api/admin/payments/webhooks
 * 
 * Admin endpoint to inspect webhook event logs.
 * Supports filtering by source, status, and event type.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()

  const url = req.nextUrl
  const source = url.searchParams.get("source") ?? ""
  const status = url.searchParams.get("status") ?? ""
  const eventType = url.searchParams.get("eventType") ?? ""
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1))
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)))
  const skip = (page - 1) * limit

  const where: any = {}
  if (source) where.source = source
  if (status) where.status = status
  if (eventType) where.eventType = { contains: eventType, mode: "insensitive" }

  const [events, total] = await Promise.all([
    db.webhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    db.webhookEvent.count({ where }),
  ])

  const formatted = events.map((e) => ({
    ...e,
    payload: JSON.stringify(e.payload).slice(0, 500) + "...",
  }))

  return NextResponse.json({
    success: true,
    data: { events: formatted, total, page, limit },
  })
}