import { NextResponse } from "next/server"
import { ProductStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { sanitizeProductForPublic } from "@/lib/sanitize-product"

// GET /api/products/[slug] — public product detail with tiers and reviews.
// Same visibility rules as the storefront page
// (app/(public)/marketplace/[slug]/page.tsx): only AVAILABLE products, only
// APPROVED reviews. A product in any other status is answered exactly like a
// missing one, and non-public fields (delivery config, owner-only access
// links, reservation holder, editor bookkeeping) are never returned.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const product = await db.product.findFirst({
      where: { slug, status: ProductStatus.AVAILABLE },
      include: {
        tiers: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        reviews: {
          where: { status: "APPROVED" },
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

    return NextResponse.json({ data: sanitizeProductForPublic(product) })
  } catch (err) {
    console.error("[products/[slug]] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/products/[slug] — not supported here. Product edits go through
// the admin product console (/admin/products, server actions in
// app/(admin)/admin/products/actions.ts), which enforces the admin permission
// model and versions and audits every change. This handler used to check a role that does not exist
// ("ADMIN"), so it has always answered 403; it now does so explicitly
// instead of carrying an unvalidated update path that a later role "fix"
// could accidentally open.
export async function PATCH() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
