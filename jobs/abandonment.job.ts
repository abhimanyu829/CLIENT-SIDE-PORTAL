import { Worker, Job } from "bullmq"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { emailQueue } from "@/lib/queue"
import { createNotification } from "@/lib/notifications"

const connection = { url: env.REDIS_URL }

/**
 * Cart Abandonment Recovery Sequence
 *
 * Triggered when a user adds items to their cart but doesn't complete checkout
 * within the grace period. The job is queued from POST /api/cart/abandon.
 *
 * Step 0 → 30 min:  Gentle reminder email + push notification
 * Step 1 → 2 hr:    Second reminder with social proof (reviews/testimonials)
 * Step 2 → 24 hr:   Discount offer (10% off, time-limited coupon)
 * Step 3 → 48 hr:   AI-generated personalized win-back message
 * Step 4 → 72 hr:   Final "cart expiring" warning → clear cart
 */

const STEPS = [
  { label: "gentle_reminder",   delayMs: 30 * 60 * 1000 },
  { label: "social_proof",      delayMs: (2 * 60 - 30) * 60 * 1000 },
  { label: "discount_offer",    delayMs: (24 - 2) * 60 * 60 * 1000 },
  { label: "ai_winback",        delayMs: (48 - 24) * 60 * 60 * 1000 },
  { label: "final_warning",     delayMs: (72 - 48) * 60 * 60 * 1000 },
] as const

type StepLabel = (typeof STEPS)[number]["label"]

export const abandonmentWorker = new Worker(
  "notifications",
  async (job: Job) => {
    if (job.name !== "abandon.start" && job.name !== "abandon.step") return

    const { userId, cartItems, step = 0 } = job.data as {
      userId: string
      cartItems: Array<{ tierId: string; productId: string; productName: string; price: number }>
      step?: number
    }

    if (step >= STEPS.length) return

    // Check if user has since subscribed — stop if so
    const hasPurchased = await db.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
    })
    if (hasPurchased) {
      logger.info({ userId }, "Abandonment: user converted — stopping sequence")
      return
    }

    const { label } = STEPS[step]
    const productNames = cartItems.map((i) => i.productName).join(", ")

    logger.info({ userId, step, label }, "Processing abandonment step")

    switch (label as StepLabel) {
      case "gentle_reminder": {
        await emailQueue.add("send.cart-abandon", {
          userId,
          subject: "You left something behind 👀",
          template: "cart_reminder",
          data: { cartItems, step: 0 },
        })
        await createNotification({
          userId,
          type: "SYSTEM",
          title: "Your cart is waiting",
          body: `You left ${productNames} in your cart. Complete your purchase before it's gone.`,
          actionUrl: "/marketplace",
        })
        break
      }

      case "social_proof": {
        // Fetch top reviews for cart products
        const productIds = cartItems.map((i) => i.productId)
        const topReviews = await db.productReview.findMany({
          where: { productId: { in: productIds }, status: "APPROVED", rating: { gte: 4 } },
          take: 3,
          orderBy: { rating: "desc" },
          include: { user: { select: { name: true } } },
        })

        await emailQueue.add("send.cart-abandon", {
          userId,
          subject: "See what others are saying 💬",
          template: "cart_social_proof",
          data: { cartItems, reviews: topReviews, step: 1 },
        })
        break
      }

      case "discount_offer": {
        // Generate a single-use 10% coupon for this user
        const { nanoid } = await import("nanoid")
        const couponCode = `WINBACK-${nanoid(8).toUpperCase()}`

        await db.coupon.create({
          data: {
            code: couponCode,
            type: "PERCENTAGE",
            discountValue: 10,
            maxUses: 1,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // expires in 48hr
            applicableTierIds: cartItems.map((i) => i.tierId),
            isActive: true,
          },
        })

        await emailQueue.add("send.cart-abandon", {
          userId,
          subject: "Here's 10% off — just for you 🎁",
          template: "cart_discount",
          data: { cartItems, couponCode, expiresIn: "48 hours", step: 2 },
        })
        await createNotification({
          userId,
          type: "PAYMENT",
          title: "Special offer: 10% off your cart",
          body: `Use code ${couponCode} at checkout. Expires in 48 hours.`,
          actionUrl: "/marketplace",
          metadata: { couponCode },
        })
        break
      }

      case "ai_winback": {
        // AI-personalized message (enqueue to AI queue)
        const { aiQueue } = await import("@/lib/queue")
        await aiQueue.add("generate.winback", { userId, cartItems })
        break
      }

      case "final_warning": {
        await emailQueue.add("send.cart-abandon", {
          userId,
          subject: "⚠️ Your cart expires in 24 hours",
          template: "cart_expiring",
          data: { cartItems, step: 4 },
        })
        await createNotification({
          userId,
          type: "SYSTEM",
          title: "Cart expiring soon",
          body: "Your saved cart expires in 24 hours. Complete checkout now.",
          actionUrl: "/marketplace",
        })
        break
      }
    }

    // Schedule the next step
    const nextStep = step + 1
    if (nextStep < STEPS.length) {
      const { notifQueue } = await import("@/lib/queue")
      await notifQueue.add(
        "abandon.step",
        { userId, cartItems, step: nextStep },
        { delay: STEPS[nextStep].delayMs }
      )
    }
  },
  { connection }
)

abandonmentWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Cart abandonment job failed")
})

logger.info("✅ Cart abandonment worker initialized")
