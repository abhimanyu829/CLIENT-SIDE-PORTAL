import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { redis } from "@/lib/redis"

export async function GET() {
  const health: Record<string, string | boolean> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  }

  try {
    await db.$queryRaw`SELECT 1`
    health.database = "ok"

    if (redis) {
      await redis.ping()
      health.redis = "ok"
    } else {
      health.redis = "not configured"
    }

    return NextResponse.json(health, { status: 200 })
  } catch (error: any) {
    health.status = "error"
    health.error = error.message
    return NextResponse.json(health, { status: 503 })
  }
}
