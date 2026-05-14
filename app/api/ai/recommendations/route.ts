import { NextResponse } from "next/server"
import { generateEmbedding } from "@/lib/openai"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, query } = body

    if (!userId || !query) {
      return NextResponse.json({ error: "Missing userId or query" }, { status: 400 })
    }

    const queryEmbedding = await generateEmbedding(query)
    const formattedVector = `[${queryEmbedding.join(',')}]`

    const recommendations = await db.$queryRaw`
      SELECT id, name, description, price,
             1 - (embedding <=> ${formattedVector}::vector) AS similarity
      FROM "Product"
      WHERE id NOT IN (
        SELECT "productId" FROM "Subscription" WHERE "userId" = ${userId}
      )
      ORDER BY embedding <=> ${formattedVector}::vector
      LIMIT 3;
    `
    
    return NextResponse.json({ data: recommendations })

  } catch (error: any) {
    console.error("[API/AI/Recommendations] Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
