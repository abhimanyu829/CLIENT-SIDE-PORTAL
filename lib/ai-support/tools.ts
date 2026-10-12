import { db } from "@/lib/db"

export async function getProductDetails(slug: string) {
  const p = await db.product.findUnique({ where: { slug }, select: { name: true, description: true, status: true, type: true } })
  return p
}

export async function getPlanDetails(slug: string) {
  const p = await db.subscriptionPlan.findUnique({ where: { slug }, select: { name: true, price: true, billingCycle: true, status: true } })
  return p
}

export async function getOrderStatus(orderId: string, userId: string) {
  const o = await db.order.findFirst({ where: { id: orderId, userId }, select: { id: true, status: true, grandTotal: true } })
  return o
}

export async function getSubscriptionStatus(userId: string) {
  const s = await db.userSubscription.findMany({ where: { userId }, select: { id: true, status: true, planId: true } })
  return s
}

export async function getTicketStatus(ticketId: string, userId: string) {
  const t = await db.ticket.findFirst({ where: { id: ticketId, clientId: userId }, select: { id: true, status: true, title: true } })
  return t
}

export async function createSupportTicket(userId: string | null, data: { title: string; description: string; category?: string; priority?: string }) {
  if (!userId) throw new Error("Authentication required to create ticket")
  const ticket = await db.ticket.create({
    data: {
      clientId: userId,
      title: data.title.slice(0, 300),
      description: data.description.slice(0, 20000),
      category: data.category?.slice(0, 50) ?? "general",
      priority: (data.priority as never) ?? "MEDIUM",
      status: "OPEN",
    },
  })
  // Notify admins via Notification
  await db.notification.create({
    data: { userId, type: "TICKET", title: `New ticket ${ticket.id}`, body: ticket.title },
  }).catch(() => {})
  return ticket
}
