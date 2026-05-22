import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-auth"
import SettingsClient from "./SettingsClient"

export default async function SettingsPage() {
  await requireAdmin()

  const featureFlags = await db.featureFlag.findMany({
    orderBy: { createdAt: "desc" }
  })

  // Serialize Date objects for boundary safety
  const serializedFeatureFlags = featureFlags.map((flag) => ({
    ...flag,
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
  }))

  return <SettingsClient featureFlags={serializedFeatureFlags as any} />
}
