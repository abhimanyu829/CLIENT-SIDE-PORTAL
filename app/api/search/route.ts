import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim() ?? ""

    if (!q || q.length < 2) {
      return NextResponse.json({ data: { projects: [], tickets: [], invoices: [], products: [] } })
    }

    const [projects, tickets, invoices, products] = await Promise.all([
      db.project.findMany({
        where: { clientId: userId, title: { contains: q, mode: "insensitive" } },
        select: { id: true, title: true, status: true, updatedAt: true },
        take: 5,
      }),
      db.ticket.findMany({
        where: { clientId: userId, title: { contains: q, mode: "insensitive" } },
        select: { id: true, title: true, status: true, priority: true, createdAt: true },
        take: 5,
      }),
      db.invoice.findMany({
        where: { userId, number: { contains: q, mode: "insensitive" } },
        select: { id: true, number: true, totalAmount: true, status: true, issuedAt: true },
        take: 5,
      }),
      db.product.findMany({
        where: { status: ProductStatus.PUBLISHED, name: { contains: q, mode: "insensitive" } },
        select: { id: true, slug: true, name: true, tagline: true, type: true, iconUrl: true },
        take: 5,
      }),
    ])

    return NextResponse.json({ data: { projects, tickets, invoices, products } })
  } catch (err) {
    console.error("[search]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
