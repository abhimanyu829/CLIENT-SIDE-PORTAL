import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"

// In Next.js 16, revalidateTag requires 2 arguments
const T = "" as const

/**
 * Admin-only cache revalidation endpoint.
 * Called by admin API routes after mutating products, campaigns, or platform data.
 *
 * Usage:
 *   POST /api/admin/revalidate
 *   { "tags": ["products", "featured-products"], "paths": ["/", "/marketplace"] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!["SUPER_ADMIN", "SUB_ADMIN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const tags: string[] = body.tags || []
    const paths: string[] = body.paths || []

    // Revalidate tags (2-arg form for Next.js 16)
    for (const tag of tags) {
      revalidateTag(tag, T)
    }

    // Revalidate paths
    for (const path of paths) {
      revalidatePath(path, "layout")
    }

    return NextResponse.json({
      revalidated: true,
      tags,
      paths,
      timestamp: Date.now(),
    })
  } catch (err) {
    console.error("Revalidation error:", err)
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 })
  }
}
