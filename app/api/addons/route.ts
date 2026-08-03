import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/// Public-ish add-on catalog (authenticated customers). Prices are always read
/// from the DB — never hardcoded anywhere in the frontend.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const productId = req.nextUrl.searchParams.get("productId")
  try {
    const addons = await db.addonCatalogItem.findMany({
      where: productId
        ? { isActive: true, OR: [{ applicableProductIds: { isEmpty: true } }, { applicableProductIds: { has: productId } }] }
        : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    })
    return NextResponse.json({ success: true, data: addons })
  } catch (err) {
    console.error("[addons GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load add-ons" }, { status: 500 })
  }
}
