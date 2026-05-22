import { Prisma, BillingInterval, FulfillmentType, MetricEventType, OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"

const PLATFORM_COMMISSION_RATE = 0.15

function money(value: number) {
  return new Prisma.Decimal(value.toFixed(2))
}

function orderNumber() {
  return `NX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

function intervalEnd(interval: BillingInterval) {
  const end = new Date()
  if (interval === BillingInterval.YEARLY) end.setFullYear(end.getFullYear() + 1)
  else if (interval === BillingInterval.WEEKLY) end.setDate(end.getDate() + 7)
  else end.setMonth(end.getMonth() + 1)
  return end
}

function isRecurring(interval: BillingInterval) {
  return interval !== BillingInterval.ONE_TIME && interval !== BillingInterval.LIFETIME
}

export async function getEnterpriseCommandCenter() {
  const [
    vendors,
    pendingVendors,
    products,
    orders,
    revenue,
    openServices,
    liveAgents,
    carts,
    aiUsage,
    recentOrders,
    topVendors,
    liveEvents,
  ] = await Promise.all([
    db.vendorProfile.count(),
    db.vendorProfile.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "PUBLISHED" } }),
    db.order.count(),
    db.order.aggregate({ where: { status: { in: [OrderStatus.PAID, OrderStatus.FULFILLED] } }, _sum: { grandTotal: true, platformFee: true, vendorNetTotal: true } }),
    db.serviceEngagement.count({ where: { status: { in: ["PROPOSED", "ACCEPTED", "ACTIVE", "IN_REVIEW"] } } }),
    db.agentDeployment.count({ where: { status: "LIVE" } }),
    db.cart.count({ where: { status: "ACTIVE" } }),
    db.aIUsageLog.aggregate({ _sum: { totalTokens: true, costUsd: true }, _count: true }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } }, items: { take: 3 } },
    }),
    db.vendorProfile.findMany({
      orderBy: [{ totalRevenue: "desc" }, { sellerScore: "desc" }],
      take: 8,
      include: { _count: { select: { products: true, serviceEngagements: true } } },
    }),
    db.platformMetricEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: 12,
      include: { product: { select: { name: true, type: true } }, user: { select: { name: true } } },
    }),
  ])

  return {
    totals: {
      vendors,
      pendingVendors,
      publishedProducts: products,
      orders,
      activeCarts: carts,
      openServices,
      liveAgents,
      grossRevenue: Number(revenue._sum.grandTotal ?? 0),
      platformFees: Number(revenue._sum.platformFee ?? 0),
      vendorNetRevenue: Number(revenue._sum.vendorNetTotal ?? 0),
      aiTokens: aiUsage._sum.totalTokens ?? 0,
      aiCostUsd: Number(aiUsage._sum.costUsd ?? 0),
      aiRequests: aiUsage._count,
    },
    recentOrders,
    topVendors,
    liveEvents,
  }
}

export async function createOrUpdateVendorProfile(userId: string, data: {
  slug: string
  displayName: string
  type: string
  headline?: string
  description?: string
  websiteUrl?: string
  supportEmail?: string
}) {
  const vendor = await db.vendorProfile.upsert({
    where: { slug: data.slug },
    create: {
      userId,
      slug: data.slug,
      displayName: data.displayName,
      type: data.type as any,
      headline: data.headline,
      description: data.description,
      websiteUrl: data.websiteUrl,
      supportEmail: data.supportEmail,
      onboardingState: { completed: ["identity", "profile"], next: "verification" },
    },
    update: {
      displayName: data.displayName,
      type: data.type as any,
      headline: data.headline,
      description: data.description,
      websiteUrl: data.websiteUrl,
      supportEmail: data.supportEmail,
    },
  })

  await emitEvent({
    type: EVENTS.VENDOR_CREATED,
    timestamp: new Date().toISOString(),
    actorId: userId,
    payload: { vendorId: vendor.id, vendorName: vendor.displayName },
  })

  return vendor
}

export async function addMarketplaceItemToCart(input: {
  userId?: string
  sessionId?: string
  productId: string
  tierId?: string
  quantity?: number
  region?: string
}) {
  const quantity = Math.max(1, input.quantity ?? 1)
  const product = await db.product.findUniqueOrThrow({
    where: { id: input.productId },
    include: { tiers: { where: input.tierId ? { id: input.tierId } : { isActive: true }, orderBy: { price: "asc" }, take: 1 } },
  })
  const tier = product.tiers[0]
  const unitPrice = Number(tier?.discountPrice ?? tier?.price ?? 0)

  const cart = await db.$transaction(async (tx) => {
    const existing = await tx.cart.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          input.userId ? { userId: input.userId } : {},
          input.sessionId ? { sessionId: input.sessionId } : {},
        ],
      },
      include: { items: true },
    })

    const activeCart = existing ?? await tx.cart.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        region: input.region,
        currency: tier?.currency ?? "USD",
      },
      include: { items: true },
    })

    await tx.cartItem.upsert({
      where: { cartId_productId_tierId: { cartId: activeCart.id, productId: product.id, tierId: tier?.id ?? null } },
      create: {
        cartId: activeCart.id,
        productId: product.id,
        tierId: tier?.id,
        quantity,
        unitPrice: money(unitPrice),
        currency: tier?.currency ?? "USD",
        itemType: product.type,
        vendorId: product.vendorId,
        metadata: { source: "marketplace" },
      },
      update: { quantity: { increment: quantity }, unitPrice: money(unitPrice), vendorId: product.vendorId },
    })

    const items = await tx.cartItem.findMany({ where: { cartId: activeCart.id } })
    const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0)
    const tax = subtotal * 0.0
    return tx.cart.update({
      where: { id: activeCart.id },
      data: { subtotal: money(subtotal), taxTotal: money(tax), grandTotal: money(subtotal + tax) },
      include: { items: { include: { product: true, tier: true } } },
    })
  })

  await emitEvent({
    type: EVENTS.CART_UPDATED,
    timestamp: new Date().toISOString(),
    actorId: input.userId,
    payload: { cartId: cart.id, productId: product.id, productName: product.name },
  })

  return cart
}

export async function createOrderFromActiveCart(input: {
  userId: string
  gateway: PaymentGateway
  couponCode?: string
  affiliateCode?: string
  referralCode?: string
}) {
  const order = await db.$transaction(async (tx) => {
    const cart = await tx.cart.findFirstOrThrow({
      where: { userId: input.userId, status: "ACTIVE" },
      include: { items: { include: { product: true, tier: true } } },
    })

    const subtotal = cart.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0)
    const platformFee = subtotal * PLATFORM_COMMISSION_RATE
    const vendorNetTotal = subtotal - platformFee

    const created = await tx.order.create({
      data: {
        orderNumber: orderNumber(),
        userId: input.userId,
        cartId: cart.id,
        status: OrderStatus.PENDING,
        gateway: input.gateway,
        currency: cart.currency,
        region: cart.region,
        subtotal: money(subtotal),
        taxTotal: cart.taxTotal,
        discountTotal: cart.discountTotal,
        platformFee: money(platformFee),
        vendorNetTotal: money(vendorNetTotal),
        grandTotal: money(subtotal + Number(cart.taxTotal) - Number(cart.discountTotal)),
        couponCode: input.couponCode ?? cart.couponCode,
        affiliateCode: input.affiliateCode,
        referralCode: input.referralCode,
        fulfillmentPlan: {
          hosted: cart.items.filter((item) => item.tier?.fulfillmentType === FulfillmentType.HOSTED).length,
          downloads: cart.items.filter((item) => item.tier?.fulfillmentType === FulfillmentType.DOWNLOAD).length,
          services: cart.items.filter((item) => item.tier?.fulfillmentType === FulfillmentType.SERVICE_DELIVERY).length,
        },
        items: {
          create: cart.items.map((item) => {
            const lineTotal = Number(item.unitPrice) * item.quantity
            const itemPlatformFee = lineTotal * PLATFORM_COMMISSION_RATE
            return {
              productId: item.productId,
              tierId: item.tierId,
              vendorId: item.vendorId,
              name: item.product.name,
              itemType: item.itemType,
              fulfillmentType: item.tier?.fulfillmentType ?? FulfillmentType.HOSTED,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              currency: item.currency,
              platformFee: money(itemPlatformFee),
              vendorNetAmount: money(lineTotal - itemPlatformFee),
              entitlementConfig: item.tier?.entitlementRules ?? {},
            }
          }),
        },
      },
      include: { items: true },
    })

    await tx.cart.update({ where: { id: cart.id }, data: { status: "CONVERTED", convertedAt: new Date() } })
    await tx.platformMetricEvent.create({
      data: {
        type: MetricEventType.CHECKOUT_STARTED,
        userId: input.userId,
        orderId: created.id,
        value: created.grandTotal,
        metadata: { orderNumber: created.orderNumber, gateway: input.gateway },
      },
    })

    return created
  })

  await emitEvent({
    type: EVENTS.ORDER_CREATED,
    timestamp: new Date().toISOString(),
    actorId: input.userId,
    payload: { orderId: order.id, orderNumber: order.orderNumber, amount: Number(order.grandTotal) },
  })

  return order
}

export async function markOrderPaid(orderId: string, gatewayPaymentId?: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { tier: true, product: true } }, user: true } })

  const result = await db.$transaction(async (tx) => {
    const paidOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID, paidAt: new Date() },
    })

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        amount: order.grandTotal,
        currency: order.currency,
        status: PaymentStatus.SUCCESS,
        gateway: order.gateway ?? PaymentGateway.MANUAL,
        gatewayPaymentId,
        paidAt: new Date(),
      },
    })

    await tx.invoice.create({
      data: {
        paymentId: payment.id,
        orderId: order.id,
        userId: order.userId,
        number: `INV-${order.orderNumber}`,
        totalAmount: order.grandTotal,
        taxAmount: order.taxTotal,
        currency: order.currency,
        status: "PAID",
        lineItems: order.items.map((item) => ({ name: item.name, quantity: item.quantity, price: String(item.unitPrice) })),
      },
    })

    for (const item of order.items) {
      let subscriptionId: string | undefined
      if (item.tier && isRecurring(item.tier.interval)) {
        const subscription = await tx.subscription.create({
          data: {
            userId: order.userId,
            productId: item.productId,
            tierId: item.tier.id,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: intervalEnd(item.tier.interval),
          },
        })
        subscriptionId = subscription.id
      }

      await tx.customerEntitlement.create({
        data: {
          userId: order.userId,
          productId: item.productId,
          orderId: order.id,
          subscriptionId,
          accessType: item.fulfillmentType,
          quota: item.tier?.aiQuota ?? {},
          metadata: { orderNumber: order.orderNumber, tierId: item.tierId },
        },
      })

      if (item.vendorId) {
        await tx.vendorProfile.update({
          where: { id: item.vendorId },
          data: {
            totalSales: { increment: item.quantity },
            totalRevenue: { increment: item.vendorNetAmount },
          },
        })
      }
    }

    await tx.notification.create({
      data: {
        userId: order.userId,
        type: "ORDER",
        title: "Your NexusAI order is active",
        body: `${order.orderNumber} has been paid and your entitlements are ready.`,
        actionUrl: "/dashboard/subscriptions",
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
      },
    })

    await tx.platformMetricEvent.create({
      data: {
        type: MetricEventType.PURCHASE,
        userId: order.userId,
        orderId: order.id,
        value: order.grandTotal,
        metadata: { orderNumber: order.orderNumber },
      },
    })

    return paidOrder
  })

  await emitEvent({
    type: EVENTS.ORDER_PAID,
    timestamp: new Date().toISOString(),
    actorId: order.userId,
    payload: { orderId: order.id, orderNumber: order.orderNumber, amount: Number(order.grandTotal) },
  })

  return result
}
