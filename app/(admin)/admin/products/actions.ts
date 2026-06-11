"use server"

import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-auth"
import { revalidatePath, revalidateTag } from "next/cache"
import { ProductStatus, ProductType, BillingInterval } from "@prisma/client"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { encrypt } from "@/lib/encryption"

// ─── ISR Revalidation Helper ─────────────────────────────────────────────────────

const REVALIDATE_PROFILE = "" // Next.js 16 requires second arg

async function revalidateProductCaches(type?: ProductType, slug?: string) {
  // Revalidate all product-related pages and tags
  revalidateTag("products", REVALIDATE_PROFILE)
  revalidateTag("featured-products", REVALIDATE_PROFILE)
  revalidateTag("home-products", REVALIDATE_PROFILE)
  revalidateTag("pricing", REVALIDATE_PROFILE)
  revalidatePath("/admin/products")
  revalidatePath("/")
  revalidatePath("/products")
  revalidatePath("/pricing")
  if (type) {
    revalidateTag(`products-${type.toLowerCase()}`, REVALIDATE_PROFILE)
    revalidatePath(`/products/${type.toLowerCase()}`)
  }
  if (slug) {
    revalidatePath(`/products/${slug}`)
  }
}

// ─── Create Product ───────────────────────────────────────────────────────────────

export async function createProduct(data: {
  name: string
  slug: string
  tagline: string
  description: string
  longDescription?: string | null
  type: ProductType
  category?: string | null
  subcategory?: string | null
  status: ProductStatus
  scheduledAt?: string | null
  isPremium: boolean
  proPoints: number
  tags?: string[]
  thumbnailUrl?: string | null
  iconUrl?: string | null
  bannerUrl?: string | null
  screenshotUrls?: string[]
  videoUrls?: string[]
  demoUrl?: string | null
  documentationUrl?: string | null
  previewEnabled?: boolean
  previewConfig?: any
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string[]
  badgeText?: string | null
}) {
  const admin = await requireAdmin()

  const product = await db.$transaction(async (tx) => {
    const newProduct = await tx.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        tagline: data.tagline,
        description: data.description,
        longDescription: data.longDescription,
        type: data.type,
        category: data.category,
        subcategory: data.subcategory,
        status: data.status,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        isPremium: data.isPremium,
        proPoints: data.proPoints,
        tags: data.tags ?? [],
        thumbnailUrl: data.thumbnailUrl,
        iconUrl: data.iconUrl,
        bannerUrl: data.bannerUrl,
        screenshotUrls: data.screenshotUrls ?? [],
        videoUrls: data.videoUrls ?? [],
        demoUrl: data.demoUrl,
        documentationUrl: data.documentationUrl,
        previewEnabled: data.previewEnabled ?? false,
        previewConfig: data.previewConfig ?? {},
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        seoKeywords: data.seoKeywords ?? [],
        badgeText: data.badgeText,
        features: {},
        createdBy: admin.userId,
        lastEditedBy: admin.userId,
        version: 1,
      },
    })

    // Initial version snapshot
    await tx.productVersion.create({
      data: {
        productId: newProduct.id,
        version: 1,
        snapshot: { ...data, createdAt: new Date().toISOString() },
        changedBy: admin.userId,
        changedByName: admin.name,
        changeNote: "Initial creation",
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_CREATED",
        entity: "Product",
        entityId: newProduct.id,
        afterJson: {
          name: newProduct.name,
          slug: newProduct.slug,
          type: newProduct.type,
          status: newProduct.status,
          category: newProduct.category,
        },
      },
    })

    return newProduct
  })

  await emitEvent({
    type: EVENTS.PRODUCT_CREATED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: { productId: product.id, name: product.name, type: product.type, status: product.status },
  })

  await revalidateProductCaches(product.type, product.slug)
  return product
}

// ─── Update Product ───────────────────────────────────────────────────────────────

