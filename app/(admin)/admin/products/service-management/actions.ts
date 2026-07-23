"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-auth"
import {
  DEFAULT_PRODUCT_SERVICE_PROFILE,
  parseJsonField,
  type CapacityGroup,
  type IncludedService,
  type PaidAddon,
  type ResourceLink,
  type UpgradePath,
} from "@/lib/product-service-profile"

export async function saveProductServiceProfile(productId: string, formData: FormData) {
  const admin = await requireAdmin()

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  })
  if (!product) throw new Error("Product not found")

  const data = {
    headline: String(formData.get("headline") ?? "").trim() || null,
    summary: String(formData.get("summary") ?? "").trim() || null,
    capacity: parseJsonField<CapacityGroup[]>(
      formData.get("capacity"),
      DEFAULT_PRODUCT_SERVICE_PROFILE.capacity
    ),
    freeServices: parseJsonField<IncludedService[]>(
      formData.get("freeServices"),
      DEFAULT_PRODUCT_SERVICE_PROFILE.freeServices
    ),
    paidAddons: parseJsonField<PaidAddon[]>(
      formData.get("paidAddons"),
      DEFAULT_PRODUCT_SERVICE_PROFILE.paidAddons
    ),
    upgradePaths: parseJsonField<UpgradePath[]>(
      formData.get("upgradePaths"),
      DEFAULT_PRODUCT_SERVICE_PROFILE.upgradePaths
    ),
    documentation: parseJsonField<ResourceLink[]>(
      formData.get("documentation"),
      DEFAULT_PRODUCT_SERVICE_PROFILE.documentation
    ),
    tutorials: parseJsonField<ResourceLink[]>(
      formData.get("tutorials"),
      DEFAULT_PRODUCT_SERVICE_PROFILE.tutorials
    ),
    supportBenefits: parseJsonField<IncludedService[]>(
      formData.get("supportBenefits"),
      DEFAULT_PRODUCT_SERVICE_PROFILE.supportBenefits
    ),
    hiddenFields: String(formData.get("hiddenFields") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    isPublished: formData.get("isPublished") === "on",
    updatedBy: admin.userId,
  }

  const saved = await db.productServiceProfile.upsert({
    where: { productId },
    create: { productId, ...data },
    update: data,
  })

  await db.auditLog.create({
    data: {
      userId: admin.userId,
      action: "PRODUCT_SERVICE_PROFILE_UPDATED",
      entity: "ProductServiceProfile",
      entityId: saved.id,
      afterJson: {
        productId,
        productName: product.name,
        isPublished: saved.isPublished,
        updatedBy: admin.userId,
      },
    },
  })

  revalidatePath("/admin/products/service-management")
  revalidatePath(`/admin/products/service-management/${productId}`)
  revalidatePath("/dashboard/my-products")
}
