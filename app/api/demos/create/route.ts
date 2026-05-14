import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { nanoid } from "nanoid"

// POST /api/demos/create — create a demo session for a product
export async function POST(req: Request) {
  try {
    const { productId, templateId } = await req.json()

    if (!productId || !templateId) {
      return NextResponse.json(
        { error: "productId and templateId are required" },
        { status: 400 }
      )
    }

    const session = await getServerSession(authOptions)

    // Check product exists and has demo support
    const product = await db.product.findUnique({
      where: { id: productId, status: "PUBLISHED" },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const sessionToken = nanoid(32)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 2) // 2-hour demo window

    const demoSession = await db.demoSession.create({
      data: {
        productId,
        templateId,
        sessionToken,
        userId: session?.user?.id,
        mockDataJson: { demo: true, template: templateId },
        expiresAt,
      },
    })

    return NextResponse.json(
      { data: { sessionToken: demoSession.sessionToken, expiresAt } },
      { status: 201 }
    )
  } catch (err) {
    console.error("[demos/create] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
