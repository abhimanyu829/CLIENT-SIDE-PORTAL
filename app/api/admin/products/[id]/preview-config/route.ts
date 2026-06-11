import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * PATCH /api/admin/products/[id]/preview-config
 *
 * Admin-only endpoint to update a product's preview configuration.
 * Body: { previewEnabled: boolean, previewConfig?: object }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !["SUPER_ADMIN", "SUB_ADMIN", "ADMIN"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { previewEnabled, previewConfig } = body

  if (typeof previewEnabled !== "boolean") {
    return NextResponse.json({ error: "previewEnabled must be a boolean" }, { status: 400 })
  }

  const product = await db.product.update({
    where: { id },
    data: {
      previewEnabled,
      ...(previewConfig !== undefined ? { previewConfig } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      previewEnabled: true,
      previewConfig: true,
    },
  })

  return NextResponse.json({ data: product })
}