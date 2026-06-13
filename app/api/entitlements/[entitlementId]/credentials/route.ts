import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"

/**
 * GET /api/entitlements/[entitlementId]/credentials
 *
 * Returns decrypted product credentials for the verified owner.
 * Rate-limited to 5 requests per user per hour.
 * All access is audit-logged.
 * NEVER cached. NEVER accessible by admins without their own audit trail.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entitlementId: string }> }
) {
  const { entitlementId } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const userId = session.user.id

  // Rate limit: max 5 credential accesses per user per hour
  if (redis) {
    try {
      const rateKey = `entitlement:cred:${userId}`
      const count = await redis.incr(rateKey)
      if (count === 1) await redis.expire(rateKey, 3600)
      if (count > 5) {
        return NextResponse.json(
          { error: "Too many credential requests. Please try again later." },
          { status: 429 }
        )
      }
    } catch (redisErr) {
      logger.warn({ redisErr }, "entitlements/credentials: Redis rate limit failed, proceeding")
    }
  }

  // Fetch entitlement — must belong to requesting user
  const entitlement = await db.customerEntitlement.findUnique({
    where: { id: entitlementId },
    include: {
      product: {
        select: { name: true, slug: true },
      },
    },
  })

  if (!entitlement) {
    return NextResponse.json({ error: "Entitlement not found" }, { status: 404 })
  }

  // Strict ownership check
  if (entitlement.userId !== userId) {
    logger.warn({ userId, entitlementId, ownerId: entitlement.userId }, "Unauthorized credential access attempt")
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  // Must be active
  if (entitlement.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Entitlement is ${entitlement.status.toLowerCase()}. Active subscription required.` },
      { status: 403 }
    )
  }

  // Must have credentials
  if (!entitlement.credentialSnapshot) {
    return NextResponse.json(
      { error: "No credentials configured for this product. Contact support." },
      { status: 404 }
    )
  }

  // Decrypt credential snapshot
  let credentials: Record<string, unknown>
  try {
    const decrypted = decrypt(entitlement.credentialSnapshot)
    credentials = JSON.parse(decrypted)
  } catch (err) {
    logger.error({ err, entitlementId }, "Failed to decrypt credential snapshot")
    return NextResponse.json(
      { error: "Failed to retrieve credentials. Please contact support." },
      { status: 500 }
    )
  }

  // Audit log this access (NEVER log the credential values themselves)
  await db.auditLog.create({
    data: {
      userId,
      action: "CREDENTIAL_ACCESSED",
      entity: "CustomerEntitlement",
      entityId: entitlementId,
      afterJson: {
        productName: entitlement.product.name,
        accessedAt: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      },
    },
  }).catch((err) => logger.warn({ err }, "Failed to create credential access audit log"))

  // Return credentials — no caching headers
  return NextResponse.json(
    {
      data: {
        credentials,
        entitlementId,
        productName: entitlement.product.name,
        retrievedAt: new Date().toISOString(),
        warning: "Store these credentials securely. Do not share them.",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    }
  )
}