export async function updateProduct(productId: string, data: {
  name: string
  slug: string
  tagline: string
  description: string
  longDescription?: string | null
  type: ProductType
  category?: string | null
  subcategory?: string | null
  status: ProductStatus
  scheduledAt?: string | null
  isPremium: boolean
  proPoints: number
  tags?: string[]
  thumbnailUrl?: string | null
  iconUrl?: string | null
  bannerUrl?: string | null
  screenshotUrls?: string[]
  videoUrls?: string[]
  demoUrl?: string | null
  documentationUrl?: string | null
  previewEnabled?: boolean
  previewConfig?: any
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string[]
  badgeText?: string | null
}, changeNote?: string) {
  const admin = await requireAdmin()

  const product = await db.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({
      where: { id: productId },
      include: { tiers: true },
    })

    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        name: data.name,
        slug: data.slug,
        tagline: data.tagline,
        description: data.description,
        longDescription: data.longDescription,
        type: data.type,
        category: data.category,
        subcategory: data.subcategory,
        status: data.status,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        isPremium: data.isPremium,
        proPoints: data.proPoints,
        tags: data.tags ?? [],
        thumbnailUrl: data.thumbnailUrl,
        iconUrl: data.iconUrl,
        bannerUrl: data.bannerUrl,
        screenshotUrls: data.screenshotUrls ?? [],
        videoUrls: data.videoUrls ?? [],
        demoUrl: data.demoUrl,
        documentationUrl: data.documentationUrl,
        previewEnabled: data.previewEnabled ?? false,
        previewConfig: data.previewConfig ?? {},
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        seoKeywords: data.seoKeywords ?? [],
        badgeText: data.badgeText,
        lastEditedBy: admin.userId,
        version: { increment: 1 },
      },
    })

    // Save immutable version snapshot
    await tx.productVersion.create({
      data: {
        productId,
        version: updated.version,
        snapshot: {
          before: {
            name: before.name,
            slug: before.slug,
            status: before.status,
            type: before.type,
            category: before.category,
            description: before.description,
          },
          after: data,
          tiers: before.tiers.map(t => ({
            id: t.id,
            name: t.name,
            price: String(t.price),
            currency: t.currency,
            interval: t.interval,
          })),
        },
        changedBy: admin.userId,
        changedByName: admin.name,
        changeNote: changeNote ?? "Admin edit",
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_UPDATED",
        entity: "Product",
        entityId: productId,
        beforeJson: { name: before.name, status: before.status, slug: before.slug, type: before.type },
        afterJson: { name: updated.name, status: updated.status, slug: updated.slug, type: updated.type },
      },
    })

    return updated
  })

  await emitEvent({
    type: EVENTS.PRODUCT_UPDATED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: { productId, name: product.name, status: product.status },
  })

  await revalidateProductCaches(product.type, product.slug)
  return product
}

// ─── Update Product Status ────────────────────────────────────────────────────────

export async function republishProduct(productId: string) {
  const admin = await requireAdmin()

  const product = await db.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id: productId } })
    if (before.status !== "REPUBLISH_PENDING") {
      throw new Error("Only REPUBLISH_PENDING products can be republished.")
    }
    
    const updated = await tx.product.update({
      where: { id: productId },
      data: { 
        status: "AVAILABLE", 
        lastEditedBy: admin.userId,
        assignedUserId: null,
        assignedEmail: null,
        reservedUntil: null
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_REPUBLISHED",
        entity: "Product",
        entityId: productId,
        beforeJson: { status: before.status },
        afterJson: { status: updated.status },
      },
    })

    return updated
  })

  revalidatePath("/admin/products")
  revalidatePath("/marketplace")
  return product
}

export async function updateProductStatus(productId: string, status: ProductStatus) {
  const admin = await requireAdmin()

  const product = await db.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id: productId } })
    const updated = await tx.product.update({
      where: { id: productId },
      data: { status, lastEditedBy: admin.userId },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_STATUS_CHANGED",
        entity: "Product",
        entityId: productId,
        beforeJson: { status: before.status },
        afterJson: { status },
      },
    })

    return updated
  })

  await revalidateProductCaches(product.type, product.slug)
  return product
}

// ─── Toggle Product Badge ─────────────────────────────────────────────────────────

