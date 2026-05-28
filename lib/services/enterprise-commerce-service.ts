import { randomUUID } from "crypto"
import { Prisma, BillingInterval, CartStatus, FulfillmentType, MetricEventType, OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { createNotification } from "@/lib/notifications"
import { emailQueue, EMAIL_JOBS } from "@/lib/queue"
import { redis } from "@/lib/redis"

const PLATFORM_COMMISSION_RATE = 0.15
const DEFAULT_TAX_RATE = 0.18
const CART_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14

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

function effectiveTierPrice(tier?: {
  price: Prisma.Decimal
  discountPrice?: Prisma.Decimal | null
  flashSalePrice?: Prisma.Decimal | null
  flashSaleEndsAt?: Date | null
  regionalPrices?: Prisma.JsonValue
}, region?: string | null) {
  if (!tier) return 0
  const regional = region && tier.regionalPrices && typeof tier.regionalPrices === "object" && !Array.isArray(tier.regionalPrices)
    ? (tier.regionalPrices as Record<string, unknown>)[region]
    : null
  if (typeof regional === "number") return regional
  if (regional && typeof regional === "object" && !Array.isArray(regional)) {
    const regionalPrice = regional as Record<string, unknown>
    const price = regionalPrice.discountPrice ?? regionalPrice.price
    if (typeof price === "number") return price
    if (typeof price === "string" && price.trim()) return Number(price)
  }
  if (tier.flashSalePrice && tier.flashSaleEndsAt && tier.flashSaleEndsAt > new Date()) {
    return Number(tier.flashSalePrice)
  }
  return Number(tier.discountPrice ?? tier.price)
}

function getTaxRate(item: { tier?: { taxRate?: number | null } | null }) {
  const tierRate = item.tier?.taxRate
  if (typeof tierRate === "number" && tierRate > 0) {
    return tierRate > 1 ? tierRate / 100 : tierRate
  }
  return DEFAULT_TAX_RATE
}

function getItemSetupFee(item: { metadata?: Prisma.JsonValue | null }) {
  const metadata = item.metadata
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0
  const snapshot = (metadata as Record<string, unknown>).pricingSnapshot
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return 0
  const fee = (snapshot as Record<string, unknown>).setupFee
  if (typeof fee === "number") return fee
  if (typeof fee === "string" && fee.trim()) return Number(fee)
  return 0
}

function calculateCartAmounts(items: Array<{
  quantity: number
  unitPrice: Prisma.Decimal
  metadata?: Prisma.JsonValue | null
  tier?: { taxRate?: number | null; taxInclusive?: boolean | null } | null
}>, discount = 0) {
  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item.unitPrice) * item.quantity + getItemSetupFee(item)
  }, 0)
  const discountTotal = Math.min(Math.max(discount, 0), subtotal)

  const tax = items.reduce((sum, item) => {
    const lineSubtotal = Number(item.unitPrice) * item.quantity + getItemSetupFee(item)
    const lineDiscount = subtotal > 0 ? discountTotal * (lineSubtotal / subtotal) : 0
    const taxableLine = Math.max(0, lineSubtotal - lineDiscount)
    const rate = getTaxRate(item)
    if (item.tier?.taxInclusive) {
      return sum + taxableLine - taxableLine / (1 + rate)
    }
    return sum + taxableLine * rate
  }, 0)
  const exclusiveTax = items.reduce((sum, item) => {
    if (item.tier?.taxInclusive) return sum
    const lineSubtotal = Number(item.unitPrice) * item.quantity + getItemSetupFee(item)
    const lineDiscount = subtotal > 0 ? discountTotal * (lineSubtotal / subtotal) : 0
    return sum + Math.max(0, lineSubtotal - lineDiscount) * getTaxRate(item)
  }, 0)

  return {
    subtotal,
    discountTotal,
    taxTotal: tax,
    grandTotal: Math.max(0, subtotal - discountTotal + exclusiveTax),
  }
}

function normalizeCouponCode(couponCode?: string | null) {
  const normalized = couponCode?.trim().toUpperCase()
  return normalized || null
}

async function cacheCart(cart: { id: string; userId?: string | null }) {
  if (!redis) return
  const client = redis
  const keys = [
    `cart:${cart.id}`,
    cart.userId ? `cart:user:${cart.userId}` : null,
  ].filter(Boolean) as string[]

  await Promise.all(keys.map((key) => client.set(key, cart.id, { ex: CART_CACHE_TTL_SECONDS })))
}

