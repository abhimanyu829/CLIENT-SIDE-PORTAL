import { Worker, Job } from "bullmq"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { CampaignStatus } from "@prisma/client"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

const connection = { url: env.REDIS_URL }

/**
 * Campaign Scheduler Job
 *
 * Runs on a cron schedule and:
 *  - Activates campaigns whose `startsAt` is now (or past) and status = SCHEDULED
 *  - Deactivates campaigns whose `endsAt` has passed and status = ACTIVE
 *
 * Uses CampaignStatus enum (not deprecated isActive boolean).
 *
 * BullMQ cron is set up in the worker entry-point. This file exports the worker.
 * Cron schedule: every 5 minutes
 */
export const campaignWorker = new Worker(
  "notifications",
  async (job: Job) => {
    if (job.name !== "campaign.sync") return

    const now = new Date()

    // Activate eligible campaigns (SCHEDULED → ACTIVE)
    const toActivate = await db.campaign.findMany({
      where: {
        status: { in: [CampaignStatus.SCHEDULED, CampaignStatus.DRAFT] },
        isActive: false,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    })

    if (toActivate.length > 0) {
      await db.campaign.updateMany({
        where: { id: { in: toActivate.map((c) => c.id) } },
        data: { status: CampaignStatus.ACTIVE, isActive: true },
      })

      // Emit event for each activated campaign (triggers activity feed + cache bust)
      for (const c of toActivate) {
        await emitEvent({
          type: EVENTS.CAMPAIGN_STARTED,
          timestamp: now.toISOString(),
          payload: { campaignId: c.id, campaignName: c.name },
        }).catch(() => {})
      }

      logger.info({ count: toActivate.length, ids: toActivate.map((c) => c.id) }, "Campaigns activated")
    }

    // Deactivate expired campaigns (ACTIVE → ENDED)
    const toDeactivate = await db.campaign.findMany({
      where: {
        status: CampaignStatus.ACTIVE,
        endsAt: { lte: now },
      },
    })

    if (toDeactivate.length > 0) {
      await db.campaign.updateMany({
        where: { id: { in: toDeactivate.map((c) => c.id) } },
        data: { status: CampaignStatus.ENDED, isActive: false },
      })

      // Emit stop events
      for (const c of toDeactivate) {
        await emitEvent({
          type: EVENTS.CAMPAIGN_STOPPED,
          timestamp: now.toISOString(),
          payload: { campaignId: c.id, campaignName: c.name },
        }).catch(() => {})
      }

      logger.info({ count: toDeactivate.length, ids: toDeactivate.map((c) => c.id) }, "Campaigns deactivated")
    }

    logger.info({ activated: toActivate.length, deactivated: toDeactivate.length }, "Campaign sync complete")
  },
  { connection }
)

campaignWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Campaign sync job failed")
})

/**
 * Schedule the recurring campaign sync job.
 * Call this once at worker startup.
 */
export async function scheduleCampaignSync() {
  const { notifQueue } = await import("@/lib/queue")

  // Remove any existing repeatable job to avoid duplicates on restart
  await notifQueue.removeRepeatable("campaign.sync", {
    every: 5 * 60 * 1000, // every 5 minutes
  })

  await notifQueue.add(
    "campaign.sync",
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: "campaign-sync-cron",
    }
  )

  logger.info("✅ Campaign sync cron scheduled (every 5 minutes)")
}

logger.info("✅ Campaign worker initialized")
