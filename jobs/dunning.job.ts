import { Worker, Job } from "bullmq"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { SubStatus } from "@prisma/client"
import { emailQueue, notifQueue } from "@/lib/queue"
import { createNotification } from "@/lib/notifications"

const connection = { url: env.REDIS_URL }

/**
 * Dunning schedule — progressive failure recovery sequence.
 * Each step is triggered by a delayed BullMQ job.
 *
 * Day 1  → Retry payment + notify user
 * Day 3  → Retry payment + notify user
 * Day 7  → Retry payment + offer 10% discount + notify
 * Day 14 → Suspend access (PAST_DUE → keep, but block features via status check)
 * Day 28 → Cancel subscription permanently
 */
const DUNNING_STEPS = [
  { day: 1,  action: "retry_and_notify",  offerDiscount: false },
  { day: 3,  action: "retry_and_notify",  offerDiscount: false },
  { day: 7,  action: "retry_and_notify",  offerDiscount: true  },
  { day: 14, action: "suspend_access",    offerDiscount: false },
  { day: 28, action: "cancel_subscription", offerDiscount: false },
] as const

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ── Dunning job processor ─────────────────────────────────────────────────────
export const dunningWorker = new Worker(
  "notifications",
  async (job: Job) => {
    if (job.name !== "dunning.start" && job.name !== "dunning.step") return

    const { subscriptionId, userId, step = 0 } = job.data as {
      subscriptionId: string
      userId: string
      step?: number
    }

    if (step >= DUNNING_STEPS.length) {
      logger.info({ subscriptionId }, "Dunning sequence complete")
      return
    }

    const current = DUNNING_STEPS[step]
    logger.info({ subscriptionId, step, action: current.action }, "Processing dunning step")

    // Re-fetch subscription to check current status (may have recovered)
    const sub = await db.subscription.findUnique({ where: { id: subscriptionId } })
    if (!sub) {
      logger.info({ subscriptionId }, "Dunning: subscription not found — aborting")
      return
    }

    // If subscription recovered (user paid manually or via Stripe retry), stop dunning
    if (sub.status === SubStatus.ACTIVE) {
      logger.info({ subscriptionId }, "Dunning: subscription recovered — stopping")
      return
    }

    if (sub.status === SubStatus.CANCELLED) {
      logger.info({ subscriptionId }, "Dunning: already cancelled — stopping")
      return
    }

    switch (current.action) {
      case "retry_and_notify": {
        // Send payment failure notification + retry CTA
        await createNotification({
          userId,
          type: "PAYMENT",
          title: "Action Required: Payment Failed",
          body: current.offerDiscount
            ? "We've tried to charge your card again. Update your payment method to get 10% off your next cycle."
            : "We couldn't process your payment. Please update your billing info to keep your subscription active.",
          actionUrl: "/dashboard/subscriptions",
        })

        await emailQueue.add("send.payment-failed", {
          userId,
          subscriptionId,
          attemptNumber: step + 1,
          offerDiscount: current.offerDiscount,
        })
        break
      }

      case "suspend_access": {
        // Keep PAST_DUE status — application logic gates features by status check
        await createNotification({
          userId,
          type: "SUBSCRIPTION",
          title: "Access Suspended",
          body: "Your subscription is past due and access has been suspended. Update your payment method to restore access.",
          actionUrl: "/dashboard/subscriptions",
        })

        await emailQueue.add("send.access-suspended", { userId, subscriptionId })
        break
      }

      case "cancel_subscription": {
        await db.subscription.update({
          where: { id: subscriptionId },
          data: { status: SubStatus.CANCELLED, cancelledAt: new Date() },
        })

        await createNotification({
          userId,
          type: "SUBSCRIPTION",
          title: "Subscription Cancelled",
          body: "Your subscription has been cancelled due to non-payment. You can re-subscribe at any time.",
          actionUrl: "/marketplace",
        })

        await emailQueue.add("send.subscription-cancelled", { userId, subscriptionId })

        logger.info({ subscriptionId }, "Dunning: subscription cancelled after 28 days")
        return // No more steps after cancellation
      }
    }

    // Queue the next dunning step
    const nextStep = step + 1
    if (nextStep < DUNNING_STEPS.length) {
      const daysUntilNext = DUNNING_STEPS[nextStep].day - current.day
      await notifQueue.add(
        "dunning.step",
        { subscriptionId, userId, step: nextStep },
        { delay: daysUntilNext * MS_PER_DAY }
      )
      logger.info(
        { subscriptionId, nextStep, delayDays: daysUntilNext },
        "Dunning: next step scheduled"
      )
    }
  },
  { connection }
)

dunningWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id, jobName: job?.name }, "Dunning job failed")
})

logger.info("✅ Dunning worker initialized")