export async function toggleProductBadge(
  productId: string,
  badge: "isFeatured" | "isPinned" | "isTrending" | "isBestSeller",
  value: boolean
) {
  const admin = await requireAdmin()

  const product = await db.product.update({
    where: { id: productId },
    data: { [badge]: value, lastEditedBy: admin.userId },
  })

  await db.auditLog.create({
    data: {
      userId: admin.userId,
      action: `PRODUCT_BADGE_${badge.toUpperCase()}_${value ? "ON" : "OFF"}`,
      entity: "Product",
      entityId: productId,
      afterJson: { badge, value },
    },
  })

  await revalidateProductCaches(product.type, product.slug)
  return product
}

// ─── Delete Product ───────────────────────────────────────────────────────────────

export async function deleteProduct(productId: string) {
  const admin = await requireAdmin()

  const product = await db.$transaction(async (tx) => {
    const existing = await tx.product.findUniqueOrThrow({ where: { id: productId } })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_DELETED",
        entity: "Product",
        entityId: productId,
        beforeJson: { name: existing.name, slug: existing.slug, type: existing.type },
      },
    })

    await tx.product.delete({ where: { id: productId } })
    return existing
  })

  await revalidateProductCaches(product.type, product.slug)
  return { success: true }
}

// ─── Duplicate Product ────────────────────────────────────────────────────────────

export async function duplicateProduct(productId: string) {
  const admin = await requireAdmin()

  const source = await db.product.findUniqueOrThrow({
    where: { id: productId },
    include: { tiers: true },
  })

  const newSlug = `${source.slug}-copy-${Date.now().toString(36)}`

  const dup = await db.$transaction(async (tx) => {
    const newProduct = await tx.product.create({
      data: {
        name: `${source.name} (Copy)`,
        slug: newSlug,
        tagline: source.tagline,
        description: source.description,
        longDescription: source.longDescription,
        type: source.type,
        category: source.category,
        subcategory: source.subcategory,
        status: "DRAFT",
        isPremium: source.isPremium,
        proPoints: source.proPoints,
        tags: source.tags,
        thumbnailUrl: source.thumbnailUrl,
        iconUrl: source.iconUrl,
        bannerUrl: source.bannerUrl,
        screenshotUrls: source.screenshotUrls,
        videoUrls: source.videoUrls,
        demoUrl: source.demoUrl,
        documentationUrl: source.documentationUrl,
        previewEnabled: source.previewEnabled,
        previewConfig: source.previewConfig as any,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        seoKeywords: source.seoKeywords,
        features: (source.features as any) ?? {},
        techStack: source.techStack as any,
        createdBy: admin.userId,
        lastEditedBy: admin.userId,
        version: 1,
      },
    })

    // Duplicate tiers
    const tiers: any[] = []
    for (const tier of source.tiers) {
      const newTier = await tx.productTier.create({
        data: {
          productId: newProduct.id,
          name: tier.name,
          description: tier.description,
          price: tier.price,
          discountPrice: tier.discountPrice,
          currency: tier.currency,
          interval: tier.interval,
          features: tier.features,
          limits: tier.limits ?? undefined,
          trialDays: tier.trialDays,
          taxRate: tier.taxRate,
          taxInclusive: tier.taxInclusive,
          isPopular: tier.isPopular,
          isRecommended: tier.isRecommended,
          isActive: tier.isActive,
          sortOrder: tier.sortOrder,
        },
      })
      tiers.push(newTier)
    }

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_DUPLICATED",
        entity: "Product",
        entityId: newProduct.id,
        afterJson: { sourceId: productId, newId: newProduct.id, slug: newSlug },
      },
    })

    return {
      ...newProduct,
      tiers: tiers.map((tier) => ({
        ...tier,
        price: Number(tier.price),
        discountPrice: tier.discountPrice ? Number(tier.discountPrice) : null,
        introPrice: tier.introPrice ? Number(tier.introPrice) : null,
        flashSalePrice: tier.flashSalePrice ? Number(tier.flashSalePrice) : null,
        setupFee: tier.setupFee ? Number(tier.setupFee) : null,
        flashSaleEndsAt: tier.flashSaleEndsAt ? tier.flashSaleEndsAt.toISOString() : null,
        createdAt: tier.createdAt.toISOString(),
        updatedAt: tier.updatedAt.toISOString(),
      })),
      versions: [],
      scheduledAt: newProduct.scheduledAt ? newProduct.scheduledAt.toISOString() : null,
      createdAt: newProduct.createdAt.toISOString(),
      updatedAt: newProduct.updatedAt.toISOString(),
    }
  })

  await revalidateProductCaches()
  return dup
}

