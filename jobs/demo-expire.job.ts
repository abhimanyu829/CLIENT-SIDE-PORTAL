import { Worker } from "bullmq"
import { db } from "@/lib/db"
import { redis } from "@/lib/redis"

/**
 * Demo Expire Job
 * Runs periodically to mark expired demo sessions in the database.
 * Triggered by the demo queue or run as a standalone cron worker.
 */
export function startDemoExpireWorker() {
  if (!redis) {
    console.warn("[demo-expire.job] Redis not available — worker not started.")
    return null
  }

  const worker = new Worker(
    "demo",
    async (job) => {
      if (job.name !== "expire-demos") return

      const now = new Date()

      const expired = await db.demoSession.updateMany({
        where: {
          isExpired: false,
          expiresAt: { lt: now },
        },
        data: { isExpired: true },
      })

      console.log(`[demo-expire.job] Marked ${expired.count} demo sessions as expired.`)

      return { expired: expired.count }
    },
    {
      connection: {
        url: process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_REST_URL,
      },
      concurrency: 1,
    }
  )

  worker.on("completed", (job, result) => {
    console.log(`[demo-expire.job] Job ${job.id} completed:`, result)
  })

  worker.on("failed", (job, err) => {
    console.error(`[demo-expire.job] Job ${job?.id} failed:`, err.message)
  })

  return worker
}
