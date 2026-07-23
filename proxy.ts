import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "@/lib/redis"
import { actionForAdminRequest, resourceForAdminApiPath, resourceForAdminPath } from "@/lib/subadmin-permission-policy"

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

export default clerkMiddleware(
  async (clerkAuth, req: NextRequest) => {
    const path = req.nextUrl.pathname
    const isAdminRequest = path.startsWith("/admin") || path.startsWith("/api/admin/")

    const withAdminPermissionContext = () => {
      if (!isAdminRequest) return NextResponse.next()

      const requestHeaders = new Headers(req.headers)
      const resource = path.startsWith("/api/admin/")
        ? resourceForAdminApiPath(path)
        : resourceForAdminPath(path)
      const action = actionForAdminRequest(path, req.method, requestHeaders.has("next-action"))

      requestHeaders.set("x-nexusai-admin-permission-scope", "true")
      if (resource) requestHeaders.set("x-nexusai-admin-resource", resource)
      if (resource) requestHeaders.set("x-nexusai-admin-action", action)

      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    if (path === "/api/webhooks/clerk") {
      return NextResponse.next()
    }

    if (path.startsWith("/sso-callback")) {
      return NextResponse.next()
    }

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

    let clerkUserId: string | null = null
    try {
      const clerkAuthObj = await clerkAuth()
      clerkUserId =
        "userId" in clerkAuthObj && typeof clerkAuthObj.userId === "string"
          ? clerkAuthObj.userId
          : null
    } catch {
      clerkUserId = null
    }

    const isAuthenticated = !!clerkUserId

    const isAuthPage = path.startsWith("/login") || path.startsWith("/register")
    if (isAuthPage && isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    if (path.startsWith("/dashboard")) {
      if (!isAuthenticated) {
        const url = new URL("/login", req.url)
        url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
        return NextResponse.redirect(url)
      }
    }

    if (path.startsWith("/checkout") || path.startsWith("/cart")) {
      if (!isAuthenticated) {
        const url = new URL("/login", req.url)
        url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
        return NextResponse.redirect(url)
      }
    }

    if (path.startsWith("/api/cart") || path.startsWith("/api/payments")) {
      if (!isAuthenticated) {
        return NextResponse.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
          { status: 401 }
        )
      }
    }

    if (path.startsWith("/admin")) {
      if (!isAuthenticated) {
        const url = new URL("/login", req.url)
        url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
        return NextResponse.redirect(url)
      }
    }

    if (path === "/admin/subadmin") {
      return NextResponse.redirect(new URL("/admin/subadmins", req.url))
    }

    if (/^\/api\/entitlements\/[^/]+\/credentials/.test(path)) {
      if (!isAuthenticated) {
        return NextResponse.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
          { status: 401 }
        )
      }
    }

    if (path === "/api/refunds/request") {
      if (!isAuthenticated) {
        return NextResponse.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
          { status: 401 }
        )
      }
    }

    if (path === "/api/demos/create") {
      if (!isAuthenticated) {
        return NextResponse.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
          { status: 401 }
        )
      }
    }

    if (path.startsWith("/dashboard/my-products")) {
      if (!isAuthenticated) {
        return NextResponse.redirect(new URL("/login", req.url))
      }
    }

    if (path.startsWith("/admin/previews")) {
      if (!isAuthenticated) {
        return NextResponse.redirect(new URL("/admin", req.url))
      }
    }

    return withAdminPermissionContext()
  },
  { clockSkewInMs: 60000 }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/admin-access",
    "/checkout/:path*",
    "/cart/:path*",
    "/login(.*)",
    "/register(.*)",
    "/sso-callback",
    "/sso-callback/:path*",
    "/api/:path*",
    "/request-service",
    "/request-service/:path*",
    "/custom-service",
    "/custom-service/:path*",
  ],
}
