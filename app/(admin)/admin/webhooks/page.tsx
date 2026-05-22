import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import WebhooksClient from "./WebhooksClient"

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>
}) {
  const admin = await requireAdmin()

  const params = await searchParams
  const status = params?.status ?? ""
  const source = params?.source ?? ""
  const page = Math.max(1, Number(params?.page ?? 1))
  const limit = 20
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (source) where.source = source

  // Guard against missing WebhookEvent table pre-migration
  let events: any[] = []
  let total = 0
  let statusCounts: { status: string; count: number }[] = []
  let dlqEvents: any[] = []

  try {
    ;[events, total] = await Promise.all([
      db.webhookEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      db.webhookEvent.count({ where }),
    ])

    statusCounts = await Promise.all(
      ["PENDING", "PROCESSED", "FAILED", "DEAD"].map(async (s) => ({
        status: s,
        count: await db.webhookEvent.count({
          where: { status: s as "PENDING" | "PROCESSED" | "FAILED" | "DEAD" },
        }),
      }))
    )

    dlqEvents = await db.webhookEvent.findMany({
      where: { status: "DEAD" },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  } catch {
    // WebhookEvent table not yet created in DB — run prisma db push to fix
    statusCounts = ["PENDING", "PROCESSED", "FAILED", "DEAD"].map((s) => ({ status: s, count: 0 }))
  }

  return (
    <WebhooksClient
      events={events.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        lastAttemptAt: e.lastAttemptAt?.toISOString() ?? null,
        processedAt: e.processedAt?.toISOString() ?? null,
        payload: e.payload as object,
      }))}
      total={total}
      page={page}
      limit={limit}
      activeStatus={status}
      activeSource={source}
      statusCounts={statusCounts}
      dlqEvents={dlqEvents.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        lastAttemptAt: e.lastAttemptAt?.toISOString() ?? null,
        processedAt: e.processedAt?.toISOString() ?? null,
        payload: e.payload as object,
      }))}
      isSuperAdmin={admin.isSuperAdmin}
    />
  )
}