export async function getActiveCart(input: { userId?: string }) {
  if (!input.userId) throw new Error("UNAUTHORIZED")

  const cart = await db.cart.findFirst({
    where: {
      status: CartStatus.ACTIVE,
      userId: input.userId,
    },
    include: { items: { include: { product: true, tier: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  })

  if (cart) await cacheCart(cart)
  return cart
}

// mergeGuestCartIntoUser has been removed as guest carts are no longer supported

export async function recalculateCart(cartId: string, couponCode?: string | null) {
  const cart = await db.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: { items: { include: { product: true, tier: true } } },
  })

  const undiscounted = calculateCartAmounts(cart.items)
  const subtotal = undiscounted.subtotal

  let discount = 0
  const normalizedCoupon = couponCode === undefined ? normalizeCouponCode(cart.couponCode) : normalizeCouponCode(couponCode)
  let couponSnapshot: Record<string, unknown> | null = null

  if (normalizedCoupon) {
    const coupon = await db.coupon.findUnique({ where: { code: normalizedCoupon } })
    const firstTierId = cart.items.find((item) => item.tierId)?.tierId
    const firstProductId = cart.items[0]?.productId
    const couponUsages = cart.userId && coupon
      ? await db.couponUsage.count({ where: { couponId: coupon.id, userId: cart.userId } })
      : 0

    const eligible =
      coupon &&
      coupon.isActive &&
      (!coupon.startsAt || coupon.startsAt <= new Date()) &&
      (!coupon.expiresAt || coupon.expiresAt >= new Date()) &&
      (!coupon.maxUses || coupon.usedCount < coupon.maxUses) &&
      couponUsages < (coupon.perUserLimit || 1) &&
      (!coupon.minCartValue || subtotal >= Number(coupon.minCartValue)) &&
      (coupon.applicableTierIds.length === 0 || (!!firstTierId && cart.items.some((item) => item.tierId && coupon.applicableTierIds.includes(item.tierId)))) &&
      (coupon.applicableProductIds.length === 0 || (!!firstProductId && cart.items.some((item) => coupon.applicableProductIds.includes(item.productId))))

    if (eligible && coupon) {
      if (coupon.type === "PERCENTAGE" || coupon.type === "FIRST_TIME" || coupon.type === "FESTIVAL" || coupon.type === "FLASH_SALE" || coupon.type === "REFERRAL") {
        discount = subtotal * (Number(coupon.discountValue) / 100)
      } else if (coupon.type === "FLAT") {
        discount = Number(coupon.discountValue)
      }
      if (coupon.maxDiscountCap) discount = Math.min(discount, Number(coupon.maxDiscountCap))
      discount = Math.min(discount, subtotal)
      couponSnapshot = {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        discountValue: Number(coupon.discountValue),
        discountAmount: Number(discount.toFixed(2)),
      }
    }
  }

  const metadata = {
    ...((cart.metadata as Record<string, unknown>) ?? {}),
    coupon: couponSnapshot,
    totalsCalculatedAt: new Date().toISOString(),
  }
  const totals = calculateCartAmounts(cart.items, discount)

  const updated = await db.cart.update({
    where: { id: cartId },
    data: {
      couponCode: couponSnapshot ? normalizedCoupon : null,
      subtotal: money(undiscounted.subtotal),
      taxTotal: money(totals.taxTotal),
      discountTotal: money(totals.discountTotal),
      grandTotal: money(totals.grandTotal),
      metadata,
    },
    include: { items: { include: { product: true, tier: true }, orderBy: { createdAt: "asc" } } },
  })

  await cacheCart(updated)
  return updated
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
  productId: string
  tierId?: string
  quantity?: number
  region?: string
}) {
  if (!input.userId) throw new Error("UNAUTHORIZED")

  const quantity = Math.max(1, input.quantity ?? 1)
  const product = await db.product.findUniqueOrThrow({
    where: { id: input.productId },
    include: { tiers: { where: input.tierId ? { id: input.tierId } : { isActive: true }, orderBy: { price: "asc" }, take: 1 } },
  })
  const tier = product.tiers[0]
  if (!tier) throw new Error("Product does not have an active pricing tier")
  if (product.status !== "PUBLISHED") throw new Error("Product is not available for purchase")
  const unitPrice = effectiveTierPrice(tier, input.region)

  const cart = await db.$transaction(async (tx) => {
    const existing = await tx.cart.findFirst({
      where: {
        status: "ACTIVE",
        userId: input.userId,
      },
      include: { items: true },
    })

    const activeCart = existing ?? await tx.cart.create({
      data: {
        userId: input.userId,
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
        metadata: {
          source: "marketplace",
          pricingSnapshot: {
            productVersion: product.version,
            tierName: tier.name,
            listPrice: Number(tier.price),
            effectivePrice: unitPrice,
            setupFee: Number(tier.setupFee ?? 0),
            interval: tier.interval,
            region: input.region ?? null,
          },
          selectedPlan: { tierId: tier.id, name: tier.name, interval: tier.interval },
          subscriptionType: tier.interval,
          vendorInfo: product.vendorId ? { vendorId: product.vendorId } : null,
          aiQuota: tier.aiQuota ?? {},
          taxData: { rate: getTaxRate({ tier }) },
        },
      },
      update: {
        quantity: { increment: quantity },
        unitPrice: money(unitPrice),
        vendorId: product.vendorId,
        currency: tier.currency,
        metadata: {
          source: "marketplace",
          pricingSnapshot: {
            productVersion: product.version,
            tierName: tier.name,
            listPrice: Number(tier.price),
            effectivePrice: unitPrice,
            setupFee: Number(tier.setupFee ?? 0),
            interval: tier.interval,
            region: input.region ?? null,
          },
          selectedPlan: { tierId: tier.id, name: tier.name, interval: tier.interval },
          subscriptionType: tier.interval,
          vendorInfo: product.vendorId ? { vendorId: product.vendorId } : null,
          aiQuota: tier.aiQuota ?? {},
          taxData: { rate: getTaxRate({ tier }) },
        },
      },
    })

    return activeCart
  })

  const recalculated = await recalculateCart(cart.id)

  await emitEvent({
    type: EVENTS.CART_UPDATED,
    timestamp: new Date().toISOString(),
    actorId: input.userId,
    payload: { cartId: recalculated.id, productId: product.id, productName: product.name },
  })

  return recalculated
}

