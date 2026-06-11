import { clerkMiddleware, getAuth } from "@clerk/nextjs/server"
import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "@/lib/redis"
import { Role } from "@prisma/client"

// ─── Rate Limiters ────────────────────────────────────────────────
const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "15 m"),
      analytics: true,
    })
  : null

const paymentRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      analytics: true,
    })
  : null

const refundRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "60 m"),
      analytics: true,
    })
  : null

// ─── Middleware ───────────────────────────────────────────────────
export default clerkMiddleware(async (clerkAuth, req: NextRequest) => {
  const path = req.nextUrl.pathname

  // Skip Clerk webhook endpoint — validated by svix signature, not auth
  if (path === "/api/webhooks/clerk") {
    return NextResponse.next()
  }

  // ── Rate Limiting (skipped if Redis not configured) ──────────
  if (path.startsWith("/api/") && ratelimit) {
    const ip =
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      "127.0.0.1"

    if (path.startsWith("/api/payments/") && paymentRatelimit) {
      const { success } = await paymentRatelimit.limit(ip)
      if (!success) {
        return NextResponse.json(
          { success: false, error: { code: "RATE_LIMITED", message: "Too many payment requests. Please wait a moment." } },
          { status: 429 }
        )
      }
    }

    if (path === "/api/refunds/request" && refundRatelimit) {
      const { success } = await refundRatelimit.limit(ip)
      if (!success) {
        return NextResponse.json(
          { success: false, error: { code: "RATE_LIMITED", message: "Too many refund requests. Please try again later." } },
          { status: 429 }
        )
      }
    }

    const { success } = await ratelimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 })
    }
  }

  // ── Authentication Check ─────────────────────────────────────
  // Primary: Clerk session
  const clerkAuthObj = await clerkAuth()
  const { userId: clerkUserId } = clerkAuthObj

  // Fallback: NextAuth JWT (legacy credential users during migration)
  let nextAuthToken = null
  try {
    nextAuthToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  } catch {
    // NextAuth not available — ok, Clerk is primary
  }

  const isAuthenticated = !!clerkUserId || !!nextAuthToken
  const role = nextAuthToken?.role as Role | undefined
  const isVerified = nextAuthToken?.isVerified as boolean | undefined

  const isAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/sso-callback")

  // Redirect authenticated users away from auth pages
  if (isAuthPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    const response = NextResponse.next()
    if (path.startsWith("/checkout") || path.startsWith("/api/payments")) {
      response.headers.set("X-Content-Type-Options", "nosniff")
      response.headers.set("X-Frame-Options", "DENY")
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
      response.headers.set("Pragma", "no-cache")
      response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    }
    return response
  }

  // ── Dashboard Protection ──────────────────────────────────────
  if (path.startsWith("/dashboard")) {
    if (!isAuthenticated) {
      const url = new URL("/login", req.url)
      url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }
    // Note: email verification is checked at layout level (server component)
  }

  // ── Cart & Checkout Protection ────────────────────────────────
  if (path.startsWith("/checkout") || path.startsWith("/cart")) {
    if (!isAuthenticated) {
      const url = new URL("/login", req.url)
      url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }
  }

  // ── Commerce API Protection ───────────────────────────────────
  if (path.startsWith("/api/cart") || path.startsWith("/api/payments")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      )
    }
  }

  // ── Admin Panel Protection ────────────────────────────────────
  // Note: Role authorization is enforced at layout/server-component level (requireAdmin())
  // Middleware only enforces authentication at the edge
  if (path.startsWith("/admin")) {
    if (!isAuthenticated) {
      const url = new URL("/login", req.url)
      url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }
    // Role check is done server-side in admin layout via requireAdmin()
    // Edge middleware cannot reliably check DB roles — that's by design
  }

  // ── Entitlement Credential Protection ────────────────────────
  if (/^\/api\/entitlements\/[^/]+\/credentials/.test(path)) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      )
    }
  }

  // ── Refund API Protection ─────────────────────────────────────
  if (path === "/api/refunds/request") {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      )
    }
  }

  // ── Demo Creation Protection ──────────────────────────────────
  if (path === "/api/demos/create") {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      )
    }
  }

  // ── My Products Protection ────────────────────────────────────
  if (path.startsWith("/dashboard/my-products")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  // ── Admin Previews Protection ─────────────────────────────────
  if (path.startsWith("/admin/previews")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/admin", req.url))
    }
    // Full role check happens in the server component
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/checkout/:path*",
    "/cart/:path*",
    "/login",
    "/register",
    "/sso-callback",
    "/api/:path*",
  ],
}
