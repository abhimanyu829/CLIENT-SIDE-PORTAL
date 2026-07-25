import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * Backend subscription enforcement — used by API routes to gate access
 * to features/endpoints based on the user's active SubscriptionPlan tier.
 *
 * The FRONTEND never decides access. This module is the single source of truth.
 *
 * Usage:
 *   const check = await requireSubscriptionTier(req, ["PRO", "AGENCY", "ENTERPRISE"])
 *   if (check.denied) return check.response
 */

type Tier = "FREE" | "STARTER" | "PRO" | "AGENCY" | "ENTERPRISE"

const TIER_RANK: Record<Tier, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  AGENCY: 3,
  ENTERPRISE: 4,
}

export type SubscriptionCheckResult =
  | { denied: false; subscription: any; plan: any }
  | { denied: true; response: NextResponse }

export async function requireSubscriptionTier(
  _req: NextRequest,
  allowedTiers: Tier[]
): Promise<SubscriptionCheckResult> {
  const session = await auth().catch(() => null)

  if (!session?.user?.id) {
    return {
      denied: true,
      response: NextResponse.json(
        { success: false, error: "Authentication required", code: "UNAUTHENTICATED" },
        { status: 401 }
      ),
    }
  }

  // Super admins bypass all tier checks
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isBanned: true },
  })

  if (!user) {
    return {
      denied: true,
      response: NextResponse.json({ success: false, error: "User not found" }, { status: 401 }),
    }
  }

  if (user.isBanned) {
    return {
      denied: true,
      response: NextResponse.json({ success: false, error: "Account suspended" }, { status: 403 }),
    }
  }

  if (user.role === "SUPER_ADMIN") {
    return { denied: false, subscription: null, plan: { tier: "ENTERPRISE" } }
  }

  // Fetch active UserSubscription
  const subscription = await db.userSubscription.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  })

  if (!subscription) {
    return {
      denied: true,
      response: NextResponse.json(
        {
          success: false,
          error: "Active subscription required to access this feature.",
          code: "NO_SUBSCRIPTION",
          upgradeUrl: "/dashboard/subscriptions",
        },
        { status: 403 }
      ),
    }
  }

  const userTierRank = TIER_RANK[subscription.plan.tier as Tier] ?? 0
  const hasAccess = allowedTiers.some((t) => userTierRank >= TIER_RANK[t])

  if (!hasAccess) {
    return {
      denied: true,
      response: NextResponse.json(
        {
          success: false,
          error: `This feature requires a ${allowedTiers[0]} plan or higher. You are on ${subscription.plan.tier}.`,
          code: "INSUFFICIENT_TIER",
          requiredTier: allowedTiers[0],
          userTier: subscription.plan.tier,
          upgradeUrl: "/dashboard/subscriptions",
        },
        { status: 403 }
      ),
    }
  }

  return { denied: false, subscription, plan: subscription.plan }
}

/**
 * Minimal check: does user have any active subscription?
 */
export async function requireAnySubscription(
  _req: NextRequest
): Promise<SubscriptionCheckResult> {
  return requireSubscriptionTier(_req, ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE"])
}

/**
 * Returns user's current plan info without throwing — for conditional rendering helpers.
 * Returns null if user is not authenticated or has no active subscription.
 */
export async function getUserSubscriptionStatus(userId: string) {
  const subscription = await db.userSubscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          tier: true,
          billingCycle: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!subscription) return null

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    plan: subscription.plan,
    tier: subscription.plan.tier as Tier,
    tierRank: TIER_RANK[subscription.plan.tier as Tier] ?? 0,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  }
}
