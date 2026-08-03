import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { addTimelineEvent, TIMELINE } from "@/lib/services/service-lifecycle-service"

// ── Renewal reminders (cron) ─────────────────────────────────────────────────
// Reminds customers 7 / 3 / 1 days before expiryDate. Never deletes data.

const REMINDER_WINDOWS_DAYS = [7, 3, 1]

export async function sendRenewalReminders() {
  const now = new Date()
  let sent = 0

  for (const days of REMINDER_WINDOWS_DAYS) {
    const windowStart = new Date(now.getTime() + (days - 1) * 86400000)
    const windowEnd = new Date(now.getTime() + days * 86400000)

    const services = await db.purchasedService.findMany({
      where: {
        status: "ACTIVE",
        expiryDate: { gt: windowStart, lte: windowEnd },
        OR: [{ renewalReminderSentAt: null }, { renewalReminderSentAt: { lt: windowStart } }],
      },
      include: { orderItem: { select: { name: true } } },
    })

    for (const service of services) {
      const expiry = service.expiryDate!
      await db.purchasedService.update({
        where: { id: service.id },
        data: { renewalReminderSentAt: now },
      })
      await addTimelineEvent(service.id, TIMELINE.RENEWAL_REMINDER, `Renewal reminder sent (${days}d before expiry)`, { daysLeft: days })
      await createNotification({
        userId: service.userId,
        title: "Subscription expiring soon",
        body: `${service.orderItem.name} expires in ${days} day${days === 1 ? "" : "s"}. Renew to keep your service running.`,
        type: "SUBSCRIPTION",
        actionUrl: `/dashboard/services/${service.id}`,
      }).catch(() => {})
      emailQueue
        .add(EMAIL_JOBS.SEND_RENEWAL_REMINDER, {
          userId: service.userId,
          serviceName: service.orderItem.name,
          purchasedServiceId: service.id,
          daysLeft: days,
          expiryDate: expiry.toISOString(),
        })
        .catch(() => {})
      sent++
    }
  }

  return sent
}

/// Customer-initiated renewal record: keeps the service workspace alive while
/// payment goes through the existing order/checkout pipeline.
export async function markRenewalRequested(purchasedServiceId: string, userId: string) {
  await addTimelineEvent(purchasedServiceId, TIMELINE.RENEWAL_REQUESTED, "Renewal checkout initiated", {}, userId)
}