// ─── Restore Product Version ──────────────────────────────────────────────────────

export async function restoreProductVersion(productId: string, versionId: string) {
  const admin = await requireAdmin()

  const version = await db.productVersion.findUniqueOrThrow({ where: { id: versionId } })
  const snapshot = version.snapshot as any
  const afterData = snapshot.after ?? snapshot

  const product = await db.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        name: afterData.name,
        slug: afterData.slug,
        tagline: afterData.tagline,
        description: afterData.description,
        longDescription: afterData.longDescription,
        type: afterData.type,
        category: afterData.category,
        status: afterData.status ?? "DRAFT",
        lastEditedBy: admin.userId,
        version: { increment: 1 },
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_VERSION_RESTORED",
        entity: "Product",
        entityId: productId,
        afterJson: { versionId, restoredToVersion: version.version },
      },
    })

    return updated
  })

  await revalidateProductCaches(product.type, product.slug)
  return product
}

// ─── Add Product Version Manually ────────────────────────────────────────────────

export async function addProductVersion(productId: string, note: string) {
  const admin = await requireAdmin()

  const product = await db.product.findUniqueOrThrow({
    where: { id: productId },
    include: { tiers: true },
  })

  return db.productVersion.create({
    data: {
      productId,
      version: product.version,
      snapshot: product,
      changedBy: admin.userId,
      changedByName: admin.name,
      changeNote: note,
    },
  })
}

// ─── Update Product SEO ───────────────────────────────────────────────────────────

export async function updateProductSEO(productId: string, data: {
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string[]
}) {
  const admin = await requireAdmin()

  const product = await db.product.update({
    where: { id: productId },
    data: { ...data, lastEditedBy: admin.userId },
  })

  await revalidateProductCaches(product.type, product.slug)
  return product
}

// ─── Create Tier ─────────────────────────────────────────────────────────────────

export async function createTier(productId: string, data: {
  name: string
  description?: string | null
  price: number
  discountPrice?: number | null
  currency: string
  interval: BillingInterval
  features: string[]
  limits: any
  trialDays?: number
  introPrice?: number | null
  introPeriodDays?: number
  flashSalePrice?: number | null
  flashSaleEndsAt?: string | null
  taxRate?: number
  taxInclusive?: boolean
  setupFee?: number | null
  maxSeats?: number | null
  isPopular: boolean
  isRecommended?: boolean
  isActive: boolean
  sortOrder?: number
  stripePriceId?: string
  stripeProductId?: string
  razorpayPlanId?: string
}) {
  const admin = await requireAdmin()

  const tier = await db.$transaction(async (tx) => {
    const newTier = await tx.productTier.create({
      data: {
        productId,
        name: data.name,
        description: data.description,
        price: data.price,
        discountPrice: data.discountPrice,
        currency: data.currency,
        interval: data.interval,
        features: data.features,
        limits: data.limits,
        trialDays: data.trialDays ?? 0,
        introPrice: data.introPrice,
        introPeriodDays: data.introPeriodDays ?? 0,
        flashSalePrice: data.flashSalePrice,
        flashSaleEndsAt: data.flashSaleEndsAt ? new Date(data.flashSaleEndsAt) : null,
        taxRate: data.taxRate ?? 0,
        taxInclusive: data.taxInclusive ?? false,
        setupFee: data.setupFee,
        maxSeats: data.maxSeats,
        isPopular: data.isPopular,
        isRecommended: data.isRecommended ?? false,
        isActive: data.isActive,
        sortOrder: data.sortOrder ?? 0,
        version: 1,
        stripePriceId: data.stripePriceId,
        stripeProductId: data.stripeProductId,
        razorpayPlanId: data.razorpayPlanId,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_TIER_CREATED",
        entity: "ProductTier",
        entityId: newTier.id,
        afterJson: {
          name: newTier.name,
          price: String(newTier.price),
          currency: newTier.currency,
          interval: newTier.interval,
          productId,
        },
      },
    })

    return newTier
  })

  await revalidateProductCaches()
  revalidateTag("pricing", REVALIDATE_PROFILE)
  return tier
}

