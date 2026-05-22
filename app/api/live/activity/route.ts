import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACTIVITY_ZSET = "platform:activity"

/**
 * SSE endpoint: GET /api/live/activity
 *
 * Phase 7 — Real-Time Infrastructure
 *
 * On connect:
 *   1. Reads the last 10 entries from Redis ZSET `platform:activity` (populated by event-bus.ts emitEvent)
 *   2. Sends them as initial seed events
 *   3. Keeps connection alive with 25s heartbeat comments
 *   4. Auto-closes after 5 minutes (clients auto-reconnect via EventSource)
 *
 * The ActivityFeed component subscribes here and appends incoming messages to the feed.
 */
export async function GET() {
  const encoder = new TextEncoder()

  // Fetch last 10 activity entries from Redis ZSET
  let initialEvents: string[] = []
  if (redis) {
    try {
      // Get 10 most recent entries (highest score = most recent timestamp)
      // Upstash: zrange(key, start, stop, { rev: true }) = ZREVRANGE
      const raw = await redis.zrange(ACTIVITY_ZSET, 0, 9, { rev: true }) as string[]
      initialEvents = raw.slice().reverse() // reverse to oldest-first for chronological display
    } catch {
      // Redis unavailable — gracefully degrade to empty feed
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Client disconnected
        }
      }

      // 1. Send connected event
      send({ type: "connected", message: "Live activity stream connected" })

      // 2. Send seed events from Redis
      for (const raw of initialEvents) {
        try {
          const parsed = JSON.parse(raw)
          send({
            type: "activity",
            message: parsed.message || "Platform activity",
            eventType: parsed.type,
            timestamp: parsed.timestamp,
          })
        } catch {
          // Skip malformed entries
        }
      }

      // 3. Heartbeat every 25s (keeps the connection alive through proxies)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 25_000)

      // 4. Auto-close after 5 minutes (EventSource reconnects automatically)
      const cleanup = () => {
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      }
      setTimeout(cleanup, 300_000)
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