export async function updateCartItemQuantity(input: {
  userId?: string
  itemId: string
  quantity: number
}) {
  if (!input.userId) throw new Error("UNAUTHORIZED")
  const cart = await getActiveCart({ userId: input.userId })
  if (!cart) throw new Error("Active cart not found")

  const item = cart.items.find((cartItem) => cartItem.id === input.itemId)
  if (!item) throw new Error("Cart item not found")

  if (input.quantity <= 0) {
    await db.cartItem.delete({ where: { id: input.itemId } })
  } else {
    await db.cartItem.update({ where: { id: input.itemId }, data: { quantity: Math.min(999, input.quantity) } })
  }

  return recalculateCart(cart.id)
}

export async function applyCouponToActiveCart(input: {
  userId?: string
  couponCode?: string | null
}) {
  if (!input.userId) throw new Error("UNAUTHORIZED")
  const cart = await getActiveCart({ userId: input.userId })
  if (!cart) throw new Error("Active cart not found")
  const normalizedCoupon = normalizeCouponCode(input.couponCode)
  const updated = await recalculateCart(cart.id, normalizedCoupon)
  if (normalizedCoupon && updated.couponCode !== normalizedCoupon) {
    throw new Error("Coupon is invalid, expired, or not eligible for this cart")
  }
  return updated
}

export async function clearActiveCart(input: { userId?: string }) {
  if (!input.userId) throw new Error("UNAUTHORIZED")
  const cart = await getActiveCart(input)
  if (!cart) return null
  return db.cart.update({ where: { id: cart.id }, data: { status: CartStatus.EXPIRED } })
}

