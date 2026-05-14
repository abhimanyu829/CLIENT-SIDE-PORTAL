import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "@/lib/redis"
import { Role } from "@prisma/client"

// Only instantiate rate limiter if Redis is available
const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "15 m"),
      analytics: true,
    })
  : null

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Rate limiting — skipped gracefully when Redis is not configured
  if (path.startsWith("/api/") && ratelimit) {
    const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1"
    const { success } = await ratelimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 })
    }
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const role = token?.role as Role | undefined

  const isAuthPage =
    path.startsWith("/login") || path.startsWith("/register")

  // Redirect logged-in users away from auth pages
  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // Protect dashboard and admin routes
  if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
    if (!token) {
      const url = new URL("/login", req.url)
      url.searchParams.set("callbackUrl", req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    if (path.startsWith("/admin")) {
      if (role !== Role.SUPER_ADMIN && role !== Role.SUB_ADMIN) {
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/api/:path*",
  ],
}
