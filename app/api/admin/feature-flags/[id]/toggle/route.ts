import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { emitEvent, EVENTS } from "@/lib/services/event-bus"
import { invalidateCache, CACHE_KEYS } from "@/lib/services/cache-service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()

  // Only SUPER_ADMIN can toggle feature flags
  if (!admin.isSuperAdmin) {
    return NextResponse.json(
      { error: "Only SUPER_ADMIN can toggle feature flags" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { isEnabled, reason } = body

  if (typeof isEnabled !== "boolean") {
    return NextResponse.json({ error: "isEnabled (boolean) is required" }, { status: 400 })
  }

  const flag = await db.featureFlag.findUnique({ where: { id } })
  if (!flag) {
    return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
  }

  await db.$transaction(async (tx) => {
    await tx.featureFlag.update({
      where: { id },
      data: { isEnabled },
    })

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "FEATURE_FLAG_TOGGLED",
        entity: "FeatureFlag",
        entityId: id,
        beforeJson: { isEnabled: flag.isEnabled, name: flag.name },
        afterJson: { isEnabled, name: flag.name, reason: reason ?? null, adminId: admin.userId },
      },
    })
  })

  await invalidateCache([CACHE_KEYS.FEATURE_FLAGS])

  await emitEvent({
    type: EVENTS.FEATURE_FLAG_TOGGLED,
    timestamp: new Date().toISOString(),
    actorId: admin.userId,
    payload: { flagId: id, flagName: flag.name, isEnabled, reason },
  })

  return NextResponse.json({
    success: true,
    flag: { id, name: flag.name, isEnabled },
  })
}
