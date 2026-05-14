import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/products/[slug] — public product detail with tiers and reviews
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const product = await db.product.findUnique({
      where: { slug },
      include: {
        tiers: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Increment view count (fire-and-forget)
    db.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {})

    return NextResponse.json({ data: product })
  } catch (err) {
    console.error("[products/[slug]] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/products/[slug] — Admin: update product fields
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { name, tagline, description, status, thumbnailUrl } = body

    const updated = await db.product.update({
      where: { slug },
      data: { name, tagline, description, status, thumbnailUrl },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[products/[slug]] PATCH:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
