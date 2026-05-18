/**
 * BullMQ Worker Entry-point
 * Imports all job workers so they register their processors with the queues.
 * Run: node --loader tsx jobs/worker.ts
 */
import "@/jobs/invoice.job"
import "@/jobs/email.job"
import "@/jobs/dunning.job"
import "@/jobs/abandonment.job"
import { scheduleCampaignSync } from "@/jobs/campaign.job"
import { logger } from "@/lib/logger"

async function main() {
  logger.info("🚀 BullMQ worker started — listening for jobs")

  // Start campaign auto-activate/deactivate cron
  await scheduleCampaignSync()

  logger.info("✅ All workers and crons registered")
}

main().catch((err) => {
  logger.error({ err }, "Worker startup failed")
  process.exit(1)
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — shutting down workers")
  process.exit(0)
})

process.on("SIGINT", async () => {
  logger.info("SIGINT received — shutting down workers")
  process.exit(0)
})
