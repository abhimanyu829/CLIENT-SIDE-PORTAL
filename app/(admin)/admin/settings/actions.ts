"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { auditLog } from "@/lib/admin-audit"

export async function createFeatureFlag(data: {
  name: string
  description: string
  isEnabled: boolean
  rolloutPercent: number
  targetUserIds: string[]
}) {
  const session = await auth()
  if (!session?.user || !session.user.role?.includes("ADMIN")) throw new Error("Unauthorized")

  const flag = await db.featureFlag.create({
    data: {
      name: data.name.toUpperCase().trim().replace(/\s+/g, "_"),
      description: data.description,
      isEnabled: data.isEnabled,
      rolloutPercent: data.rolloutPercent,
      targetUserIds: data.targetUserIds,
    },
  })

  await auditLog({
    userId: session.user.id,
    action: "FEATURE_FLAG_CREATED",
    entity: "FeatureFlag",
    entityId: flag.id,
    after: flag,
  })

  revalidatePath("/admin/settings")
  return flag
}

export async function updateFeatureFlag(flagId: string, data: {
  name: string
  description: string
  isEnabled: boolean
  rolloutPercent: number
  targetUserIds: string[]
}) {
  const session = await auth()
  if (!session?.user || !session.user.role?.includes("ADMIN")) throw new Error("Unauthorized")

  const before = await db.featureFlag.findUnique({ where: { id: flagId } })

  const flag = await db.featureFlag.update({
    where: { id: flagId },
    data: {
      name: data.name,
      description: data.description,
      isEnabled: data.isEnabled,
      rolloutPercent: data.rolloutPercent,
      targetUserIds: data.targetUserIds,
    },
  })

  await auditLog({
    userId: session.user.id,
    action: "FEATURE_FLAG_UPDATED",
    entity: "FeatureFlag",
    entityId: flagId,
    before: before || undefined,
    after: flag,
  })

  revalidatePath("/admin/settings")
  return flag
}

export async function toggleFeatureFlag(flagId: string, isEnabled: boolean) {
  const session = await auth()
  if (!session?.user || !session.user.role?.includes("ADMIN")) throw new Error("Unauthorized")

  const before = await db.featureFlag.findUnique({ where: { id: flagId } })

  const flag = await db.featureFlag.update({
    where: { id: flagId },
    data: { isEnabled },
  })

  await auditLog({
    userId: session.user.id,
    action: "FEATURE_FLAG_TOGGLED",
    entity: "FeatureFlag",
    entityId: flagId,
    before: before || undefined,
    after: flag,
  })

  revalidatePath("/admin/settings")
  return flag
}

export async function saveGlobalConfiguration(data: {
  platformName: string
  brandingLogo: string
  metaTitle: string
  metaDescription: string
}) {
  const session = await auth()
  if (!session?.user || !session.user.role?.includes("ADMIN")) throw new Error("Unauthorized")

  // Log audit trail for global configurations changes
  await auditLog({
    userId: session.user.id,
    action: "GLOBAL_CONFIG_SAVED",
    entity: "Configuration",
    after: data,
  })

  revalidatePath("/admin/settings")
  return { success: true }
}