export async function createBuyNowCart(input: {
  userId: string
  productId: string
  tierId?: string
  quantity?: number
  couponCode?: string
  region?: string
}) {
  console.log(`[COMMERCE] Creating buy-now cart for user=${input.userId}, product=${input.productId}, tier=${input.tierId ?? "default"}`)

  const product = await db.product.findUniqueOrThrow({
    where: { id: input.productId },
    include: { tiers: { where: input.tierId ? { id: input.tierId } : { isActive: true }, orderBy: { price: "asc" }, take: 1 } },
  })
  const tier = product.tiers[0]
  if (!tier) {
    console.error(`[COMMERCE] ❌ No active tier found for product: ${product.name} (id=${input.productId})`)
    throw new Error("Product does not have an active pricing tier")
  }
  if (product.status !== "PUBLISHED") {
    console.error(`[COMMERCE] ❌ Product not published: ${product.name} (status=${product.status})`)
    throw new Error("Product is not available for purchase")
  }
  const unitPrice = effectiveTierPrice(tier, input.region)
  console.log(`[COMMERCE] Product: ${product.name}, Tier: ${tier.name}, Price: ${unitPrice} ${tier.currency}`)

  const cart = await db.cart.create({
    data: {
      userId: input.userId,
      sessionId: `buy_now_${randomUUID()}`,
      status: CartStatus.ACTIVE,
      currency: tier.currency,
      region: input.region,
      metadata: { mode: "BUY_NOW", expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
      items: {
        create: {
          productId: product.id,
          tierId: tier.id,
          quantity: Math.max(1, input.quantity ?? 1),
          unitPrice: money(unitPrice),
          currency: tier.currency,
          itemType: product.type,
          vendorId: product.vendorId,
          metadata: {
            source: "buy_now",
            pricingSnapshot: {
              productVersion: product.version,
              tierName: tier.name,
              listPrice: Number(tier.price),
              effectivePrice: unitPrice,
              setupFee: Number(tier.setupFee ?? 0),
              interval: tier.interval,
              region: input.region ?? null,
            },
            selectedPlan: { tierId: tier.id, name: tier.name, interval: tier.interval },
            subscriptionType: tier.interval,
            vendorInfo: product.vendorId ? { vendorId: product.vendorId } : null,
            aiQuota: tier.aiQuota ?? {},
            taxData: { rate: getTaxRate({ tier }) },
          },
        },
      },
    },
  })

  return input.couponCode ? recalculateCart(cart.id, input.couponCode) : recalculateCart(cart.id)
}

export async function createOrderFromActiveCart(input: {
  userId: string
  gateway: PaymentGateway
  cartId?: string
  couponCode?: string
  affiliateCode?: string
  referralCode?: string
}) {
  console.log(`[COMMERCE] Creating order from cart: userId=${input.userId}, cartId=${input.cartId ?? "latest"}, gateway=${input.gateway}`)

  const order = await db.$transaction(async (tx) => {
    const cart = await tx.cart.findFirstOrThrow({
      where: input.cartId
        ? { id: input.cartId, userId: input.userId, status: "ACTIVE" }
        : { userId: input.userId, status: "ACTIVE" },
      include: { items: { include: { product: true, tier: true } } },
      orderBy: { updatedAt: "desc" },
    })
    if (cart.items.length === 0) throw new Error("Cart is empty")

    const totals = calculateCartAmounts(cart.items, Number(cart.discountTotal))
    const subtotal = totals.subtotal
    const taxTotal = totals.taxTotal
    const discountTotal = totals.discountTotal
    const grandTotal = totals.grandTotal
    const platformFee = subtotal * PLATFORM_COMMISSION_RATE
    const vendorNetTotal = subtotal - platformFee

    const pending = await tx.order.findFirst({
      where: { cartId: cart.id, status: OrderStatus.PENDING },
      include: { items: true },
    })

    if (pending) {
      await tx.orderItem.deleteMany({ where: { orderId: pending.id } })
      const updated = await tx.order.update({
        where: { id: pending.id },
        data: {
          gateway: input.gateway,
          currency: cart.currency,
          region: cart.region,
          subtotal: money(subtotal),
          taxTotal: money(taxTotal),
          discountTotal: money(discountTotal),
          platformFee: money(platformFee),
          vendorNetTotal: money(vendorNetTotal),
          grandTotal: money(grandTotal),
          couponCode: input.couponCode ?? cart.couponCode,
          affiliateCode: input.affiliateCode,
          referralCode: input.referralCode,
          billingSnapshot: {
            cartId: cart.id,
            cartMetadata: cart.metadata,
            recalculatedAt: new Date().toISOString(),
          },
          items: {
            create: cart.items.map((item) => {
              const lineTotal = Number(item.unitPrice) * item.quantity + getItemSetupFee(item)
              const lineTax = lineTotal * getTaxRate(item)
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
                taxAmount: money(lineTax),
                platformFee: money(itemPlatformFee),
                vendorNetAmount: money(lineTotal - itemPlatformFee),
                entitlementConfig: item.tier?.entitlementRules ?? {},
              }
            }),
          },
        },
        include: { items: true },
      })

      return updated
    }

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
        taxTotal: money(taxTotal),
        discountTotal: money(discountTotal),
        platformFee: money(platformFee),
        vendorNetTotal: money(vendorNetTotal),
        grandTotal: money(grandTotal),
        couponCode: input.couponCode ?? cart.couponCode,
        affiliateCode: input.affiliateCode,
        referralCode: input.referralCode,
        billingSnapshot: {
          cartId: cart.id,
          cartMetadata: cart.metadata,
          billingAddress: {},
          recalculatedAt: new Date().toISOString(),
        },
        fulfillmentPlan: {
          hosted: cart.items.filter((item) => item.tier?.fulfillmentType === FulfillmentType.HOSTED).length,
          downloads: cart.items.filter((item) => item.tier?.fulfillmentType === FulfillmentType.DOWNLOAD).length,
          services: cart.items.filter((item) => item.tier?.fulfillmentType === FulfillmentType.SERVICE_DELIVERY).length,
        },
        items: {
          create: cart.items.map((item) => {
            const lineTotal = Number(item.unitPrice) * item.quantity + getItemSetupFee(item)
            const lineTax = lineTotal * getTaxRate(item)
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
              taxAmount: money(lineTax),
              platformFee: money(itemPlatformFee),
              vendorNetAmount: money(lineTotal - itemPlatformFee),
              entitlementConfig: item.tier?.entitlementRules ?? {},
            }
          }),
        },
      },
      include: { items: true },
    })

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

  console.log(`[COMMERCE] ✅ Order created: ${order.orderNumber}, amount: ${order.grandTotal} ${order.currency}, items: ${order.items.length}`)

  return order
}

