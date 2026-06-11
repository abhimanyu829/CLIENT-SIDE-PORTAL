import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getRazorpay } from "@/lib/razorpay"
import { env } from "@/lib/env"
import { db } from "@/lib/db"

/**
 * GET /api/payments/test
 * 
 * Diagnostic endpoint to verify the entire payment configuration.
 * Returns the status of environment variables, Razorpay connectivity,
 * and database connectivity. Only accessible by authenticated users.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
  }

  // Only allow in development
  if (env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, error: "Not available in production" }, { status: 403 })
  }

  console.log("[PAYMENTS TEST] Running payment system diagnostics...")

  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  }

  // ── 1. Environment Variables ──────────────────────────────────────────────
  diagnostics.env = {
    RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID ? `${env.RAZORPAY_KEY_ID.slice(0, 8)}...` : "❌ NOT SET",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? `${env.NEXT_PUBLIC_RAZORPAY_KEY_ID.slice(0, 8)}...` : "❌ NOT SET",
    RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET ? "✅ SET (hidden)" : "❌ NOT SET",
    RAZORPAY_WEBHOOK_SECRET: env.RAZORPAY_WEBHOOK_SECRET ? "✅ SET (hidden)" : "❌ NOT SET",
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL ?? "❌ NOT SET",
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY ? "✅ SET (hidden)" : "⚠️ NOT SET (optional)",
    REDIS_URL: env.REDIS_URL ? "✅ SET" : "⚠️ NOT SET (queues disabled)",
  }

  // ── 2. Razorpay Client ─────────────────────────────────────────────────────
  try {
    const client = getRazorpay()
    if (!client) {
      diagnostics.razorpay = { status: "❌ NOT INITIALIZED", reason: "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET" }
    } else {
      // Test API call — fetch a minimal amount of orders
      try {
        const orders = await (client as any).orders.all({ count: 1 })
        diagnostics.razorpay = {
          status: "✅ CONNECTED",
          keyId: env.RAZORPAY_KEY_ID?.slice(0, 8) + "...",
          recentOrdersCount: orders?.items?.length ?? 0,
        }
      } catch (apiError: any) {
        diagnostics.razorpay = {
          status: "⚠️ INITIALIZED BUT API ERROR",
          error: apiError.message,
          statusCode: apiError.statusCode,
        }
      }
    }
  } catch (error: any) {
    diagnostics.razorpay = { status: "❌ ERROR", error: error.message }
  }

  // ── 3. Database Connectivity ──────────────────────────────────────────────
  try {
    const userCount = await db.user.count()
    const productCount = await db.product.count({ where: { status: "AVAILABLE" } })
    const orderCount = await db.order.count()
    diagnostics.database = {
      status: "✅ CONNECTED",
      users: userCount,
      publishedProducts: productCount,
      orders: orderCount,
    }
  } catch (error: any) {
    diagnostics.database = { status: "❌ ERROR", error: error.message }
  }

  // ── 4. Product & Tier Check ────────────────────────────────────────────────
  try {
    const tiers = await db.productTier.findMany({
      where: { isActive: true },
      include: { product: { select: { name: true, status: true } } },
      take: 5,
      orderBy: { createdAt: "desc" },
    })
    diagnostics.tiers = {
      count: await db.productTier.count({ where: { isActive: true } }),
      sample: tiers.map((t) => ({
        id: t.id,
        name: t.name,
        price: Number(t.price),
        currency: t.currency,
        interval: t.interval,
        product: t.product.name,
        productStatus: t.product.status,
        razorpayPlanId: t.razorpayPlanId ?? null,
      })),
    }
  } catch (error: any) {
    diagnostics.tiers = { status: "❌ ERROR", error: error.message }
  }

  // ── 5. Recent Orders ──────────────────────────────────────────────────────
  try {
    const recentOrders = await db.order.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        grandTotal: true,
        currency: true,
        gateway: true,
        createdAt: true,
      },
    })
    diagnostics.recentOrders = recentOrders.map((o) => ({
      ...o,
      grandTotal: Number(o.grandTotal),
    }))
  } catch (error: any) {
    diagnostics.recentOrders = { status: "❌ ERROR", error: error.message }
  }

  console.log("[PAYMENTS TEST] Diagnostics complete")
  return NextResponse.json({ success: true, diagnostics })
}