// ─── Update Tier ─────────────────────────────────────────────────────────────────

export async function updateTier(tierId: string, data: {
  name: string
  description?: string | null
  price: number
  discountPrice?: number | null
  currency: string
  interval: BillingInterval
  features: string[]
  limits: any
  trialDays?: number
  introPrice?: number | null
  introPeriodDays?: number
  flashSalePrice?: number | null
  flashSaleEndsAt?: string | null
  taxRate?: number
  taxInclusive?: boolean
  setupFee?: number | null
  maxSeats?: number | null
  isPopular: boolean
  isRecommended?: boolean
  isActive?: boolean
  sortOrder?: number
  priceChangeReason?: string
  stripePriceId?: string
  stripeProductId?: string
  razorpayPlanId?: string
}) {
  const admin = await requireAdmin()

  const result = await db.$transaction(async (tx) => {
    const current = await tx.productTier.findUniqueOrThrow({ where: { id: tierId } })
    const before = { ...current }

    const updated = await tx.productTier.update({
      where: { id: tierId },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        discountPrice: data.discountPrice,
        currency: data.currency,
        interval: data.interval,
        features: data.features,
        limits: data.limits,
        trialDays: data.trialDays ?? 0,
        introPrice: data.introPrice,
        introPeriodDays: data.introPeriodDays ?? 0,
        flashSalePrice: data.flashSalePrice,
        flashSaleEndsAt: data.flashSaleEndsAt ? new Date(data.flashSaleEndsAt) : null,
        taxRate: data.taxRate ?? 0,
        taxInclusive: data.taxInclusive ?? false,
        setupFee: data.setupFee,
        maxSeats: data.maxSeats,
        isPopular: data.isPopular,
        isRecommended: data.isRecommended ?? false,
        isActive: data.isActive !== undefined ? data.isActive : current.isActive,
        sortOrder: data.sortOrder !== undefined ? data.sortOrder : current.sortOrder,
        version: current.version + 1,
        stripePriceId: data.stripePriceId !== undefined ? data.stripePriceId : current.stripePriceId,
        stripeProductId: data.stripeProductId !== undefined ? data.stripeProductId : current.stripeProductId,
        razorpayPlanId: data.razorpayPlanId !== undefined ? data.razorpayPlanId : current.razorpayPlanId,
      },
    })

    const priceChanged = Number(before.price) !== Number(data.price)

    if (priceChanged) {
      await tx.pricingHistory.create({
        data: {
          tierId,
          productId: before.productId,
          oldPrice: before.price,
          newPrice: data.price,
          currency: data.currency,
          interval: data.interval,
          changedBy: admin.userId,
          reason: data.priceChangeReason ?? "Admin update",
          effectiveAt: new Date(),
        },
      })
    }

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: priceChanged ? "TIER_PRICE_CHANGED" : "PRODUCT_TIER_UPDATED",
        entity: "ProductTier",
        entityId: tierId,
        beforeJson: { name: before.name, price: String(before.price), isActive: before.isActive },
        afterJson: {
          name: updated.name,
          price: String(updated.price),
          isActive: updated.isActive,
          reason: data.priceChangeReason,
        },
      },
    })

    return { tier: updated, priceChanged }
  })

  if (result.priceChanged) {
    await emitEvent({
      type: EVENTS.TIER_PRICE_CHANGED,
      timestamp: new Date().toISOString(),
      actorId: admin.userId,
      payload: { tierId, newPrice: data.price, currency: data.currency, reason: data.priceChangeReason },
    })
  }

  await revalidateProductCaches()
  revalidateTag("pricing", REVALIDATE_PROFILE)
  return result.tier
}

// ─── Delete Tier ──────────────────────────────────────────────────────────────────