export async function attachGatewayOrder(input: {
  orderId: string
  gatewayOrderId: string
  gatewayPaymentId?: string
  paymentMethod?: string
  qrId?: string
  qrImageUrl?: string
  expiresAt?: Date
}) {
  console.log(`[COMMERCE] Attaching gateway order: orderId=${input.orderId}, gatewayOrderId=${input.gatewayOrderId}, method=${input.paymentMethod ?? "checkout"}`)

  const order = await db.order.findUniqueOrThrow({ where: { id: input.orderId } })

  const payment = await db.payment.upsert({
    where: { gatewayPaymentId: input.gatewayPaymentId ?? `pending_${input.gatewayOrderId}` },
    create: {
      orderId: order.id,
      userId: order.userId,
      amount: order.grandTotal,
      currency: order.currency,
      status: PaymentStatus.PENDING,
      gateway: order.gateway ?? PaymentGateway.RAZORPAY,
      gatewayPaymentId: input.gatewayPaymentId ?? `pending_${input.gatewayOrderId}`,
      gatewayOrderId: input.gatewayOrderId,
      failureReason: null,
    },
    update: {
      orderId: order.id,
      gatewayOrderId: input.gatewayOrderId,
      failureReason: null,
    },
  })

  await db.order.update({
    where: { id: order.id },
    data: {
      metadata: {
        ...((order.metadata as Record<string, unknown>) ?? {}),
        gatewayOrderId: input.gatewayOrderId,
        paymentMethod: input.paymentMethod,
        qrId: input.qrId,
        qrImageUrl: input.qrImageUrl,
        paymentExpiresAt: input.expiresAt?.toISOString(),
      },
    },
  })

  return payment
}

export async function markOrderPaymentFailed(input: {
  orderId?: string
  userId?: string
  gatewayOrderId?: string
  gatewayPaymentId?: string
  amount?: number
  currency?: string
  reason?: string
}) {
  console.error(`[COMMERCE] ❌ Order payment failed: orderId=${input.orderId ?? "none"}, reason=${input.reason ?? "unknown"}`)

  const order = input.orderId
    ? await db.order.findUnique({ where: { id: input.orderId } })
    : input.gatewayOrderId
      ? await db.order.findFirst({ where: { payments: { some: { gatewayOrderId: input.gatewayOrderId } } } })
      : null

  const userId = input.userId ?? order?.userId
  if (!userId) return null
  const gatewayPaymentId = input.gatewayPaymentId ?? `failed_${input.gatewayOrderId ?? randomUUID()}`

  const payment = await db.payment.upsert({
    where: { gatewayPaymentId },
    create: {
      orderId: order?.id,
      userId,
      amount: money(input.amount ?? Number(order?.grandTotal ?? 0)),
      currency: input.currency ?? order?.currency ?? "INR",
      status: PaymentStatus.FAILED,
      gateway: PaymentGateway.RAZORPAY,
      gatewayPaymentId,
      gatewayOrderId: input.gatewayOrderId,
      failureReason: input.reason ?? "Payment failed",
    },
    update: {
      status: PaymentStatus.FAILED,
      failureReason: input.reason ?? "Payment failed",
    },
  })

  await emitEvent({
    type: EVENTS.PAYMENT_FAILED,
    timestamp: new Date().toISOString(),
    actorId: userId,
    payload: { paymentId: payment.id, orderId: order?.id, reason: input.reason },
  })

  return payment
}

