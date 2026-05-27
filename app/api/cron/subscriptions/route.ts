import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"
import { expireOverdueSubscriptions } from "@/lib/services/subscription-service"
import { scheduleRecurringJobs } from "@/lib/workers"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret")
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await expireOverdueSubscriptions()
  if (env.REDIS_URL) await scheduleRecurringJobs()

  return NextResponse.json({ success: true, ...result })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
