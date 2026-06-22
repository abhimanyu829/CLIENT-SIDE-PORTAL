import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? undefined
  const productId = searchParams.get("productId") ?? undefined
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = 20

  const requests = await db.credentialRequest.findMany({
    where: { ...(status ? { status: status as any } : {}), ...(productId ? { productId } : {}) },
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true, slug: true, productLoginUrl: true } },
    },
    orderBy: { requestedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  })

  const total = await db.credentialRequest.count({
    where: { ...(status ? { status: status as any } : {}), ...(productId ? { productId } : {}) },
  })

  return NextResponse.json({ success: true, data: requests, total, page })
}