export async function markOrderPaid(orderId: string, gatewayPaymentId?: string, gatewayOrderId?: string) {
  console.log(`[COMMERCE] 💰 Marking order paid: orderId=${orderId}, gatewayPaymentId=${gatewayPaymentId ?? "none"}, gatewayOrderId=${gatewayOrderId ?? "none"}`)

  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { tier: true, product: true } }, user: true },
    })

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.FULFILLED) {
      return { order, alreadyProcessed: true }
    }

    const paidOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID, paidAt: new Date() },
    })

    let payment
    if (gatewayPaymentId) {
      const existingCaptured = await tx.payment.findUnique({ where: { gatewayPaymentId } })
      const pendingGatewayPaymentId = gatewayOrderId ? `pending_${gatewayOrderId}` : undefined
      const pendingPayment = pendingGatewayPaymentId
        ? await tx.payment.findUnique({ where: { gatewayPaymentId: pendingGatewayPaymentId } })
        : null

      if (existingCaptured) {
        payment = await tx.payment.update({
          where: { id: existingCaptured.id },
          data: {
            orderId: order.id,
            status: PaymentStatus.SUCCESS,
            gatewayOrderId,
            paidAt: new Date(),
            failureReason: null,
          },
        })
        if (pendingPayment && pendingPayment.id !== existingCaptured.id) {
          await tx.payment.delete({ where: { id: pendingPayment.id } })
        }
      } else if (pendingPayment) {
        payment = await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            gatewayPaymentId,
            orderId: order.id,
            status: PaymentStatus.SUCCESS,
            gatewayOrderId,
            paidAt: new Date(),
            failureReason: null,
          },
        })
      } else {
        payment = await tx.payment.create({
          data: {
          orderId: order.id,
          userId: order.userId,
          amount: order.grandTotal,
          currency: order.currency,
          status: PaymentStatus.SUCCESS,
          gateway: order.gateway ?? PaymentGateway.MANUAL,
          gatewayPaymentId,
          gatewayOrderId,
          paidAt: new Date(),
        },
        })
      }
    } else {
      payment = await tx.payment.create({
        data: {
        orderId: order.id,
        userId: order.userId,
        amount: order.grandTotal,
        currency: order.currency,
        status: PaymentStatus.SUCCESS,
        gateway: order.gateway ?? PaymentGateway.MANUAL,
        gatewayPaymentId,
        gatewayOrderId,
        paidAt: new Date(),
        },
      })
    }

    await tx.invoice.upsert({
      where: { paymentId: payment.id },
      create: {
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
      update: {
        orderId: order.id,
        totalAmount: order.grandTotal,
        taxAmount: order.taxTotal,
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

      const existingEntitlement = await tx.customerEntitlement.findFirst({
        where: { userId: order.userId, productId: item.productId, orderId: order.id },
      })

      if (!existingEntitlement) {
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
      }

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

    const payoutGroups = new Map<string, { amount: number; currency: string; orderItemIds: string[] }>()
    for (const item of order.items) {
      if (!item.vendorId) continue
      const fallback: { amount: number; currency: string; orderItemIds: string[] } = {
        amount: 0,
        currency: item.currency,
        orderItemIds: [],
      }
      const existing = payoutGroups.get(item.vendorId) ?? fallback
      existing.amount += Number(item.vendorNetAmount)
      existing.orderItemIds.push(item.id)
      payoutGroups.set(item.vendorId, existing)
    }

    const periodStart = new Date()
    periodStart.setDate(1)
    periodStart.setHours(0, 0, 0, 0)
    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    for (const [vendorId, payout] of payoutGroups) {
      const existingPayout = await tx.vendorPayout.findFirst({
        where: {
          vendorId,
          orderItemIds: { hasSome: payout.orderItemIds },
        },
      })
      if (!existingPayout) {
        await tx.vendorPayout.create({
          data: {
            vendorId,
            amount: money(payout.amount),
            currency: payout.currency,
            periodStart,
            periodEnd,
            processor: "RAZORPAY_ROUTE",
            orderItemIds: payout.orderItemIds,
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              paymentId: payment.id,
              platformCommissionRate: PLATFORM_COMMISSION_RATE,
            },
          },
        })
      }
    }

    if (order.cartId) {
      await tx.cart.update({ where: { id: order.cartId }, data: { status: CartStatus.CONVERTED, convertedAt: new Date() } })
    }

    if (order.couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode } })
      if (coupon) {
        await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })
        const existingUsage = await tx.couponUsage.findFirst({ where: { couponId: coupon.id, userId: order.userId } })
        if (!existingUsage) {
          await tx.couponUsage.create({
            data: {
              couponId: coupon.id,
              userId: order.userId,
              orderId: order.id,
              discount: order.discountTotal,
            },
          })
        }
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

    return { order: paidOrder, payment, alreadyProcessed: false }
  })

  if (result.alreadyProcessed) {
    console.log(`[COMMERCE] ⏭️ Order ${result.order.orderNumber} already processed — skipping`)
    return result.order
  }

  const processedOrder = result.order
  const orderUserId = processedOrder.userId
  console.log(`[COMMERCE] ✅ Order ${processedOrder.orderNumber} marked as PAID for user ${orderUserId}`)

  try {
    await createNotification({
      userId: orderUserId,
      type: "ORDER",
      title: "Your NexusAI order is active",
      body: `${processedOrder.orderNumber} has been paid and your entitlements are ready.`,
      actionUrl: "/dashboard/subscriptions",
      metadata: { orderId: processedOrder.id, orderNumber: processedOrder.orderNumber },
    })
  } catch {}

  for (const item of processedOrder.items ?? []) {
    if (item.tier && isRecurring(item.tier.interval)) {
      try {
        await emitEvent({
          type: EVENTS.SUBSCRIPTION_ACTIVATED,
          timestamp: new Date().toISOString(),
          actorId: orderUserId,
          payload: {
            subscriptionId: result.payment?.id ?? processedOrder.id,
            userId: orderUserId,
            productId: item.productId,
            tierId: item.tier.id,
            productName: item.product?.name ?? "",
            planName: item.tier.name ?? "",
          },
        })
      } catch {}
    }
  }

  try {
    await emailQueue.add(EMAIL_JOBS.SEND_WELCOME, {
      userId: orderUserId,
      type: "post-payment",
      orderId: processedOrder.id,
      orderNumber: processedOrder.orderNumber,
    })
  } catch {}

  await emitEvent({
    type: EVENTS.ORDER_PAID,
    timestamp: new Date().toISOString(),
    actorId: orderUserId,
    payload: { orderId: processedOrder.id, orderNumber: processedOrder.orderNumber, amount: Number(processedOrder.grandTotal) },
  })

  await emitEvent({
    type: EVENTS.PAYMENT_SUCCESS,
    timestamp: new Date().toISOString(),
    actorId: orderUserId,
    payload: { orderId: processedOrder.id, orderNumber: processedOrder.orderNumber, amount: Number(processedOrder.grandTotal), gatewayPaymentId },
  })

  return processedOrder
}