export async function deleteTier(tierId: string) {
  const admin = await requireAdmin()

  await db.$transaction(async (tx) => {
    const tier = await tx.productTier.findUniqueOrThrow({ where: { id: tierId } })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "PRODUCT_TIER_DELETED",
        entity: "ProductTier",
        entityId: tierId,
        beforeJson: { name: tier.name, price: String(tier.price), productId: tier.productId },
      },
    })

    await tx.productTier.delete({ where: { id: tierId } })
  })

  await revalidateProductCaches()
  revalidateTag("pricing", REVALIDATE_PROFILE)
  return { success: true }
}

// ─── Update Product Delivery Config (Enterprise) ─────────────────────────────────
// Encrypts sensitive credentials before storing them in the DB.

export async function updateProductDeliveryConfig(
  productId: string,
  deliveryConfig: {
    saasUrl?: string
    username?: string
    password?: string
    apiKeys?: string
    onboardingInstructions?: string
    accessDocUrl?: string
    deliveryType?: string
  }
) {
  const admin = await requireAdmin()

  // Encrypt the entire deliveryConfig JSON
  const encryptedConfig = encrypt(JSON.stringify(deliveryConfig))

  await db.product.update({
    where: { id: productId },
    data: {
      deliveryConfig: encryptedConfig,
      lastEditedBy: admin.userId,
    },
  })

  await db.auditLog.create({
    data: {
      userId: admin.userId,
      action: "PRODUCT_DELIVERY_CONFIG_UPDATED",
      entity: "Product",
      entityId: productId,
      afterJson: {
        // Never log the actual credentials — only metadata
        hasDeliveryConfig: true,
        deliveryType: deliveryConfig.deliveryType,
        hasSaasUrl: !!deliveryConfig.saasUrl,
        hasCredentials: !!(deliveryConfig.username || deliveryConfig.apiKeys),
        updatedAt: new Date().toISOString(),
      },
    },
  })

  await revalidateProductCaches()
  return { success: true }
}

// ─── Update Product Preview Config (Enterprise) ──────────────────────────────────

export async function updateProductPreviewConfig(
  productId: string,
  previewConfig: {
    allowPreview?: boolean
    previewDurationMinutes?: number
    maxPreviewsPerUser?: number
    previewCooldownHours?: number
    previewPageUrl?: string
    previewDescription?: string
  }
) {
  const admin = await requireAdmin()

  await db.product.update({
    where: { id: productId },
    data: {
      previewConfig: previewConfig as any,
      lastEditedBy: admin.userId,
    },
  })

  await db.auditLog.create({
    data: {
      userId: admin.userId,
      action: "PRODUCT_PREVIEW_CONFIG_UPDATED",
      entity: "Product",
      entityId: productId,
      afterJson: { productId, previewConfig, updatedAt: new Date().toISOString() },
    },
  })

  await revalidateProductCaches()
  return { success: true }
}

// ─── Update Product Inventory (Enterprise) ───────────────────────────────────────

export async function updateProductInventory(
  productId: string,
  inventory: {
    inventoryEnabled: boolean
    inventoryCount?: number
    lowStockThreshold?: number
  }
) {
  const admin = await requireAdmin()

  const before = await db.product.findUnique({
    where: { id: productId },
    select: { inventoryCount: true, inventoryEnabled: true },
  })

  const product = await db.product.update({
    where: { id: productId },
    data: {
      inventoryEnabled: inventory.inventoryEnabled,
      inventoryCount: inventory.inventoryCount ?? null,
      lastEditedBy: admin.userId,
    },
  })

  await db.auditLog.create({
    data: {
      userId: admin.userId,
      action: "PRODUCT_INVENTORY_UPDATED",
      entity: "Product",
      entityId: productId,
      beforeJson: { inventoryCount: String(before?.inventoryCount ?? "null"), inventoryEnabled: before?.inventoryEnabled },
      afterJson: { inventoryCount: String(inventory.inventoryCount ?? "null"), inventoryEnabled: inventory.inventoryEnabled },
    },
  })

  await revalidateProductCaches()
  return product
}