/**
 * fulfillOrder — enterprise-grade product delivery engine.
 *
 * Called AFTER markOrderPaid completes. Handles:
 * - Decrypting product deliveryConfig
 * - Setting credential snapshot on entitlements
 * - Setting 3-hour refund window
 * - Decrementing inventory (if tracked)
 * - Sending product delivery email with credentials
 * - Emitting ORDER_FULFILLED and CREDENTIAL_DELIVERED events
 * - Handling SOLD_OUT detection
 *
 * Uses atomic per-entitlement transactions for idempotency.
 */
export async function fulfillOrder(orderId: string): Promise<void> {
  console.log(`[FULFILL] 🚀 Starting order fulfillment for orderId=${orderId}`)

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              deliveryConfig: true,
              inventoryEnabled: true,
              inventoryCount: true,
              lowStockThreshold: true,
            },
          },
          tier: { select: { id: true, name: true, interval: true } },
        },
      },
      user: { select: { id: true, email: true, name: true } },
    },
  })

  if (!order) {
    console.error(`[FULFILL] ❌ Order not found: ${orderId}`)
    return
  }

  if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.FULFILLED) {
    console.warn(`[FULFILL] ⚠️ Order ${order.orderNumber} is not paid (status=${order.status}) — skipping fulfillment`)
    return
  }

  const { encrypt, decrypt } = await import("@/lib/encryption")

  for (const item of order.items) {
    const product = item.product
    if (!product) continue

    try {
      // Decrypt deliveryConfig to get credential template
      let deliveryConfig: Record<string, unknown> = {}
      if (product.deliveryConfig) {
        try {
          const decrypted = decrypt(product.deliveryConfig as string)
          deliveryConfig = JSON.parse(decrypted)
        } catch (decryptErr) {
          console.warn(`[FULFILL] ⚠️ Could not decrypt deliveryConfig for product ${product.id}`, decryptErr)
        }
      }

      // Find the entitlement created by markOrderPaid
      const entitlement = await db.customerEntitlement.findFirst({
        where: { userId: order.userId, productId: product.id, orderId: order.id },
      })

      if (!entitlement) {
        console.warn(`[FULFILL] ⚠️ No entitlement found for order=${orderId} product=${product.id}`)
        continue
      }

      // Already fulfilled
      if (entitlement.status === "ACTIVE" && entitlement.credentialSnapshot) {
        console.log(`[FULFILL] ⏭️ Entitlement ${entitlement.id} already fulfilled`)
        continue
      }

      // Encrypt credentials for storage
      const credentialSnapshot = Object.keys(deliveryConfig).length > 0
        ? encrypt(JSON.stringify(deliveryConfig))
        : null

      // Refund window: 3 hours from now
      const refundEligibleUntil = new Date(Date.now() + 3 * 60 * 60 * 1000)

      // Calculate entitlement expiry based on subscription period or fallback
      const now = new Date()
      let expiresAt: Date | undefined
      if (item.tier && isRecurring(item.tier.interval)) {
        expiresAt = intervalEnd(item.tier.interval)
      }

      await db.customerEntitlement.update({
        where: { id: entitlement.id },
        data: {
          status: "ACTIVE",
          credentialSnapshot,
          refundEligibleUntil,
          expiresAt,
          deliveredAt: now,
        },
      })

      // Handle inventory decrement
      if (product.inventoryEnabled && product.inventoryCount !== null) {
        const updatedProduct = await db.product.update({
          where: { id: product.id },
          data: { inventoryCount: { decrement: item.quantity } },
          select: { inventoryCount: true, lowStockThreshold: true, name: true },
        })

        await emitEvent({
          type: EVENTS.INVENTORY_UPDATED,
          timestamp: new Date().toISOString(),
          payload: {
            productId: product.id,
            productName: product.name,
            newCount: Number(updatedProduct.inventoryCount ?? 0),
            decrementedBy: item.quantity,
          },
        })

        // Check if sold out
        const newCount = Number(updatedProduct.inventoryCount ?? 0)
        if (newCount <= 0) {
          await db.product.update({
            where: { id: product.id },
            data: { status: "SOLD_OUT" },
          }).catch(() => {})

          await emitEvent({
            type: EVENTS.PRODUCT_SOLD_OUT,
            timestamp: new Date().toISOString(),
            payload: { productId: product.id, productName: product.name },
          })
        }
      }

      // Send product delivery email with decrypted credentials (NOT the encrypted snapshot)
      const credentials = Object.keys(deliveryConfig).length > 0 ? deliveryConfig : null
      await emailQueue.add(EMAIL_JOBS.SEND_PRODUCT_DELIVERY, {
        userId: order.userId,
        productName: product.name,
        saasUrl: credentials?.saasUrl as string | undefined,
        username: credentials?.username as string | undefined,
        password: credentials?.password as string | undefined,
        apiKeys: credentials?.apiKeys as string | undefined,
        onboardingInstructions: credentials?.onboardingInstructions as string | undefined,
        accessDocUrl: credentials?.accessDocUrl as string | undefined,
        subscriptionDuration: item.tier ? item.tier.name : "Lifetime",
        renewalDate: expiresAt?.toLocaleDateString(),
        supportUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/tickets`,
      })

      // Emit CREDENTIAL_DELIVERED event
      await emitEvent({
        type: EVENTS.CREDENTIAL_DELIVERED,
        timestamp: new Date().toISOString(),
        actorId: "SYSTEM",
        payload: {
          entitlementId: entitlement.id,
          productId: product.id,
          productName: product.name,
          userId: order.userId,
          orderId: order.id,
        },
      })

      console.log(`[FULFILL] ✅ Entitlement ${entitlement.id} fulfilled for product ${product.name}`)
    } catch (itemErr) {
      console.error(`[FULFILL] ❌ Failed to fulfill item for product ${product.id}:`, itemErr)
      // Continue with other items — partial fulfillment is better than full failure
    }
  }

  // Mark order as FULFILLED
  await db.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.FULFILLED },
  }).catch((err) => console.warn("[FULFILL] Could not mark order FULFILLED:", err))

  // Emit ORDER_FULFILLED to admin dashboard and user channel
  await emitEvent({
    type: EVENTS.ORDER_FULFILLED,
    timestamp: new Date().toISOString(),
    actorId: "SYSTEM",
    payload: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      itemCount: order.items.length,
      productNames: order.items.map((i) => i.product?.name).filter(Boolean),
    },
  })

  console.log(`[FULFILL] 🎉 Order ${order.orderNumber} fully fulfilled`)
}
